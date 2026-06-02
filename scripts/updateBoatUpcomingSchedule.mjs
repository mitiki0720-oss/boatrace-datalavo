import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { getJstTimestampParts, normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_DIR = path.join(projectRoot, "public", "data", "boatrace");
const OFFICIAL_ORIGIN = "https://www.boatrace.jp";
const DEFAULT_DAYS = 31;

const VENUES = [
	{ code: "01", slug: "kiryu", name: "桐生", session: "Night", sessionType: "ナイター" },
	{ code: "02", slug: "toda", name: "戸田", session: "Day", sessionType: "デイ" },
	{ code: "03", slug: "edogawa", name: "江戸川", session: "Day", sessionType: "デイ" },
	{ code: "04", slug: "heiwajima", name: "平和島", session: "Day", sessionType: "デイ" },
	{ code: "05", slug: "tamagawa", name: "多摩川", session: "Day", sessionType: "デイ" },
	{ code: "06", slug: "hamanako", name: "浜名湖", session: "Day", sessionType: "デイ" },
	{ code: "07", slug: "gamagori", name: "蒲郡", session: "Night", sessionType: "ナイター" },
	{ code: "08", slug: "tokoname", name: "常滑", session: "Day", sessionType: "デイ" },
	{ code: "09", slug: "tsu", name: "津", session: "Day", sessionType: "デイ" },
	{ code: "10", slug: "mikuni", name: "三国", session: "Morning", sessionType: "モーニング" },
	{ code: "11", slug: "biwako", name: "びわこ", session: "Day", sessionType: "デイ" },
	{ code: "12", slug: "suminoe", name: "住之江", session: "Night", sessionType: "ナイター" },
	{ code: "13", slug: "amagasaki", name: "尼崎", session: "Day", sessionType: "デイ" },
	{ code: "14", slug: "naruto", name: "鳴門", session: "Morning", sessionType: "モーニング" },
	{ code: "15", slug: "marugame", name: "丸亀", session: "Night", sessionType: "ナイター" },
	{ code: "16", slug: "kojima", name: "児島", session: "Day", sessionType: "デイ" },
	{ code: "17", slug: "miyajima", name: "宮島", session: "Day", sessionType: "デイ" },
	{ code: "18", slug: "tokuyama", name: "徳山", session: "Morning", sessionType: "モーニング" },
	{ code: "19", slug: "shimonoseki", name: "下関", session: "Night", sessionType: "ナイター" },
	{ code: "20", slug: "wakamatsu", name: "若松", session: "Night", sessionType: "ナイター" },
	{ code: "21", slug: "ashiya", name: "芦屋", session: "Morning", sessionType: "モーニング" },
	{ code: "22", slug: "fukuoka", name: "福岡", session: "Day", sessionType: "デイ" },
	{ code: "23", slug: "karatsu", name: "唐津", session: "Morning", sessionType: "モーニング" },
	{ code: "24", slug: "omura", name: "大村", session: "Night", sessionType: "ナイター" },
];

const VENUE_BY_CODE = new Map(VENUES.map((venue) => [venue.code, venue]));
const VENUE_BY_COMPACT_NAME = new Map(VENUES.map((venue) => [compactText(venue.name), venue]));

function parseCliArgs(argv = process.argv.slice(2)) {
	const parsed = {};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) {
			continue;
		}

		const trimmed = token.slice(2);
		const separatorIndex = trimmed.indexOf("=");
		const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
		const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : argv[index + 1];

		switch (key) {
			case "target-date":
			case "targetDate":
				parsed.targetDate = value;
				if (separatorIndex < 0) {
					index += 1;
				}
				break;
			case "days":
				parsed.days = value;
				if (separatorIndex < 0) {
					index += 1;
				}
				break;
			case "output-dir":
			case "outputDir":
				parsed.outputDir = value;
				if (separatorIndex < 0) {
					index += 1;
				}
				break;
			default:
				break;
		}
	}
	return parsed;
}

function parseOptions(argv = process.argv.slice(2), env = process.env) {
	const cli = parseCliArgs(argv);
	const days = Number.parseInt(cli.days ?? env.BOAT_RACE_SCHEDULE_DAYS ?? String(DEFAULT_DAYS), 10);
	return {
		targetDate: normalizeTargetDate(cli.targetDate ?? env.BOAT_RACE_TARGET_DATE),
		days: Number.isInteger(days) && days >= 0 && days <= 62 ? days : DEFAULT_DAYS,
		outputDir: path.resolve(projectRoot, cli.outputDir ?? env.BOAT_RACE_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR),
	};
}

function compactText(value) {
	return String(value ?? "")
		.replace(/\u00a0/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function toDateKey(date) {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

function addDays(dateKey, days) {
	const date = new Date(`${dateKey}T00:00:00+09:00`);
	date.setDate(date.getDate() + days);
	return toDateKey(date);
}

function compareDate(left, right) {
	return String(left).localeCompare(String(right));
}

function monthKeysBetween(startDate, endDate) {
	const keys = [];
	const cursor = new Date(`${startDate.slice(0, 7)}-01T00:00:00+09:00`);
	const endMonth = `${endDate.slice(0, 7)}-01`;
	while (toDateKey(cursor) <= endMonth) {
		keys.push(`${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, "0")}`);
		cursor.setMonth(cursor.getMonth() + 1);
	}
	return keys;
}

function parseScheduleDate(monthKey, value) {
	const match = compactText(value).match(/^(\d{2})\/(\d{2})$/);
	if (!match) {
		return null;
	}

	const scheduleYear = Number.parseInt(monthKey.slice(0, 4), 10);
	const scheduleMonth = Number.parseInt(monthKey.slice(4, 6), 10);
	const month = Number.parseInt(match[1], 10);
	const day = Number.parseInt(match[2], 10);
	let year = scheduleYear;
	if (scheduleMonth === 1 && month === 12) {
		year -= 1;
	} else if (scheduleMonth === 12 && month === 1) {
		year += 1;
	}
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateRange(monthKey, value) {
	const match = compactText(value).match(/^(\d{2}\/\d{2})\s*-\s*(\d{2}\/\d{2})$/);
	if (!match) {
		return null;
	}
	const startDate = parseScheduleDate(monthKey, match[1]);
	const endDate = parseScheduleDate(monthKey, match[2]);
	return startDate && endDate ? { startDate, endDate } : null;
}

function formatDateRange(startDate, endDate) {
	return `${startDate.slice(5).replace("-", ".")} - ${endDate.slice(5).replace("-", ".")}`;
}

function readGrade($, item) {
	const classes = $(item)
		.find(".scheduleTable__icoarea span")
		.map((_, element) => $(element).attr("class") ?? "")
		.get();

	if (classes.some((name) => name.includes("is-SG"))) {
		return "SG";
	}
	if (classes.some((name) => name.includes("is-G1"))) {
		return "GI";
	}
	if (classes.some((name) => name.includes("is-G2"))) {
		return "GII";
	}
	if (classes.some((name) => name.includes("is-G3"))) {
		return "GIII";
	}
	return "一般";
}

function readNote($, item) {
	const classes = $(item)
		.find(".scheduleTable__icoarea span")
		.map((_, element) => $(element).attr("class") ?? "")
		.get();
	const notes = [];
	if (classes.some((name) => name.includes("venus"))) {
		notes.push("ヴィーナスシリーズ");
	}
	if (classes.some((name) => name.includes("ladies"))) {
		notes.push("オールレディース");
	}
	if (classes.some((name) => name.includes("rookie"))) {
		notes.push("ルーキーシリーズ");
	}
	return notes.join(" / ");
}

function calculateDayLabel(activeDate, startDate, endDate) {
	if (activeDate === endDate) {
		return "最終日";
	}
	const elapsedDays = Math.floor((new Date(`${activeDate}T00:00:00+09:00`) - new Date(`${startDate}T00:00:00+09:00`)) / 86400000) + 1;
	return elapsedDays <= 1 ? "初日" : `${elapsedDays}日目`;
}

function readStatus(activeDate, startDate, endDate, targetDate) {
	if (activeDate === targetDate && compareDate(startDate, targetDate) <= 0 && compareDate(targetDate, endDate) <= 0) {
		return "開催中";
	}
	return "開催予定";
}

async function readTodaySessionByVenue(outputDir, targetDate) {
	const filePath = path.join(outputDir, "today.generated.json");
	try {
		const payload = JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
		if (payload?.date !== targetDate) {
			return new Map();
		}
		return new Map((payload.venues ?? []).map((venue) => [
			String(venue.venueCode ?? "").padStart(2, "0"),
			{
				session: normalizeSessionName(venue.session, null),
				sessionType: sessionTypeFromSession(venue.session),
			},
		]));
	} catch {
		return new Map();
	}
}

function sessionTypeFromSession(session) {
	const normalized = String(session ?? "").toLowerCase();
	if (normalized.includes("morning")) {
		return "モーニング";
	}
	if (normalized.includes("midnight")) {
		return "ミッドナイト";
	}
	if (normalized.includes("night")) {
		return "ナイター";
	}
	return "デイ";
}

function normalizeSessionName(session, fallback = "Day") {
	const normalized = String(session ?? "").toLowerCase();
	if (normalized.includes("morning")) {
		return "Morning";
	}
	if (normalized.includes("midnight")) {
		return "Midnight";
	}
	if (normalized.includes("night")) {
		return "Night";
	}
	if (normalized.includes("day")) {
		return "Day";
	}
	return fallback;
}

async function fetchMonthlySchedule(monthKey) {
	const url = `${OFFICIAL_ORIGIN}/owsp/sp/race/monthlyschedule?ym=${monthKey}`;
	const response = await fetch(url, {
		headers: {
			"user-agent": "boatrace-datalavo schedule updater",
		},
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${url}`);
	}
	return { monthKey, url, html: await response.text() };
}

function parseMonthlySchedule({ monthKey, url, html }, range, todaySessionByVenue, generatedAt) {
	const $ = load(html);
	const items = [];

	$(".scheduleTable").each((_, table) => {
		const heading = compactText($(table).prev(".balTable__head").text());
		const venue = VENUE_BY_COMPACT_NAME.get(compactText(heading));
		if (!venue) {
			return;
		}

		$(table).find("li").each((__, item) => {
			const rangeText = compactText($(item).find("dt").first().text());
			const parsedRange = parseDateRange(monthKey, rangeText);
			const link = $(item).find("dd a").first();
			const seriesName = compactText(link.text());
			if (!parsedRange || !seriesName) {
				return;
			}

			if (compareDate(parsedRange.endDate, range.startDate) < 0 || compareDate(parsedRange.startDate, range.endDate) > 0) {
				return;
			}

			const activeDate = compareDate(parsedRange.startDate, range.startDate) < 0 ? range.startDate : parsedRange.startDate;
			if (compareDate(activeDate, range.endDate) > 0) {
				return;
			}

			const todaySession = activeDate === range.startDate ? todaySessionByVenue.get(venue.code) : null;
			const session = todaySession?.session || venue.session;
			const sessionType = todaySession?.sessionType || venue.sessionType;
			const href = link.attr("href") || "";
			const sourceUrl = href.startsWith("http") ? href : `${OFFICIAL_ORIGIN}${href}`;
			const grade = readGrade($, item);
			const note = readNote($, item);

			items.push({
				id: `${venue.slug}-${activeDate.replaceAll("-", "")}`,
				date: activeDate,
				venueCode: venue.code,
				venueName: venue.name,
				seriesName,
				title: seriesName,
				grade,
				session,
				sessionType,
				dayLabel: calculateDayLabel(activeDate, parsedRange.startDate, parsedRange.endDate),
				status: readStatus(activeDate, parsedRange.startDate, parsedRange.endDate, range.startDate),
				startDate: parsedRange.startDate,
				endDate: parsedRange.endDate,
				dateRange: formatDateRange(parsedRange.startDate, parsedRange.endDate),
				sourceUrl,
				sourceMonthUrl: url,
				updatedAt: generatedAt,
				...(note ? { note } : {}),
			});
		});
	});

	return items;
}

function dedupeAndSort(items) {
	const byKey = new Map();
	for (const item of items) {
		const key = `${item.date}-${item.venueCode}`;
		if (!byKey.has(key)) {
			byKey.set(key, item);
		}
	}
	return Array.from(byKey.values()).sort((left, right) =>
		left.date.localeCompare(right.date)
		|| left.venueCode.localeCompare(right.venueCode)
		|| left.startDate.localeCompare(right.startDate),
	);
}

function validateFeed(feed, range) {
	if (!feed || typeof feed !== "object") {
		throw new Error("schedule feed is not an object");
	}
	if (!Array.isArray(feed.items)) {
		throw new Error("schedule feed items must be an array");
	}
	if (Number.isNaN(Date.parse(feed.generatedAt))) {
		throw new Error("schedule feed generatedAt is invalid");
	}

	const keys = new Set();
	for (const item of feed.items) {
		for (const key of ["date", "venueCode", "venueName", "seriesName", "grade", "sessionType", "dayLabel", "status", "startDate", "endDate", "sourceUrl", "updatedAt"]) {
			if (!String(item[key] ?? "").trim()) {
				throw new Error(`schedule item missing ${key}: ${JSON.stringify(item)}`);
			}
		}
		if (compareDate(item.date, range.startDate) < 0 || compareDate(item.date, range.endDate) > 0) {
			throw new Error(`schedule item out of visible range: ${item.date} ${item.venueCode}`);
		}
		if (compareDate(item.endDate, range.startDate) < 0 || compareDate(item.startDate, range.endDate) > 0) {
			throw new Error(`schedule event range does not overlap visible range: ${item.startDate} ${item.endDate}`);
		}
		const key = `${item.date}-${item.venueCode}`;
		if (keys.has(key)) {
			throw new Error(`duplicate schedule item: ${key}`);
		}
		keys.add(key);
	}

	if (feed.items.length <= 0 && feed.sourceStatus !== "no-schedule") {
		throw new Error("schedule feed has zero items without sourceStatus=no-schedule");
	}
}

async function writeJsonAfterValidation(filePath, feed, range) {
	validateFeed(feed, range);
	await mkdir(path.dirname(filePath), { recursive: true });
	const text = `${JSON.stringify(feed, null, 2)}\n`;
	JSON.parse(text);
	await writeFile(filePath, text, "utf8");
}

export async function main(rawOptions = parseOptions()) {
	const options = {
		...rawOptions,
		targetDate: normalizeTargetDate(rawOptions.targetDate),
		outputDir: path.resolve(projectRoot, rawOptions.outputDir ?? DEFAULT_OUTPUT_DIR),
	};
	const timestamps = getJstTimestampParts(options.targetDate);
	const range = {
		startDate: timestamps.date,
		endDate: addDays(timestamps.date, options.days ?? DEFAULT_DAYS),
	};
	const outputPath = path.join(options.outputDir, "upcoming-schedule.generated.json");
	const todaySessionByVenue = await readTodaySessionByVenue(options.outputDir, timestamps.date);
	const monthKeys = monthKeysBetween(range.startDate, range.endDate);

	console.log(`[update-boat-upcoming-schedule] targetDate=${range.startDate} endDate=${range.endDate}`);
	console.log(`[update-boat-upcoming-schedule] months=${monthKeys.join(",")}`);

	try {
		const monthlyPages = [];
		for (const monthKey of monthKeys) {
			monthlyPages.push(await fetchMonthlySchedule(monthKey));
		}

		const items = dedupeAndSort(monthlyPages.flatMap((page) => parseMonthlySchedule(page, range, todaySessionByVenue, timestamps.generatedAt)));
		const feed = {
			version: 1,
			generatedAt: timestamps.generatedAt,
			source: "boatrace-official-monthly-schedule",
			sourceStatus: items.length > 0 ? "ok" : "no-schedule",
			range,
			items,
		};

		await writeJsonAfterValidation(outputPath, feed, range);
		console.log(`updated: ${outputPath}`);
		console.log(`source: ${feed.source}`);
		console.log(`items: ${feed.items.length}`);
		console.log(`range: ${range.startDate}..${range.endDate}`);
		return feed;
	} catch (error) {
		console.error("[update-boat-upcoming-schedule] failed to refresh official schedule");
		console.error(`[update-boat-upcoming-schedule] keep existing upcoming-schedule.generated.json`);
		console.error(error instanceof Error ? error.message : String(error));
		throw error;
	}
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
	main(parseOptions()).catch(() => {
		process.exitCode = 1;
	});
}
