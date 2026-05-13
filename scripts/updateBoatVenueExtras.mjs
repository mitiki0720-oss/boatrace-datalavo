import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const todayRaceDetailsPath = path.join(
	projectRoot,
	"public",
	"data",
	"boatrace",
	"today-race-details.generated.json",
);

const venueExtrasPath = path.join(
	projectRoot,
	"public",
	"data",
	"boatrace",
	"venue-extras.generated.json",
);

const OMURA_VENUE_NAME = "大村";
const OMURA_SOURCE = "omurakyotei.jp";
const KARATSU_VENUE_NAME = "唐津";
const KARATSU_SOURCE = "boatrace-karatsu.jp";
const MARUGAME_VENUE_NAME = "丸亀";
const MARUGAME_SOURCE = "marugameboat.jp";
const NARUTO_VENUE_NAME = "鳴門";
const NARUTO_SOURCE = "n14.jp";
const TAMAGAWA_VENUE_NAME = "多摩川";
const TAMAGAWA_SOURCE = "boatrace-tamagawa.com";
const TSU_VENUE_NAME = "津";
const TSU_SOURCE = "boatrace-tsu.com";
const WAKAMATSU_VENUE_NAME = "若松";
const WAKAMATSU_SOURCE = "wmb.jp";
const FUKUOKA_VENUE_NAME = "福岡";
const FUKUOKA_SOURCE = "boatrace-fukuoka.com";
const KOJIMA_VENUE_NAME = "児島";
const KOJIMA_SOURCE = "kojimaboat.jp";
const BIWAKO_VENUE_NAME = "びわこ";
const BIWAKO_SOURCE = "boatrace-biwako.jp";
const BOATRACE_OFFICIAL_SOURCE = "boatrace.jp";
const NARUTO_MOTOR_DATA_URL = "https://www.n14.jp/modules/datafile/";
const NARUTO_TIDE_URL = "https://www.n14.jp/modules/datafile/?page=index_tide_table";
const NARUTO_WATER_SURFACE_URL = "https://www.n14.jp/modules/datafile/?page=index_suimen";
const MARUGAME_MOTOR_DATA_URL = "https://www.marugameboat.jp/asp/htmlmade/marugame/motor/motor02.htm";
const MARUGAME_TIDE_URL = "https://www.marugameboat.jp/01shiomi/shiomi.htm";
const MARUGAME_WATER_SURFACE_URL = "https://www.marugameboat.jp/01suimen/01suimen.htm";
const REQUEST_INTERVAL_MS = 250;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJstTimestamp() {
	const formatter = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	return `${formatter.format(new Date()).replace(" ", "T")}+09:00`;
}

function getJstDate(timestamp) {
	return timestamp.slice(0, 10);
}

function toOmuraDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toOmuraRaceNo(raceNo) {
	return String(raceNo).padStart(2, "0");
}

function normalizeZenkakuDigits(value) {
	return String(value ?? "").replace(/[０-９]/g, (char) =>
		String.fromCharCode(char.charCodeAt(0) - 0xfee0),
	);
}

function compactText(value) {
	return normalizeZenkakuDigits(value)
		.replace(/\u00a0/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function readCleanLines($scope) {
	return $scope
		.text()
		.split(/\r?\n/)
		.map((line) => compactText(line))
		.filter(Boolean);
}

function readCellText($, cell) {
	return compactText($(cell).text());
}

function readCellSegments($, cell) {
	const segments = [];
	let current = "";

	$(cell)
		.contents()
		.each((_, node) => {
			if (node.type === "tag" && node.name === "br") {
				const value = compactText(current);
				if (value) {
					segments.push(value);
				}
				current = "";
				return;
			}

			current += $(node).text();
		});

	const lastValue = compactText(current);
	if (lastValue) {
		segments.push(lastValue);
	}

	return segments;
}

function parseFrameNo(value) {
	const normalized = compactText(value);
	const match = normalized.match(/^[1-6]$/);
	return match ? Number.parseInt(match[0], 10) : null;
}

function parseEmbeddedFrameNo(value) {
	const normalized = compactText(value);
	const match = normalized.match(/[1-6]/);
	return match ? Number.parseInt(match[0], 10) : null;
}

function isValidTimingValue(value) {
	return Boolean(String(value ?? "").trim());
}

async function readTodayRaceDetails() {
	try {
		const text = await readFile(todayRaceDetailsPath, "utf8");
		return JSON.parse(text);
	} catch (error) {
		console.warn(`[venue-extras] today race details read failed: ${error.message}`);
		return null;
	}
}

function findVenue(feed, venueName) {
	if (!feed || !Array.isArray(feed.venues)) {
		return null;
	}

	return feed.venues.find((venue) => venue.venueName === venueName) ?? null;
}

function getRaceList(venue) {
	if (!Array.isArray(venue?.races)) {
		return [];
	}

	return venue.races
		.map((race) => ({
			...race,
			raceNo: Number(race?.raceNo),
		}))
		.filter((race) => Number.isFinite(race.raceNo) && race.raceNo >= 1 && race.raceNo <= 12)
		.sort((left, right) => left.raceNo - right.raceNo);
}

function readRaceFrameNo(value) {
	const frameNo = Number(value);
	return Number.isFinite(frameNo) && frameNo >= 1 && frameNo <= 6 ? frameNo : null;
}

function readRaceString(value) {
	return compactText(value ?? "");
}

function buildOfficialBeforeInfoExhibitionRows(race) {
	if (!Array.isArray(race?.exhibitions)) {
		return [];
	}

	return race.exhibitions
		.map((item) => {
			const frameNo = readRaceFrameNo(item?.frameNo ?? item?.frame ?? item?.lane ?? item?.boatNumber);

			if (!frameNo) {
				return null;
			}

			const playerName = readRaceString(item?.playerName ?? item?.name ?? item?.boatRacerName);
			const exhibitionTime = readRaceString(item?.exhibitionTime ?? item?.displayTime ?? item?.time);
			const tilt = readRaceString(item?.tilt);
			const course = readRaceString(item?.course ?? item?.entryCourse ?? item?.approachCourse);
			const startTiming = readRaceString(item?.startTiming ?? item?.stDisplay);
			const partsExchange = readRaceString(item?.partsExchange);
			const memo = readRaceString(item?.memo);

			if (!playerName && !exhibitionTime && !tilt && !course && !startTiming && !partsExchange && !memo) {
				return null;
			}

			return {
				frameNo,
				playerName,
				exhibitionTime,
				tilt,
				course,
				startTiming,
				partsExchange,
				memo,
				source: BOATRACE_OFFICIAL_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function buildOfficialBeforeInfoStartExhibitionRows(race, exhibitionRows) {
	const rows = [];
	const racerByFrame = new Map(
		(Array.isArray(race?.racers) ? race.racers : [])
			.map((item) => {
				const frameNo = readRaceFrameNo(item?.frameNo ?? item?.frame ?? item?.lane ?? item?.boatNumber);
				return frameNo
					? [frameNo, { averageStart: readRaceString(item?.averageStart ?? item?.averageSt ?? item?.avgSt ?? item?.st) }]
					: null;
			})
			.filter(Boolean),
	);

	for (const item of exhibitionRows) {
		const frameNo = readRaceFrameNo(item?.frameNo);
		const course = readRaceFrameNo(item?.course);
		const startTiming = readRaceString(item?.startTiming);

		if (!frameNo || !course || !startTiming) {
			continue;
		}

		rows.push({
			course,
			frameNo,
			startTiming,
			currentAverageStart: racerByFrame.get(frameNo)?.averageStart ?? "",
			source: BOATRACE_OFFICIAL_SOURCE,
		});
	}

	return rows.sort((left, right) => left.course - right.course);
}

function buildOfficialBeforeInfoScoreQuickLookRows(race) {
	if (!Array.isArray(race?.racers)) {
		return [];
	}

	return race.racers
		.map((item) => {
			const frameNo = readRaceFrameNo(item?.frameNo ?? item?.frame ?? item?.lane ?? item?.boatNumber);

			if (!frameNo) {
				return null;
			}

			const playerName = readRaceString(item?.playerName ?? item?.name ?? item?.boatRacerName);
			const registrationNo = readRaceString(item?.registrationNo ?? item?.racerId);
			const className = readRaceString(item?.class ?? item?.grade ?? item?.rank);
			const averageStart = readRaceString(item?.averageStart ?? item?.averageSt ?? item?.avgSt ?? item?.st);
			const winRate = readRaceString(item?.winRate ?? item?.winningRate);
			const secondRate = readRaceString(item?.secondRate ?? item?.twoRate ?? item?.quinellaRate);
			const localWinRate = readRaceString(item?.localWinRate);
			const localSecondRate = readRaceString(item?.localSecondRate);
			const motorNo = readRaceString(item?.motorNo ?? item?.motorNumber);
			const motorSecondRate = readRaceString(item?.motorSecondRate ?? item?.motorTwoRate ?? item?.motorQuinellaRate);

			if (!playerName && !registrationNo && !averageStart && !winRate && !secondRate && !motorNo && !motorSecondRate) {
				return null;
			}

			return {
				frameNo,
				registrationNo,
				playerName,
				className,
				averageStart,
				winRate,
				secondRate,
				localWinRate,
				localSecondRate,
				motorNo,
				motorSecondRate,
				source: BOATRACE_OFFICIAL_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function buildOfficialBeforeInfoForRace(race) {
	const exhibitionRows = buildOfficialBeforeInfoExhibitionRows(race);
	const startExhibition = buildOfficialBeforeInfoStartExhibitionRows(race, exhibitionRows);
	const scoreQuickLook = buildOfficialBeforeInfoScoreQuickLookRows(race);
	const weatherActual = race?.weatherActual ?? null;
	const hasAny = exhibitionRows.length > 0 || startExhibition.length > 0 || scoreQuickLook.length > 0 || Boolean(weatherActual);

	return {
		status: hasAny ? "available" : "waiting",
		source: BOATRACE_OFFICIAL_SOURCE,
		exhibitionRows,
		startExhibition,
		scoreQuickLook,
		weatherActual,
	};
}

function createOfficialBeforeInfoVenues(feed) {
	if (!feed || !Array.isArray(feed.venues)) {
		return [];
	}

	return feed.venues.map((venue) => {
		const races = getRaceList(venue).map((race) => ({
			raceNo: race.raceNo,
			status: "available",
			source: BOATRACE_OFFICIAL_SOURCE,
			sourceType: "boatrace-official-beforeinfo",
			officialBeforeInfo: buildOfficialBeforeInfoForRace(race),
		}));

		return {
			venueCode: String(venue.venueCode ?? ""),
			venueName: venue.venueName,
			source: BOATRACE_OFFICIAL_SOURCE,
			isAvailable: races.some((race) => race.officialBeforeInfo?.status === "available"),
			status: races.some((race) => race.officialBeforeInfo?.status === "available") ? "available" : "waiting-official-beforeinfo",
			note: "BOATRACE公式の直前情報・スタート展示・得点率早見を別枠で保持",
			races,
		};
	});
}

function mergeVenueRaceRecords(baseRaces, overlayRaces) {
	const raceMap = new Map((Array.isArray(baseRaces) ? baseRaces : []).map((race) => [Number(race?.raceNo), race]));

	for (const race of Array.isArray(overlayRaces) ? overlayRaces : []) {
		const raceNo = Number(race?.raceNo);
		if (!Number.isFinite(raceNo)) {
			continue;
		}

		const existing = raceMap.get(raceNo) ?? { raceNo };
		raceMap.set(raceNo, {
			...existing,
			...race,
			officialBeforeInfo: mergeOfficialBeforeInfo(existing.officialBeforeInfo, race?.officialBeforeInfo),
		});
	}

	return Array.from(raceMap.values()).sort((left, right) => Number(left.raceNo) - Number(right.raceNo));
}

function mergeRowsByFrame(baseRows, overlayRows) {
	const rowMap = new Map();

	for (const row of Array.isArray(baseRows) ? baseRows : []) {
		const frameNo = readRaceFrameNo(row?.frameNo);
		if (frameNo) {
			rowMap.set(frameNo, row);
		}
	}

	for (const row of Array.isArray(overlayRows) ? overlayRows : []) {
		const frameNo = readRaceFrameNo(row?.frameNo);
		if (!frameNo) {
			continue;
		}

		const existing = rowMap.get(frameNo) ?? { frameNo };
		const merged = { ...existing };

		for (const [key, value] of Object.entries(row ?? {})) {
			if (value === undefined || value === null) {
				continue;
			}

			if (Array.isArray(value)) {
				merged[key] = value.length > 0 ? value : (Array.isArray(existing[key]) ? existing[key] : []);
				continue;
			}

			if (typeof value === "string") {
				merged[key] = value !== "" ? value : (typeof existing[key] === "string" ? existing[key] : "");
				continue;
			}

			merged[key] = value;
		}

		rowMap.set(frameNo, merged);
	}

	return Array.from(rowMap.values()).sort((left, right) => left.frameNo - right.frameNo);
}

function mergeOfficialBeforeInfo(baseInfo, overlayInfo) {
	if (!baseInfo) {
		return overlayInfo ?? null;
	}

	if (!overlayInfo) {
		return baseInfo;
	}

	return {
		...baseInfo,
		...overlayInfo,
		exhibitionRows: overlayInfo.exhibitionRows ?? baseInfo.exhibitionRows,
		startExhibition: overlayInfo.startExhibition ?? baseInfo.startExhibition,
		scoreQuickLook: mergeRowsByFrame(baseInfo.scoreQuickLook, overlayInfo.scoreQuickLook),
		weatherActual: overlayInfo.weatherActual ?? baseInfo.weatherActual,
	};
}

function mergeVenueRecord(baseVenue, overlayVenue) {
	if (!baseVenue) {
		return overlayVenue;
	}

	if (!overlayVenue) {
		return baseVenue;
	}

	return {
		...baseVenue,
		...overlayVenue,
		races: mergeVenueRaceRecords(baseVenue.races, overlayVenue.races),
	};
}

async function fetchHtml(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0 (compatible; KURARI-DATALAVO/1.0; +https://example.com)",
			"accept-language": "ja,en;q=0.8",
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}

	return response.text();
}

async function fetchTsuHtml(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0",
			"accept-language": "ja,en;q=0.8",
			"referer": "https://www.boatrace-tsu.com/sp/index.php?page=yosou-yosou",
			"x-requested-with": "XMLHttpRequest",
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}

	return response.text();
}

function toTamagawaDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toBiwakoDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toTsuDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toWakamatsuDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toFukuokaDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toKojimaRaceNo(raceNo) {
	return String(Number(raceNo) || "").padStart(2, "0");
}

function toBiwakoRaceInfoUrl({ date, raceNo, kind = 2 }) {
	return `https://www.boatrace-biwako.jp/modules/yosou/cyokuzen.php?day=${toBiwakoDay(date)}&race=${Number(raceNo)}&if=1&kind=${Number(kind)}`;
}

function toBiwakoYosouTabUrl({ date, raceNo, type }) {
	return `https://www.boatrace-biwako.jp/modules/yosou/${type}.php?day=${toBiwakoDay(date)}&race=${Number(raceNo)}&if=1`;
}

function toTamagawaYosouUrl({ day, raceNo, type }) {
	return `https://www.boatrace-tamagawa.com/modules/yosou/${type}.php?day=${day}&race=${Number(raceNo)}&jo=05&if=1`;
}

function toTsuRaceTabUrl({ date, raceNo, req, run = 0 }) {
	return `https://www.boatrace-tsu.com/sp/ajax/ajax_yosou.php?targetday=${toTsuDay(date)}&race=${Number(raceNo)}&req=${req}&run=${Number(run)}`;
}

function toWakamatsuRaceTabUrl({ date, raceNo, type, kind = null }) {
	const url = new URL(`https://www.wmb.jp/modules/yosou/group-${type}.php`);
	url.searchParams.set("day", toWakamatsuDay(date));
	url.searchParams.set("race", String(Number(raceNo)));
	url.searchParams.set("if", "1");
	if (kind !== null && kind !== undefined) {
		url.searchParams.set("kind", String(Number(kind)));
	}
	return url.toString();
}

function toWakamatsuMotorUrl(motorNo) {
	return `https://info.wmb.jp/pc/motor.php?no=${String(motorNo ?? "").padStart(2, "0")}`;
}

function toFukuokaRaceTabUrl({ date, raceNo, type }) {
	const url = new URL(`https://www.boatrace-fukuoka.com/modules/yosou/${type}.php`);
	url.searchParams.set("day", toFukuokaDay(date));
	url.searchParams.set("race", String(Number(raceNo)));
	url.searchParams.set("if", "1");
	url.searchParams.set("nowmode", "1");
	return url.toString();
}

function toFukuokaScoreRankingUrl() {
	return "https://www.boatrace-fukuoka.com/modules/raceinfo/?page=index_tokuten";
}

function toKojimaRaceTabUrl({ raceNo, type, mobile = false }) {
	const device = mobile ? "sp" : "pc";
	return `https://www.kojimaboat.jp/asp/kyogi/16/${device}/${type}${toKojimaRaceNo(raceNo)}.htm`;
}

function toKojimaScoreRankingUrl() {
	return "https://www.kojimaboat.jp/asp/htmlmade/kojima/rank/rank.htm";
}

function toKojimaCourseUrl() {
	return "https://www.kojimaboat.jp/asp/htmlmade/kojima/course/course.htm";
}

function toKojimaMotorInfoUrl() {
	return "https://www.kojimaboat.jp/01motor/01motor.htm";
}

async function fetchFukuokaHtml(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0",
			"accept-language": "ja,en;q=0.8",
			"referer": "https://www.boatrace-fukuoka.com/modules/yosou/",
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}

	return response.text();
}

async function fetchKojimaHtml(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0",
			"accept-language": "ja,en;q=0.8",
			"referer": "https://www.kojimaboat.jp/",
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}

	return response.text();
}

function findTableByKeywords($, keywords) {
	return $("table")
		.toArray()
		.find((table) => {
			const text = compactText($(table).text()).replaceAll(" ", "");
			return keywords.every((keyword) => text.includes(compactText(keyword).replaceAll(" ", "")));
		}) ?? null;
}

function parseTamagawaIdentity($, cell) {
	const lines = $(cell)
		.find("li")
		.toArray()
		.map((item) => readCellText($, item))
		.filter(Boolean);

	if (lines.length >= 3) {
		const [className = "", registerNo = ""] = String(lines[0] ?? "").split("/").map((value) => compactText(value));
		return {
			className,
			registerNo,
			playerName: compactText(lines[1]),
			profile: compactText(lines[2]),
		};
	}

	const text = compactText($(cell).text());
	const match = text.match(/^([AB][12])\/(\d+)\s+(.+?)\s+([^\s].*)$/);

	return {
		className: match?.[1] ?? "",
		registerNo: match?.[2] ?? "",
		playerName: compactText(match?.[3] ?? ""),
		profile: compactText(match?.[4] ?? ""),
	};
}

function parseBiwakoIdentity($, cell) {
	const registrationNo = readCellText($, $(cell).find(".com-toban").first());
	const profile = readCellText($, $(cell).find(".com-subinfo").first());
	const className = compactText(String(profile).split("/")[0] ?? "");

	return {
		registrationNo,
		registerNo: registrationNo,
		playerName: readCellText($, $(cell).find(".com-rname").first()),
		profile,
		className,
	};
}

function parseBiwakoStartLaneOffset(value) {
	const matched = String(value ?? "").match(/left:([\-\d.]+)px/);
	const laneOffset = Number.parseFloat(matched?.[1] ?? "NaN");
	return Number.isFinite(laneOffset) ? laneOffset : null;
}

function parseTsuIdentity($, cell) {
	const lines = $(cell)
		.find("li")
		.toArray()
		.map((item) => readCellText($, item))
		.filter(Boolean);

	if (lines.length >= 2) {
		const profile = compactText(lines[1]);
		const [registrationNo = "", branch = "", age = "", className = ""] = profile.split("/").map((value) => compactText(value));

		return {
			registrationNo,
			registerNo: registrationNo,
			playerName: compactText(lines[0]),
			profile,
			className,
			branch,
			age,
		};
	}

	return {
		registrationNo: "",
		registerNo: "",
		playerName: "",
		profile: "",
		className: "",
		branch: "",
		age: "",
	};
}

function parseTsuPlayersInfoMap(html) {
	const $ = load(html);
	const table = $(".players_info_tbl").first().get(0);

	if (!table) {
		return new Map();
	}

	const rows = new Map();
	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 7) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			rows.set(frameNo, {
				frameNo,
				registrationNo: readCellText($, cells[1]),
				registerNo: readCellText($, cells[1]),
				playerName: readCellText($, cells[2]),
				className: readCellText($, cells[3]),
				branch: readCellText($, cells[4]),
				birthPlace: readCellText($, cells[5]),
				age: readCellText($, cells[6]),
				profile: [readCellText($, cells[1]), readCellText($, cells[4]), readCellText($, cells[6]), readCellText($, cells[3])].filter(Boolean).join("/"),
			});
		});

	return rows;
}

function parseTsuBeforeInfo(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["展示評価", "前走成績", "部品交換"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = trList[1] ? $(trList[1]).children("td,th").toArray() : [];

			if (firstCells.length < 6) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[1]));
			if (!frameNo) {
				return;
			}

			const identity = parseTsuIdentity($, firstCells[2]);

			rows.push({
				frameNo,
				...identity,
				exhibitionEvaluation: readCellText($, firstCells[0]),
				weight: readCellText($, firstCells[3]),
				weightAdjustment: readCellText($, firstCells[4]),
				tilt: readCellText($, firstCells[5]),
				previousRaceNo: readCellText($, firstCells[6]),
				previousRaceCourse: readCellText($, firstCells[7]),
				previousRaceStartTiming: readCellText($, firstCells[8]),
				previousRaceFinishOrder: readCellText($, firstCells[9]),
				partsExchange: readCellText($, secondCells[0]),
				source: TSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTsuStartExhibition(html) {
	const $ = load(html);
	const table = $("table.tenji").first().get(0) ?? findTableByKeywords($, ["展示タイム", "今節", "スタート展示"]);

	if (!table) {
		return [];
	}

	const visualRows = [];
	$(table)
		.find("td.com-yosou-suimen .suimen_div")
		.each((index, element) => {
			const imageSrc = $(element).find("img.boat").attr("src") ?? "";
			const frameNo = Number.parseInt(imageSrc.match(/img_boat-0?([1-6])\.png/)?.[1] ?? "", 10);
			if (!Number.isFinite(frameNo)) {
				return;
			}

			const leftValue = Number.parseFloat((($(element).find("img.boat").attr("style") ?? "").match(/left:([\-\d.]+)%/)?.[1]) ?? "NaN");
			visualRows.push({
				course: index + 1,
				frameNo,
				startTiming: compactText($(element).find(".st_area").text()),
				startLaneOffset: Number.isFinite(leftValue) ? leftValue : null,
			});
		});

	const visualMap = new Map(visualRows.map((row) => [row.frameNo, row]));
	const rows = [];
	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 4) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTsuIdentity($, cells[1]);
			const visual = visualMap.get(frameNo) ?? { course: rows.length + 1, startTiming: "", startLaneOffset: null };

			rows.push({
				course: visual.course,
				frameNo,
				playerName: identity.playerName,
				className: identity.className,
				registerNo: identity.registerNo,
				exhibitionTime: readCellText($, cells[2]),
				currentAverageStart: readCellText($, cells[3]),
				startTiming: visual.startTiming,
				startOrder: String(visual.course),
				startLaneOffset: visual.startLaneOffset,
				source: TSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.course - right.course);
}

function parseTsuOriginalExhibition(html) {
	const $ = load(html);
	const table = $(".tbl_oriten").first().get(0) ?? findTableByKeywords($, ["一周", "まわり", "直線"]);

	if (!table) {
		return [];
	}

	const identityMap = parseTsuPlayersInfoMap(html);
	const rows = [];
	$(table)
		.find("tbody tr")
		.each((rowIndex, rowElement) => {
			if (rowIndex % 2 !== 0) {
				return;
			}

			const firstCells = $(rowElement).children("td,th").toArray();
			const secondCells = $(rowElement).next("tr").children("td,th").toArray();
			if (firstCells.length < 7) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = identityMap.get(frameNo) ?? { frameNo };
			rows.push({
				frameNo,
				registrationNo: identity.registrationNo ?? "",
				registerNo: identity.registerNo ?? "",
				playerName: identity.playerName ?? "",
				profile: identity.profile ?? "",
				className: identity.className ?? "",
				weight: readCellText($, firstCells[1]),
				weightAdjustment: readCellText($, secondCells[0]),
				tilt: readCellText($, firstCells[2]),
				exhibitionTime: readCellText($, firstCells[3]),
				oneLapTime: readCellText($, firstCells[4]),
				turnTime: readCellText($, firstCells[5]),
				straightTime: readCellText($, firstCells[6]),
				exhibitionEvaluation: "",
				memo: "津公式 オリジナル展示から取得",
				source: TSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTsuRacerComments(html) {
	const $ = load(html);
	const table = $(".tbl_comment").first().get(0) ?? findTableByKeywords($, ["選手コメント", "過去コメント"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 3) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTsuIdentity($, cells[1]);
			rows.push({
				frameNo,
				registerNo: identity.registerNo,
				className: identity.className,
				playerName: identity.playerName,
				profile: identity.profile,
				comment: readCellText($, $(cells[2]).find(".z_comment").first() || cells[2]),
				motorComment: "",
				source: TSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTsuSeriesResults(html) {
	const $ = load(html);
	const table = $(".category-setsukan table").first().get(0) ?? findTableByKeywords($, ["初日", "ST", "着"]);

	if (!table) {
		return [];
	}

	const identityMap = parseTsuPlayersInfoMap(html);
	const dayLabels = $(table)
		.find("thead tr")
		.first()
		.children("th")
		.toArray()
		.slice(2)
		.flatMap((cell) => {
			const label = readCellText($, cell);
			const spanCount = Number.parseInt($(cell).attr("colspan") ?? "1", 10);
			if (!label) {
				return [];
			}
			const repeatCount = Number.isFinite(spanCount) && spanCount > 0 ? spanCount : 1;
			return Array.from({ length: repeatCount }, () => label);
		})
		.slice(0, 12);

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			if (firstCells.length < 4) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = identityMap.get(frameNo) ?? { registerNo: "", className: "", playerName: "", profile: "" };
			const labeledRows = trList.map((rowElement, rowIndex) => {
				const cells = $(rowElement).children("td,th").toArray();
				const values = (rowIndex === 0 ? cells.slice(1) : cells).map((cell) => readCellText($, cell));
				return {
					label: values[0] ?? "",
					values: values.slice(1, 13),
				};
			});
			const rowMap = new Map(labeledRows.map((item) => [item.label, item.values]));

			rows.push({
				frameNo,
				className: identity.className ?? "",
				registerNo: identity.registerNo ?? "",
				playerName: identity.playerName ?? "",
				profile: identity.profile ?? "",
				raceNumbers: rowMap.get("R") ?? [],
				courses: rowMap.get("進") ?? [],
				startTimings: rowMap.get("ST") ?? [],
				finishOrders: rowMap.get("着") ?? [],
				dayLabels,
				source: TSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTsuRecent3(html, { local = false } = {}) {
	const $ = load(html);
	const selector = local ? ".tbl_touchi" : ".tbl_zenkoku";
	const table = $(selector).first().get(0) ?? findTableByKeywords($, local ? ["近況成績", "前節", "2節前", "3節前"] : ["全国成績", "前節", "2節前", "3節前"]);

	if (!table) {
		return [];
	}

	const identityMap = parseTsuPlayersInfoMap(html);
	const labels = ["1節前", "2節前", "3節前"];
	const rows = [];
	const trList = $(table).find("tbody tr").toArray();

	for (let rowIndex = 0; rowIndex + 1 < trList.length; rowIndex += 2) {
		const mainCells = $(trList[rowIndex]).children("td,th").toArray();
		const subCells = $(trList[rowIndex + 1]).children("td,th").toArray();
		if (mainCells.length < 4 || subCells.length < 3) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, mainCells[0]));
		if (!frameNo) {
			continue;
		}

		const identity = identityMap.get(frameNo) ?? { registerNo: "", className: "", playerName: "", profile: "" };
		const histories = mainCells.slice(1, 4).map((cell, historyIndex) => {
			const cellScope = $(cell);
			const grade = readCellText($, cellScope.find(".item_grade").first());
			const venueName = local ? "津" : readCellText($, cellScope.find(".item_jo_name").first());
			const dateRange = readCellText($, cellScope.find(".item_date").first());
			const resultCell = subCells[historyIndex] ?? null;

			return {
				label: labels[historyIndex] ?? `${historyIndex + 1}節前`,
				venueName,
				grade,
				dateRange,
				results: readCellText($, resultCell),
			};
		});

		rows.push({
			frameNo,
			className: identity.className ?? "",
			registerNo: identity.registerNo ?? "",
			playerName: identity.playerName ?? "",
			profile: identity.profile ?? "",
			histories,
			source: TSU_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTsuNationalRecent3(html) {
	return parseTsuRecent3(html, { local: false });
}

function parseTsuLocalRecent3(html) {
	return parseTsuRecent3(html, { local: true });
}

function parseTsuFramePast10(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["枠番別データ", "平均ST"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = trList[1] ? $(trList[1]).children("td,th").toArray() : [];
			if (firstCells.length < 14) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			rows.push({
				frameNo,
				courseHistory: firstCells.slice(2, 12).map((cell) => readCellText($, cell)).slice(0, 10),
				finishHistory: secondCells.slice(1, 11).map((cell) => readCellText($, cell)).slice(0, 10),
				startTimingHistory: [],
				frameWinRate: readCellText($, firstCells[12]),
				frameAverageStart: readCellText($, firstCells[13]),
				frameStartOrder: readCellText($, secondCells[11]),
				source: TSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTsuScoreRateGuide(html) {
	const $ = load(html);
	const table = $(".category-tokuten table").first().get(0) ?? findTableByKeywords($, ["得点率", "1着", "6着"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 10) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			rows.push({
				frameNo,
				registrationNo: "",
				playerName: "",
				className: "",
				averageStart: "",
				winRate: "",
				secondRate: "",
				localWinRate: "",
				localSecondRate: "",
				motorNo: "",
				motorSecondRate: "",
				scoreRate: readCellText($, cells[1]),
				scoreRank: readCellText($, cells[2]),
				scoreAfterFirst: readCellText($, cells[3]),
				scoreAfterSecond: readCellText($, cells[4]),
				scoreAfterThird: readCellText($, cells[5]),
				scoreAfterFourth: readCellText($, cells[6]),
				scoreAfterFifth: readCellText($, cells[7]),
				scoreAfterSixth: readCellText($, cells[8]),
				scoreBorderMemo: readCellText($, cells[9]),
				source: TSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuIdentity($, cell) {
	const lines = $(cell)
		.find("li")
		.toArray()
		.map((item) => readCellText($, item))
		.filter(Boolean);

	if (lines.length >= 3) {
		const head = compactText(lines[0]);
		const match = head.match(/^([AB][12])\s*(\d+)$/);
		return {
			className: match?.[1] ?? "",
			registrationNo: match?.[2] ?? "",
			registerNo: match?.[2] ?? "",
			playerName: compactText(lines[1]),
			profile: compactText(lines[2]),
		};
	}

	return {
		className: "",
		registrationNo: "",
		registerNo: "",
		playerName: "",
		profile: "",
	};
}

function parseWakamatsuEntryTable(html) {
	const $ = load(html);
	const table = $(".category-syussou table").first().get(0) ?? findTableByKeywords($, ["平均 ST", "モーター", "ボート"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			if (firstCells.length < 13) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[2]));
			if (!frameNo) {
				return;
			}

			const identity = parseWakamatsuIdentity($, firstCells[3]);
			const national = readCellSegments($, firstCells[6]);
			const local = readCellSegments($, firstCells[7]);
			const motor = readCellSegments($, firstCells[8]);
			const boat = readCellSegments($, firstCells[9]);
			const commentTexts = $(firstCells[10])
				.find(".comment_text")
				.toArray()
				.map((element) => readCellText($, element))
				.filter(Boolean);
			const motorEvaluationLines = trList
				.map((rowElement) => readCellText($, $(rowElement).children("td,th").filter(".col11").first()))
				.filter(Boolean);
			const motorLink = $(firstCells[8]).find("a[data-url]").first().attr("data-url") ?? "";
			const boatLink = $(firstCells[9]).find("a[data-url]").first().attr("data-url") ?? "";

			rows.push({
				frameNo,
				...identity,
				fl: readCellText($, firstCells[4]),
				averageStart: readCellText($, firstCells[5]),
				nationalWinRate: national[0] ?? "",
				nationalSecondRate: national[1] ?? "",
				localWinRate: local[0] ?? "",
				localSecondRate: local[1] ?? "",
				motorNo: motor[0] ?? "",
				motorSecondRate: motor[1] ?? "",
				boatNo: boat[0] ?? "",
				boatSecondRate: boat[1] ?? "",
				comment: commentTexts.join(" / "),
				motorEvaluation: motorEvaluationLines.join(" / "),
				motorEvaluationLines,
				earlyGuide: readCellText($, firstCells[12]),
				motorDetailUrl: motorLink ? new URL(motorLink, "https://www.wmb.jp/").toString() : "",
				boatHistoryUrl: boatLink ? new URL(boatLink, "https://www.wmb.jp/").toString() : "",
				source: WAKAMATSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuRacerComments(html) {
	return parseWakamatsuEntryTable(html)
		.map((row) => ({
			frameNo: row.frameNo,
			registerNo: row.registerNo,
			className: row.className,
			playerName: row.playerName,
			profile: row.profile,
			comment: row.comment,
			motorComment: row.motorEvaluation,
			source: WAKAMATSU_SOURCE,
		}))
		.filter((row) => row.comment || row.motorComment);
}

function parseWakamatsuBeforeInfo(html) {
	const $ = load(html);
	const table = $(".category-cyokuzen table").first().get(0) ?? findTableByKeywords($, ["展示タイム", "前走成績", "部品交換"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = trList[1] ? $(trList[1]).children("td,th").toArray() : [];
			if (firstCells.length < 9) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseWakamatsuIdentity($, firstCells[1]);
			const weightSegments = readCellSegments($, firstCells[3]);

			rows.push({
				frameNo,
				...identity,
				exhibitionTime: readCellText($, firstCells[2]),
				weight: weightSegments[0] ?? "",
				weightAdjustment: weightSegments[1] ?? "",
				tilt: readCellText($, firstCells[4]),
				previousRaceNo: readCellText($, firstCells[5]),
				previousRaceCourse: readCellText($, firstCells[6]),
				previousRaceStartTiming: readCellText($, firstCells[7]),
				previousRaceFinishOrder: readCellText($, firstCells[8]),
				previousRaceInfo: firstCells.slice(5, 9).map((cell) => readCellText($, cell)).filter(Boolean).join(" / "),
				partsExchange: readCellText($, secondCells[0]),
				source: WAKAMATSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuWeatherActual(html) {
	const $ = load(html);
	const table = $(".tbl_suimen").first().get(0);
	if (!table) {
		return null;
	}

	const bodyRows = $(table).find("tbody tr").toArray();
	if (bodyRows.length < 2) {
		return null;
	}

	const firstValues = $(bodyRows[0]).children("td,th").toArray().map((cell) => readCellText($, cell));
	const secondValues = $(bodyRows[1]).children("td,th").toArray().map((cell) => readCellText($, cell));
	const directionClass = $(".sumimen_direction_block .direction").first().attr("class") ?? "";
	const directionCode = directionClass.match(/sumimen_direction(\d+)/)?.[1] ?? "";

	if (!firstValues.length && !secondValues.length) {
		return null;
	}

	return {
		weather: firstValues[0] ?? "",
		windDirectionText: firstValues[1] ?? "",
		windSpeed: firstValues[2] ?? "",
		waveHeight: secondValues[0] ?? "",
		airTemperature: secondValues[1] ?? "",
		waterTemperature: secondValues[2] ?? "",
		windDirectionCode: directionCode,
		source: WAKAMATSU_SOURCE,
	};
}

function parseWakamatsuStartExhibition(html) {
	const $ = load(html);
	const table = $(".category-tenji table").first().get(0) ?? findTableByKeywords($, ["スタート展示", "今節平均", "スタート順"]);

	if (!table) {
		return [];
	}

	const startVisualMap = new Map();
	$(table)
		.find("td.com-yosou-suimen .suimen_div")
		.each((_, element) => {
			const imageSrc = $(element).find("img.boat").attr("src") ?? "";
			const frameNo = Number.parseInt(imageSrc.match(/img_boat_([1-6])\.png/)?.[1] ?? "", 10);
			const leftValue = Number.parseFloat((($(element).find("img.boat").attr("style") ?? "").match(/left:([\-\d.]+)%/)?.[1]) ?? "NaN");

			if (!Number.isFinite(frameNo)) {
				return;
			}

			startVisualMap.set(frameNo, {
				startType: readCellText($, $(element).find(".sd_area").first()),
				startTiming: readCellText($, $(element).find(".st_area").first()),
				startLaneOffset: Number.isFinite(leftValue) ? leftValue : null,
			});
		});

	const rows = [];
	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 5) {
				return;
			}

			const course = parseFrameNo(readCellText($, cells[0]));
			const frameNo = parseFrameNo(readCellText($, cells[1]));
			if (!course || !frameNo) {
				return;
			}

			const identity = parseWakamatsuIdentity($, cells[2]);
			const visual = startVisualMap.get(frameNo) ?? { startType: "", startTiming: "", startLaneOffset: null };

			rows.push({
				course,
				frameNo,
				playerName: identity.playerName,
				className: identity.className,
				registerNo: identity.registerNo,
				currentAverageStart: readCellText($, cells[3]),
				startOrder: readCellText($, cells[4]),
				startType: visual.startType,
				startTiming: visual.startTiming,
				startLaneOffset: visual.startLaneOffset,
				source: WAKAMATSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.course - right.course);
}

function parseWakamatsuOriginalExhibition(html) {
	const $ = load(html);
	const table = $(".category-oriten table").first().get(0) ?? findTableByKeywords($, ["一周", "まわり足", "直線"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const bodyRows = $(table).find("tbody tr").toArray();
	for (let rowIndex = 0; rowIndex + 1 < bodyRows.length; rowIndex += 2) {
		const firstCells = $(bodyRows[rowIndex]).children("td,th").toArray();
		const secondCells = $(bodyRows[rowIndex + 1]).children("td,th").toArray();
		if (firstCells.length < 8) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[0]));
		if (!frameNo) {
			continue;
		}

		const identity = parseWakamatsuIdentity($, firstCells[1]);
		rows.push({
			frameNo,
			...identity,
			weight: readCellText($, firstCells[2]),
			weightAdjustment: readCellText($, secondCells[0]),
			tilt: readCellText($, firstCells[3]),
			exhibitionTime: readCellText($, firstCells[4]),
			oneLapTime: readCellText($, firstCells[5]),
			turnTime: readCellText($, firstCells[6]),
			straightTime: readCellText($, firstCells[7]),
			exhibitionEvaluation: "",
			memo: "若松公式 オリジナル展示データから取得",
			source: WAKAMATSU_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuSeriesResults(html) {
	const $ = load(html);
	const table = $(".category-setsukan table").first().get(0) ?? findTableByKeywords($, ["初日", "ST", "着"]);

	if (!table) {
		return [];
	}

	const dayLabels = $(table)
		.find("thead .nichime")
		.toArray()
		.flatMap((cell) => {
			const label = readCellText($, cell);
			const spanCount = Number.parseInt($(cell).attr("colspan") ?? "1", 10);
			if (!label) {
				return [];
			}
			const repeatCount = Number.isFinite(spanCount) && spanCount > 0 ? spanCount : 1;
			return Array.from({ length: repeatCount }, () => label);
		})
		.slice(0, 16);

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			if (firstCells.length < 5) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseWakamatsuIdentity($, firstCells[1]);
			const labeledRows = trList.map((rowElement, rowIndex) => {
				const cells = $(rowElement).children("td,th").toArray();
				const values = (rowIndex === 0 ? cells.slice(2) : cells).map((cell) => readCellText($, cell));
				return {
					label: values[0] ?? "",
					values: values.slice(1, 17),
				};
			});
			const rowMap = new Map(labeledRows.map((item) => [item.label, item.values]));

			rows.push({
				frameNo,
				className: identity.className,
				registerNo: identity.registerNo,
				playerName: identity.playerName,
				profile: identity.profile,
				raceNumbers: rowMap.get("R") ?? [],
				courses: rowMap.get("進") ?? [],
				startTimings: rowMap.get("ST") ?? [],
				startOrders: rowMap.get("S順") ?? [],
				finishOrders: rowMap.get("着") ?? [],
				dayLabels,
				source: WAKAMATSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuCourseStats(html) {
	const $ = load(html);
	const table = $(".category-racecourse table").first().get(0) ?? findTableByKeywords($, ["進入コース", "進入回数", "平均ST"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			if (firstCells.length < 8) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseWakamatsuIdentity($, firstCells[1]);
			const courseRows = trList
				.map((rowElement) => {
					const cells = $(rowElement).children("td,th").toArray();
					const values = cells.length >= 8 ? cells.slice(2) : cells;
					return {
						courseNo: parseFrameNo(readCellText($, values[0])) ?? null,
						entryCount: readCellText($, values[1]),
						averageStart: readCellText($, values[2]),
						firstCount: readCellText($, values[3]),
						secondCount: readCellText($, values[4]),
						thirdCount: readCellText($, values[5]),
					};
				})
				.filter((row) => row.courseNo);

			rows.push({
				frameNo,
				className: identity.className,
				registerNo: identity.registerNo,
				playerName: identity.playerName,
				profile: identity.profile,
				courseRows,
				source: WAKAMATSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuRecent3(html, { local = false } = {}) {
	const $ = load(html);
	const selector = local ? ".category-touchi table" : ".category-zenkoku table";
	const table = $(selector).first().get(0) ?? findTableByKeywords($, ["前節", "2節前", "3節前"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tbody tr").toArray();
	const labels = ["1節前", "2節前", "3節前"];

	for (let rowIndex = 0; rowIndex + 1 < trList.length; rowIndex += 2) {
		const mainCells = $(trList[rowIndex]).children("td,th").toArray();
		const subCells = $(trList[rowIndex + 1]).children("td,th").toArray();
		if (mainCells.length < 5 || subCells.length < 3) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, mainCells[0]));
		if (!frameNo) {
			continue;
		}

		const identity = parseWakamatsuIdentity($, mainCells[1]);
		const histories = mainCells.slice(2, 5).map((cell, historyIndex) => {
			const cellScope = $(cell);
			return {
				label: labels[historyIndex] ?? `${historyIndex + 1}節前`,
				venueName: local ? WAKAMATSU_VENUE_NAME : readCellText($, cellScope.find(".item_jo_name").first()),
				grade: readCellText($, cellScope.find(".item_grade").first()),
				dateRange: readCellText($, cellScope.find(".item_date").first()),
				results: readCellText($, subCells[historyIndex]),
			};
		});

		rows.push({
			frameNo,
			className: identity.className,
			registerNo: identity.registerNo,
			playerName: identity.playerName,
			profile: identity.profile,
			histories,
			source: WAKAMATSU_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuNationalRecent3(html) {
	return parseWakamatsuRecent3(html, { local: false });
}

function parseWakamatsuLocalRecent3(html) {
	return parseWakamatsuRecent3(html, { local: true });
}

function parseWakamatsuFramePast10(html) {
	const $ = load(html);
	const table = $(".category-waku10 table").first().get(0) ?? findTableByKeywords($, ["枠番別データ", "平均ST"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = trList[1] ? $(trList[1]).children("td,th").toArray() : [];
			if (firstCells.length < 16) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			rows.push({
				frameNo,
				courseHistory: firstCells.slice(3, 13).map((cell) => readCellText($, cell)).slice(0, 10),
				finishHistory: secondCells.slice(1, 11).map((cell) => readCellText($, cell)).slice(0, 10),
				startTimingHistory: [],
				frameWinRate: readCellText($, firstCells[13]),
				frameAverageStart: readCellText($, firstCells[14]),
				frameStartOrder: readCellText($, firstCells[15]),
				source: WAKAMATSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuScoreRateGuide(html) {
	const $ = load(html);
	const table = $(".category-tokuhayami table").first().get(0) ?? findTableByKeywords($, ["得点率", "1着", "6着"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 9) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const identity = cells.length >= 11 ? parseWakamatsuIdentity($, cells[1]) : { registrationNo: "", playerName: "", className: "" };
			const offset = cells.length >= 11 ? 2 : 1;

			rows.push({
				frameNo,
				registrationNo: identity.registrationNo ?? "",
				playerName: identity.playerName ?? "",
				className: identity.className ?? "",
				averageStart: "",
				winRate: "",
				secondRate: "",
				localWinRate: "",
				localSecondRate: "",
				motorNo: "",
				motorSecondRate: "",
				scoreRate: readCellText($, cells[offset]),
				scoreRank: readCellText($, cells[offset + 1]),
				scoreAfterFirst: readCellText($, cells[offset + 2]),
				scoreAfterSecond: readCellText($, cells[offset + 3]),
				scoreAfterThird: readCellText($, cells[offset + 4]),
				scoreAfterFourth: readCellText($, cells[offset + 5]),
				scoreAfterFifth: readCellText($, cells[offset + 6]),
				scoreAfterSixth: readCellText($, cells[offset + 7]),
				scoreBorderMemo: readCellText($, cells[offset + 8]),
				source: WAKAMATSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseWakamatsuMotorHistory(html, entryRow) {
	const $ = load(html);
	const summaryCells = $("#MotorSeiseki tr").eq(1).children("td,th").toArray();
	const sectionEntries = [];

	$(".motor_p")
		.toArray()
		.forEach((section) => {
			const sectionScope = $(section);
			const seriesTitle = readCellText($, sectionScope.find("h4").first());
			if (!seriesTitle) {
				return;
			}

			const usedText = readCellText($, sectionScope.find(".text-center").first());
			if (usedText.includes("使用されていません")) {
				sectionEntries.push({
					seriesTitle,
					registerNo: "",
					playerName: "",
					results: [],
					note: usedText,
				});
				return;
			}

			const racerText = compactText(sectionScope.find(".msenshu .senshuwaku").text());
			const racerMatch = racerText.match(/(\d+)\/(.+)$/);
			const results = [];
			sectionScope
				.find("table.motor_table tr")
				.slice(1)
				.each((_, rowElement) => {
					const cells = $(rowElement).children("td,th").toArray();
					if (cells.length < 9) {
						return;
					}

					results.push({
						dayLabel: readCellText($, cells[0]),
						raceNo: readCellText($, cells[1]),
						raceName: readCellText($, cells[2]),
						frameNo: readCellText($, cells[3]),
						finishOrder: readCellText($, cells[4]),
						course: readCellText($, cells[5]),
						startTiming: readCellText($, cells[6]),
						winningMove: readCellText($, cells[7]),
						maintenance: readCellText($, cells[8]),
					});
				});

			sectionEntries.push({
				seriesTitle,
				registerNo: racerMatch?.[1] ?? "",
				playerName: compactText(racerMatch?.[2] ?? ""),
				results,
				note: "",
			});
		});

	const firstUsed = sectionEntries.find((entry) => entry.playerName || entry.results.length > 0) ?? { playerName: "", results: [] };
	const bestResults = summaryCells.map((cell) => readCellText($, cell));

	return {
		motorSummary: {
			frameNo: entryRow.frameNo,
			motorNo: entryRow.motorNo,
			previousUser: firstUsed.playerName,
			recentResults: firstUsed.results.slice(0, 3).map((result) => [result.dayLabel, result.raceNo, result.finishOrder].filter(Boolean).join(" ")).filter(Boolean).join(" / "),
			motorGrade: bestResults[1] ?? "",
			comment: `勝率 ${bestResults[0] ?? "-"} / 2連率 ${bestResults[1] ?? "-"} / 優出 ${bestResults[9] ?? "-"} / 優勝 ${bestResults[10] ?? "-"}`,
			source: WAKAMATSU_SOURCE,
		},
		motorHistory: {
			frameNo: entryRow.frameNo,
			className: entryRow.className,
			registerNo: entryRow.registerNo,
			playerName: entryRow.playerName,
			profile: entryRow.profile,
			motorNo: entryRow.motorNo,
			motorWinRate: bestResults[0] ?? "",
			motorSecondRate: bestResults[1] ?? "",
			firstCount: bestResults[2] ?? "",
			secondCount: bestResults[3] ?? "",
			thirdCount: bestResults[4] ?? "",
			fourthCount: bestResults[5] ?? "",
			fifthCount: bestResults[6] ?? "",
			sixthCount: bestResults[7] ?? "",
			starts: bestResults[8] ?? "",
			finals: bestResults[9] ?? "",
			championships: bestResults[10] ?? "",
			bestExhibitionTime: bestResults[11] ?? "",
			bestOneLapTime: bestResults[12] ?? "",
			bestStraightTime: bestResults[13] ?? "",
			bestTurnTime: bestResults[14] ?? "",
			bestTime: bestResults[15] ?? "",
			historyEntries: sectionEntries,
			source: WAKAMATSU_SOURCE,
		},
	};
}

function parseBiwakoPartsExchangeMap(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["部品交換", "展示タイム", "体重"]);

	if (!table) {
		return new Map();
	}

	const rowMap = new Map();

	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const rows = $(tbody).find("tr").toArray();
			const firstCells = $(rows[0]).children("td,th").toArray();
			const partsCell = rows[2] ? $(rows[2]).children("td,th").first() : null;
			const frameNo = parseFrameNo(readCellText($, firstCells[0]));

			if (!frameNo) {
				return;
			}

			rowMap.set(frameNo, readCellText($, partsCell));
		});

	return rowMap;
}

function parseBiwakoOriginalExhibition(html) {
	const $ = load(html);
	const table =
		$(".cyokuzen.oriten table")
			.toArray()
			.find((element) => {
				const sectionText = compactText($(element).closest(".yosou, .cyokuzen, body").text()).replaceAll(" ", "");
				return sectionText.includes("オリジナル展示") && sectionText.includes("一周") && sectionText.includes("まわり足") && sectionText.includes("直線");
			}) ?? findTableByKeywords($, ["一周", "まわり足", "直線"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tbody tr").toArray();

	for (let rowIndex = 0; rowIndex < trList.length; rowIndex += 2) {
		const firstCells = $(trList[rowIndex]).children("td,th").toArray();
		const secondCells = trList[rowIndex + 1] ? $(trList[rowIndex + 1]).children("td,th").toArray() : [];

		if (firstCells.length < 8) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[0]));
		if (!frameNo) {
			continue;
		}

		const identity = parseBiwakoIdentity($, firstCells[1]);

		rows.push({
			frameNo,
			registrationNo: identity.registrationNo,
			playerName: identity.playerName,
			profile: identity.profile,
			weight: readCellText($, firstCells[2]),
			weightAdjustment: readCellText($, secondCells[0]),
			tilt: readCellText($, firstCells[3]),
			exhibitionTime: readCellText($, firstCells[4]),
			oneLapTime: readCellText($, firstCells[5]),
			turnTime: readCellText($, firstCells[6]),
			straightTime: readCellText($, firstCells[7]),
			exhibitionEvaluation: "",
			memo: "びわこ公式 オリジナル展示から取得",
			source: BIWAKO_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseBiwakoStartExhibition(html) {
	const $ = load(html);
	const table = $(".cyokuzen.st table").first().get(0) ?? findTableByKeywords($, ["スタート順", "ST"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody tr")
		.each((rowIndex, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();

			if (cells.length < 8) {
				return;
			}

			const course = parseFrameNo(readCellText($, cells[0])) ?? rowIndex + 1;
			const frameNo = parseFrameNo(readCellText($, cells[1]));
			if (!frameNo) {
				return;
			}

			const identity = parseBiwakoIdentity($, cells[2]);
			const laneOffset = parseBiwakoStartLaneOffset($(cells[5]).find(".stTen").attr("style"));

			rows.push({
				course,
				frameNo,
				playerName: identity.playerName,
				className: identity.className,
				registerNo: identity.registerNo,
				currentAverageStart: readCellText($, cells[3]),
				style: "",
				startTiming: readCellText($, cells[7]),
				startOrder: readCellText($, cells[4]),
				startLaneOffset: laneOffset,
				source: BIWAKO_SOURCE,
			});
		});

	return rows.sort((left, right) => left.course - right.course);
}

function parseBiwakoFramePast10(html) {
	const $ = load(html);
	const table = $(".category-waku10 table").first().get(0) ?? findTableByKeywords($, ["枠番別データ", "平均ST", "スタート順"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = trList[1] ? $(trList[1]).children("td,th").toArray() : [];

			if (firstCells.length < 16) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseBiwakoIdentity($, firstCells[1]);

			rows.push({
				frameNo,
				className: identity.className,
				registerNo: identity.registerNo,
				playerName: identity.playerName,
				profile: identity.profile,
				courseHistory: firstCells.slice(3, 13).map((cell) => readCellText($, cell)).slice(0, 10),
				finishHistory: secondCells.slice(1, 11).map((cell) => readCellText($, cell)).slice(0, 10),
				startTimingHistory: [],
				frameWinRate: readCellText($, firstCells[13]),
				frameAverageStart: readCellText($, firstCells[14]),
				frameStartOrder: readCellText($, firstCells[15]),
				source: BIWAKO_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseBiwakoScoreRateGuide(html) {
	const $ = load(html);
	const table = $(".category-tokuten table").first().get(0) ?? findTableByKeywords($, ["得点", "1着", "6着"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();

			if (cells.length < 11) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseBiwakoIdentity($, cells[1]);

			rows.push({
				frameNo,
				registrationNo: identity.registrationNo,
				playerName: identity.playerName,
				className: identity.className,
				averageStart: "",
				winRate: "",
				secondRate: "",
				localWinRate: "",
				localSecondRate: "",
				motorNo: "",
				motorSecondRate: "",
				scoreRate: readCellText($, cells[2]),
				scoreRank: readCellText($, cells[3]),
				scoreAfterFirst: readCellText($, cells[4]),
				scoreAfterSecond: readCellText($, cells[5]),
				scoreAfterThird: readCellText($, cells[6]),
				scoreAfterFourth: readCellText($, cells[7]),
				scoreAfterFifth: readCellText($, cells[8]),
				scoreAfterSixth: readCellText($, cells[9]),
				scoreBorder: readCellText($, cells[10]),
				source: BIWAKO_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseBiwakoSeriesResults(html) {
	const $ = load(html);
	const table = $(".category-setsukan table").first().get(0) ?? findTableByKeywords($, ["節間成績", "初日", "ST", "着"]);

	if (!table) {
		return [];
	}

	const dayLabels = $(table)
		.find("thead tr")
		.eq(1)
		.children("th")
		.toArray()
		.slice(1)
		.flatMap((cell) => {
			const label = readCellText($, cell);
			const spanCount = Number.parseInt($(cell).attr("colspan") ?? "1", 10);
			if (!label) {
				return [];
			}

			const repeatCount = Number.isFinite(spanCount) && spanCount > 0 ? spanCount : 1;
			return Array.from({ length: repeatCount }, () => label);
		})
		.slice(0, 12);

	const rows = [];
	const tbodyRows = $(table).find("tbody tr").toArray();

	for (let rowIndex = 0; rowIndex + 3 < tbodyRows.length; rowIndex += 4) {
		const firstCells = $(tbodyRows[rowIndex]).children("td,th").toArray();
		const secondCells = $(tbodyRows[rowIndex + 1]).children("td,th").toArray();
		const thirdCells = $(tbodyRows[rowIndex + 2]).children("td,th").toArray();
		const fourthCells = $(tbodyRows[rowIndex + 3]).children("td,th").toArray();

		if (firstCells.length < 5) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[0]));
		if (!frameNo) {
			continue;
		}

		const identity = parseBiwakoIdentity($, firstCells[1]);

		rows.push({
			frameNo,
			className: identity.className,
			registerNo: identity.registerNo,
			playerName: identity.playerName,
			profile: identity.profile,
			raceNumbers: firstCells.slice(3).map((cell) => readCellText($, cell)).slice(0, 12),
			courses: secondCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12),
			startTimings: thirdCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12),
			finishOrders: fourthCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12),
			dayLabels,
			source: BIWAKO_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTamagawaEntryTable(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["平均 ST", "モーター", "ボート"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td").toArray();

			if (cells.length < 10) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[1]));
			if (!frameNo) {
				return;
			}

			const identity = parseTamagawaIdentity($, cells[2]);
			if (!identity.playerName) {
				return;
			}

			const national = readCellSegments($, cells[5]);
			const local = readCellSegments($, cells[6]);
			const motor = readCellSegments($, cells[7]);
			const boat = readCellSegments($, cells[8]);

			rows.push({
				frameNo,
				...identity,
				mark: $(cells[0]).find("img").attr("alt") ? compactText($(cells[0]).find("img").attr("alt")) : readCellText($, cells[0]),
				fl: readCellText($, cells[3]),
				averageStart: readCellText($, cells[4]),
				nationalWinRate: national[0] ?? "",
				nationalSecondRate: national[1] ?? "",
				localWinRate: local[0] ?? "",
				localSecondRate: local[1] ?? "",
				motorNo: motor[0] ?? "",
				motorSecondRate: motor[1] ?? "",
				boatNo: boat[0] ?? "",
				boatSecondRate: boat[1] ?? "",
				earlyGuide: readCellText($, cells[9]),
				source: TAMAGAWA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTamagawaBeforeInfo(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["前走成績", "部品交換"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td").toArray();
			if (firstCells.length < 7) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTamagawaIdentity($, firstCells[1]);
			if (!identity.playerName) {
				return;
			}

			const partsExchange = trList[1] ? readCellText($, $(trList[1]).children("td").first()) : "";

			rows.push({
				frameNo,
				...identity,
				weight: readCellText($, firstCells[2]),
				weightAdjustment: readCellText($, firstCells[3]),
				motorNo: readCellText($, firstCells[4]),
				motorSecondRate: readCellText($, firstCells[5]),
				tilt: readCellText($, firstCells[6]),
				previousRaceInfo: firstCells.slice(7).map((cell) => readCellText($, cell)).filter(Boolean).join(" / "),
				partsExchange,
				source: TAMAGAWA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTamagawaStartExhibition(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["スタート展示", "展示タイム", "今節平均ST"]);

	if (!table) {
		return [];
	}

	const startVisualMap = new Map();
	$(table)
		.find("td.com-yosou-suimen .suimen_div")
		.each((_, element) => {
			const imageSrc = $(element).find("img.boat").attr("src") ?? "";
			const frameNo = Number.parseInt(imageSrc.match(/img_boat_0?([1-6])\.png/)?.[1] ?? "", 10);
			const leftValue = Number.parseFloat(($(element).find("img.boat").attr("style") ?? "").match(/left:([\-\d.]+)%/)?.[1] ?? "NaN");

			if (!Number.isFinite(frameNo)) {
				return;
			}

			startVisualMap.set(frameNo, {
				startTiming: compactText($(element).find(".st_area").text()),
				startLaneOffset: Number.isFinite(leftValue) ? leftValue : null,
			});
		});

	const rows = [];

	const bodyRows = $(table).find("tbody tr").toArray();
	for (let rowIndex = 0; rowIndex + 1 < bodyRows.length; rowIndex += 2) {
		const firstCells = $(bodyRows[rowIndex]).children("td").toArray();
			if (firstCells.length < 5) {
				continue;
			}

			const course = parseFrameNo(readCellText($, firstCells[0]));
			const frameNo = parseFrameNo(readCellText($, firstCells[1]));
			if (!course || !frameNo) {
				return;
			}

			const identity = parseTamagawaIdentity($, firstCells[2]);
			const visual = startVisualMap.get(frameNo) ?? { startTiming: "", startLaneOffset: null };

			rows.push({
				course,
				frameNo,
				playerName: identity.playerName,
				className: identity.className,
				registerNo: identity.registerNo,
				exhibitionTime: readCellText($, firstCells[3]),
				currentAverageStart: readCellText($, firstCells[4]),
				startTiming: visual.startTiming,
				startOrder: readCellText($, $(bodyRows[rowIndex + 1]).children("td").first()),
				startLaneOffset: visual.startLaneOffset,
				source: TAMAGAWA_SOURCE,
			});
	}

	return rows.sort((left, right) => left.course - right.course);
}

function parseTamagawaOriginalExhibition(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["オリジナル展示データ", "一周", "直線"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td").toArray();

			if (cells.length < 9) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTamagawaIdentity($, cells[1]);
			if (!identity.playerName) {
				return;
			}

			rows.push({
				frameNo,
				...identity,
				weight: readCellText($, cells[2]),
				weightAdjustment: readCellText($, cells[3]),
				tilt: readCellText($, cells[4]),
				exhibitionTime: readCellText($, cells[5]),
				oneLapTime: readCellText($, cells[6]),
				turnTime: readCellText($, cells[7]),
				straightTime: readCellText($, cells[8]),
				exhibitionEvaluation: "",
				memo: "多摩川公式 オリジナル展示データから取得",
				source: TAMAGAWA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTamagawaMotorHistory(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["モーター履歴", "使用選手", "節間成績"]);

	if (!table) {
		return {
			motorSummary: [],
			tamagawaMotorHistory: [],
		};
	}

	const motorSummary = [];
	const tamagawaMotorHistory = [];

	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td").toArray();

			if (firstCells.length < 7) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTamagawaIdentity($, firstCells[1]);
			const motor = readCleanLines($(firstCells[2]));
			const summary = readCleanLines($(firstCells[3]));
			const historyEntries = [];

			trList.forEach((rowElement, rowIndex) => {
				const cells = $(rowElement).children("td").toArray();
				const offset = rowIndex === 0 ? 4 : 0;
				const label = readCellText($, cells[offset]);
				const playerName = readCellText($, cells[offset + 1]);
				const results = readCellText($, cells[offset + 2]);

				if (!label && !playerName && !results) {
					return;
				}

				historyEntries.push({
					label,
					playerName,
					results,
				});
			});

			const headHistory = historyEntries.find((item) => item.playerName || item.results) ?? { label: "", playerName: "", results: "" };
			motorSummary.push({
				frameNo,
				motorNo: motor[0] ?? "",
				previousUser: headHistory.playerName,
				recentResults: headHistory.results,
				motorGrade: motor[1] ?? "",
				comment: `2連率 ${motor[1] ?? "-"} / 優出 ${summary[0] ?? "-"} / 優勝 ${summary[1] ?? "-"}`,
				source: TAMAGAWA_SOURCE,
			});

			tamagawaMotorHistory.push({
				frameNo,
				...identity,
				motorNo: motor[0] ?? "",
				motorSecondRate: motor[1] ?? "",
				finals: summary[0] ?? "",
				championships: summary[1] ?? "",
				historyEntries,
				source: TAMAGAWA_SOURCE,
			});
		});

	return {
		motorSummary: motorSummary.sort((left, right) => left.frameNo - right.frameNo),
		tamagawaMotorHistory: tamagawaMotorHistory.sort((left, right) => left.frameNo - right.frameNo),
	};
}

function parseTamagawaAbilityIndex(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["能力値", "枠番相性", "スタート力"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td").toArray();

			if (cells.length < 5) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			rows.push({
				frameNo,
				abilityValue: readCellText($, cells[2]),
				frameCompatibility: readCellText($, cells[3]),
				startPower: readCellText($, cells[4]),
				source: TAMAGAWA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTamagawaSeriesResults(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["節間成績", "初日", "ST", "着"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td").toArray();
			if (firstCells.length < 4) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTamagawaIdentity($, firstCells[1]);
			const labeledRows = trList.map((rowElement, rowIndex) => {
				const cells = $(rowElement).children("td").toArray();
				const values = (rowIndex === 0 ? cells.slice(2) : cells).map((cell) => readCellText($, cell));
				return {
					label: values[0] ?? "",
					values: values.slice(1),
				};
			});
			const rowMap = new Map(labeledRows.map((item) => [item.label, item.values]));

			rows.push({
				frameNo,
				...identity,
				raceNumbers: rowMap.get("R") ?? [],
				courses: rowMap.get("進") ?? [],
				startTimings: rowMap.get("ST") ?? [],
				finishOrders: rowMap.get("着") ?? [],
				source: TAMAGAWA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTamagawaFramePast10(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["枠番別データ", "平均ST", "スタート順"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			const firstCells = $(trList[0]).children("td").toArray();
			const secondCells = trList[1] ? $(trList[1]).children("td").toArray() : [];
			if (firstCells.length < 6) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTamagawaIdentity($, firstCells[1]);
			const courseValues = firstCells.slice(2).map((cell) => readCellText($, cell));
			const finishValues = secondCells.map((cell) => readCellText($, cell));

			rows.push({
				frameNo,
				...identity,
				courseHistory: courseValues.slice(1, 11),
				finishHistory: finishValues.slice(1, 11),
				frameWinRate: courseValues[11] ?? "",
				frameAverageStart: courseValues[12] ?? "",
				frameStartOrder: courseValues[13] ?? "",
				source: TAMAGAWA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTamagawaScoreRateGuide(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["得点率", "平均ST"]);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const firstRow = $(tbody).find("tr").first();
			const cells = firstRow.children("td").toArray();
			if (cells.length < 8) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTamagawaIdentity($, cells[1]);
			const motor = readCleanLines($(cells[6]));

			rows.push({
				frameNo,
				registrationNo: identity.registerNo,
				playerName: identity.playerName,
				className: identity.className,
				averageStart: readCellText($, cells[3]),
				winRate: readCellText($, cells[4]),
				secondRate: readCellText($, cells[5]),
				localWinRate: readCellText($, cells[5]),
				localSecondRate: readCellText($, cells[5]),
				motorNo: motor[0] ?? "",
				motorSecondRate: motor[1] ?? "",
				source: TAMAGAWA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTamagawaOddsResult(html) {
	const $ = load(html);
	const resultTable = findTableByKeywords($, ["選手名", "タイム", "着"]);
	const payoutTables = $("table")
		.toArray()
		.filter((table) => {
			const text = compactText($(table).text());
			return text.includes("払戻金") && text.includes("人気") && text.includes("組番");
		});

	const finishers = [];
	if (resultTable) {
		$(resultTable)
			.find("tbody tr")
			.each((_, rowElement) => {
				const cells = $(rowElement).children("th, td").toArray();
				if (cells.length < 4) {
					return;
				}

				const rank = readCellText($, cells[0]);
				const frameNo = parseFrameNo(readCellText($, cells[1]));
				const playerName = readCellText($, cells[2]);
				const raceTime = readCellText($, cells[3]);

				if (!rank || !frameNo || !playerName) {
					return;
				}

				finishers.push({
					rank,
					frameNo,
					playerName,
					raceTime,
				});
			});
	}

	const payouts = [];
	for (const table of payoutTables) {
		$(table)
			.find("tbody tr")
			.each((_, rowElement) => {
				const cells = $(rowElement).children("th, td").toArray();
				if (cells.length < 3) {
					return;
				}

				const betType = readCellText($, cells[0]);
				const combination = readCellText($, cells[1]);
				const payout = readCellText($, cells[2]);
				const popularity = readCellText($, cells[3]);

				if (!betType || (!combination && !payout)) {
					return;
				}

				payouts.push({
					betType,
					combination,
					payout,
					popularity,
				});
			});
	}

	if (!finishers.length && !payouts.length) {
		return null;
	}

	return {
		finishers,
		payouts,
		source: TAMAGAWA_SOURCE,
	};
}

async function fetchTamagawaRaceExtra({ day, raceNo }) {
	const urls = {
		syussou: toTamagawaYosouUrl({ day, raceNo, type: "syussou" }),
		cyokuzen: toTamagawaYosouUrl({ day, raceNo, type: "cyokuzen" }),
		tenji: toTamagawaYosouUrl({ day, raceNo, type: "tenji" }),
		oriten: toTamagawaYosouUrl({ day, raceNo, type: "oriten" }),
		motorHistory: toTamagawaYosouUrl({ day, raceNo, type: "motor_history" }),
		nouryoku: toTamagawaYosouUrl({ day, raceNo, type: "nouryoku" }),
		setsukan: toTamagawaYosouUrl({ day, raceNo, type: "setsukan" }),
		waku10: toTamagawaYosouUrl({ day, raceNo, type: "waku10" }),
		tokuhayami: toTamagawaYosouUrl({ day, raceNo, type: "tokuhayami" }),
		oddsResult: toTamagawaYosouUrl({ day, raceNo, type: "group-odds-result" }),
	};

	const entries = Object.entries(urls);
	const settled = await Promise.allSettled(entries.map(([, url]) => fetchHtml(url)));
	const htmlByKey = Object.fromEntries(
		entries.map(([key], index) => [key, settled[index]?.status === "fulfilled" ? settled[index].value : ""]),
	);

	const tamagawaEntryTable = parseTamagawaEntryTable(htmlByKey.syussou);
	const tamagawaBeforeInfo = parseTamagawaBeforeInfo(htmlByKey.cyokuzen);
	const startExhibition = parseTamagawaStartExhibition(htmlByKey.tenji);
	const originalExhibition = parseTamagawaOriginalExhibition(htmlByKey.oriten);
	const { motorSummary, tamagawaMotorHistory } = parseTamagawaMotorHistory(htmlByKey.motorHistory);
	const abilityIndex = parseTamagawaAbilityIndex(htmlByKey.nouryoku);
	const tamagawaSeriesResults = parseTamagawaSeriesResults(htmlByKey.setsukan);
	const tamagawaFramePast10 = parseTamagawaFramePast10(htmlByKey.waku10);
	const tamagawaScoreRateGuide = parseTamagawaScoreRateGuide(htmlByKey.tokuhayami);
	const tamagawaOddsResult = parseTamagawaOddsResult(htmlByKey.oddsResult);

	const hasAny =
		tamagawaEntryTable.length > 0 ||
		tamagawaBeforeInfo.length > 0 ||
		startExhibition.length > 0 ||
		originalExhibition.length > 0 ||
		motorSummary.length > 0 ||
		abilityIndex.length > 0 ||
		tamagawaSeriesResults.length > 0 ||
		tamagawaFramePast10.length > 0 ||
		tamagawaScoreRateGuide.length > 0 ||
		Boolean(tamagawaOddsResult);

	console.log(
		`[venue-extras] tamagawa ${raceNo}R: entry ${tamagawaEntryTable.length} / cyokuzen ${tamagawaBeforeInfo.length} / start ${startExhibition.length} / exhibition ${originalExhibition.length} / motor ${motorSummary.length} / ability ${abilityIndex.length} / series ${tamagawaSeriesResults.length} / frame10 ${tamagawaFramePast10.length}${tamagawaScoreRateGuide.length ? ` / score ${tamagawaScoreRateGuide.length}` : ""}${tamagawaOddsResult ? " / odds-result" : ""}`,
	);

	return {
		raceNo,
		status: hasAny ? "available" : "waiting",
		source: TAMAGAWA_SOURCE,
		sourceType: "official-venue-yosou-tabs",
		tamagawaEntryTable,
		tamagawaBeforeInfo,
		startExhibition,
		originalExhibition,
		motorSummary,
		abilityIndex,
		tamagawaMotorHistory,
		tamagawaSeriesResults,
		tamagawaFramePast10,
		tamagawaScoreRateGuide,
		tamagawaOddsResult,
	};
}

async function createTamagawaVenue(feed, date) {
	const tamagawaVenue = findVenue(feed, TAMAGAWA_VENUE_NAME);

	if (!tamagawaVenue) {
		console.log("[venue-extras] tamagawa: not held today");
		return null;
	}

	try {
		const day = toTamagawaDay(date);
		const races = getRaceList(tamagawaVenue);
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(await fetchTamagawaRaceExtra({ day, raceNo: race.raceNo }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;

		return {
			venueCode: String(tamagawaVenue.venueCode ?? "05"),
			venueName: TAMAGAWA_VENUE_NAME,
			source: TAMAGAWA_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-tamagawa-data",
			note: "多摩川公式HPの出走表・直前情報・スタート展示・オリジナル展示・診断指数などを追加保持",
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] tamagawa failed: ${error.message}`);

		return {
			venueCode: String(tamagawaVenue.venueCode ?? "05"),
			venueName: TAMAGAWA_VENUE_NAME,
			source: TAMAGAWA_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `多摩川公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
}

async function fetchTsuRaceExtra({ date, raceNo }) {
	const settled = await Promise.allSettled([
		fetchTsuHtml(toTsuRaceTabUrl({ date, raceNo, req: "cyokuzen", run: 0 })),
		fetchTsuHtml(toTsuRaceTabUrl({ date, raceNo, req: "sttenji", run: 0 })),
		fetchTsuHtml(toTsuRaceTabUrl({ date, raceNo, req: "sttenji", run: 1 })),
		fetchTsuHtml(toTsuRaceTabUrl({ date, raceNo, req: "waku10", run: 0 })),
		fetchTsuHtml(toTsuRaceTabUrl({ date, raceNo, req: "tokuhayami", run: 0 })),
		fetchTsuHtml(toTsuRaceTabUrl({ date, raceNo, req: "syussou", run: 0 })),
	]);

	const beforeHtml = settled[0]?.status === "fulfilled" ? settled[0].value : "";
	const startHtml = settled[1]?.status === "fulfilled" ? settled[1].value : "";
	const originalHtml = settled[2]?.status === "fulfilled" ? settled[2].value : startHtml;
	const frame10Html = settled[3]?.status === "fulfilled" ? settled[3].value : "";
	const scoreHtml = settled[4]?.status === "fulfilled" ? settled[4].value : "";
	const syussouHtml = settled[5]?.status === "fulfilled" ? settled[5].value : "";

	const tsuBeforeInfo = parseTsuBeforeInfo(beforeHtml);
	const startExhibition = parseTsuStartExhibition(startHtml);
	const originalExhibition = parseTsuOriginalExhibition(originalHtml);
	const tsuFramePast10 = parseTsuFramePast10(frame10Html);
	const tsuRacerComments = parseTsuRacerComments(syussouHtml);
	const tsuSeriesResults = parseTsuSeriesResults(syussouHtml);
	const tsuNationalRecent3 = parseTsuNationalRecent3(syussouHtml);
	const tsuLocalRecent3 = parseTsuLocalRecent3(syussouHtml);
	const racerComments = tsuRacerComments;
	const tsuScoreRateGuide = parseTsuScoreRateGuide(scoreHtml);
	const officialBeforeInfo = tsuScoreRateGuide.length
		? {
				status: "available",
				source: TSU_SOURCE,
				scoreQuickLook: tsuScoreRateGuide,
			}
		: null;

	console.log(
		`[venue-extras] tsu ${raceNo}R: before ${tsuBeforeInfo.length} / exhibition ${originalExhibition.length} / start ${startExhibition.length} / frame10 ${tsuFramePast10.length} / comments ${tsuRacerComments.length} / series ${tsuSeriesResults.length} / national3 ${tsuNationalRecent3.length} / local3 ${tsuLocalRecent3.length} / score ${tsuScoreRateGuide.length}`,
	);

	if (!tsuBeforeInfo.length && !startExhibition.length && !originalExhibition.length && !tsuFramePast10.length && !tsuRacerComments.length && !tsuSeriesResults.length && !tsuNationalRecent3.length && !tsuLocalRecent3.length && !tsuScoreRateGuide.length) {
		return {
			raceNo,
			status: "waiting",
			source: TSU_SOURCE,
			sourceType: "official-venue-yosou-tabs",
			tsuBeforeInfo: [],
			startExhibition: [],
			originalExhibition: [],
			tsuFramePast10: [],
			tsuRacerComments: [],
			racerComments: [],
			tsuSeriesResults: [],
			tsuNationalRecent3: [],
			tsuLocalRecent3: [],
			tsuScoreRateGuide: [],
		};
	}

	return {
		raceNo,
		status: "available",
		source: TSU_SOURCE,
		sourceType: "official-venue-yosou-tabs",
		officialBeforeInfo,
		tsuBeforeInfo,
		startExhibition,
		originalExhibition,
		tsuFramePast10,
		tsuRacerComments,
		racerComments,
		tsuSeriesResults,
		tsuNationalRecent3,
		tsuLocalRecent3,
		tsuScoreRateGuide,
	};
}

async function createTsuVenue(feed, date) {
	const tsuVenue = findVenue(feed, TSU_VENUE_NAME);

	if (!tsuVenue) {
		console.log("[venue-extras] tsu: not held today");
		return null;
	}

	try {
		const races = getRaceList(tsuVenue);
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(await fetchTsuRaceExtra({ date, raceNo: race.raceNo }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;

		return {
			venueCode: String(tsuVenue.venueCode ?? "09"),
			venueName: TSU_VENUE_NAME,
			source: TSU_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-tsu-data",
			note: "津公式HPの直前情報・展示情報・枠番別過去10走・得点率早見を取得",
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] tsu failed: ${error.message}`);

		return {
			venueCode: String(tsuVenue.venueCode ?? "09"),
			venueName: TSU_VENUE_NAME,
			source: TSU_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `津公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
}

async function fetchWakamatsuRaceExtra({ date, raceNo }) {
	const urls = {
		syussou: toWakamatsuRaceTabUrl({ date, raceNo, type: "syussou", kind: 0 }),
		series: toWakamatsuRaceTabUrl({ date, raceNo, type: "syussou", kind: 1 }),
		course: toWakamatsuRaceTabUrl({ date, raceNo, type: "syussou", kind: 2 }),
		national3: toWakamatsuRaceTabUrl({ date, raceNo, type: "syussou", kind: 3 }),
		local3: toWakamatsuRaceTabUrl({ date, raceNo, type: "syussou", kind: 4 }),
		frame10: toWakamatsuRaceTabUrl({ date, raceNo, type: "syussou", kind: 5 }),
		score: toWakamatsuRaceTabUrl({ date, raceNo, type: "syussou", kind: 6 }),
		before: toWakamatsuRaceTabUrl({ date, raceNo, type: "cyokuzen", kind: 0 }),
		start: toWakamatsuRaceTabUrl({ date, raceNo, type: "cyokuzen", kind: 1 }),
		original: toWakamatsuRaceTabUrl({ date, raceNo, type: "cyokuzen", kind: 2 }),
	};

	const entries = Object.entries(urls);
	const settled = await Promise.allSettled(entries.map(([, url]) => fetchHtml(url)));
	const htmlByKey = Object.fromEntries(
		entries.map(([key], index) => [key, settled[index]?.status === "fulfilled" ? settled[index].value : ""]),
	);

	const wakamatsuEntryTable = parseWakamatsuEntryTable(htmlByKey.syussou);
	const wakamatsuRacerComments = parseWakamatsuRacerComments(htmlByKey.syussou);
	const wakamatsuBeforeInfo = parseWakamatsuBeforeInfo(htmlByKey.before);
	const startExhibition = parseWakamatsuStartExhibition(htmlByKey.start);
	const originalExhibition = parseWakamatsuOriginalExhibition(htmlByKey.original);
	const wakamatsuSeriesResults = parseWakamatsuSeriesResults(htmlByKey.series);
	const wakamatsuCourseStats = parseWakamatsuCourseStats(htmlByKey.course);
	const wakamatsuNationalRecent3 = parseWakamatsuNationalRecent3(htmlByKey.national3);
	const wakamatsuLocalRecent3 = parseWakamatsuLocalRecent3(htmlByKey.local3);
	const wakamatsuFramePast10 = parseWakamatsuFramePast10(htmlByKey.frame10);
	const wakamatsuScoreRateGuide = parseWakamatsuScoreRateGuide(htmlByKey.score);
	const weatherActual = parseWakamatsuWeatherActual(htmlByKey.start);

	const motorTargets = wakamatsuEntryTable
		.filter((row) => row.motorNo && row.motorDetailUrl)
		.map((row) => ({
			frameNo: row.frameNo,
			motorNo: row.motorNo,
			url: row.motorDetailUrl || toWakamatsuMotorUrl(row.motorNo),
			entryRow: row,
		}));
	const motorSettled = await Promise.allSettled(motorTargets.map((target) => fetchHtml(target.url)));
	const motorSummary = [];
	const wakamatsuMotorHistory = [];

	motorTargets.forEach((target, index) => {
		const html = motorSettled[index]?.status === "fulfilled" ? motorSettled[index].value : "";
		if (!html) {
			return;
		}

		const parsed = parseWakamatsuMotorHistory(html, target.entryRow);
		motorSummary.push(parsed.motorSummary);
		wakamatsuMotorHistory.push(parsed.motorHistory);
	});

	const officialBeforeInfo = wakamatsuScoreRateGuide.length || weatherActual
		? {
				status: "available",
				source: WAKAMATSU_SOURCE,
				scoreQuickLook: wakamatsuScoreRateGuide,
				weatherActual,
			}
		: null;

	const hasAny =
		wakamatsuEntryTable.length > 0 ||
		wakamatsuBeforeInfo.length > 0 ||
		startExhibition.length > 0 ||
		originalExhibition.length > 0 ||
		wakamatsuSeriesResults.length > 0 ||
		wakamatsuCourseStats.length > 0 ||
		wakamatsuNationalRecent3.length > 0 ||
		wakamatsuLocalRecent3.length > 0 ||
		wakamatsuFramePast10.length > 0 ||
		wakamatsuScoreRateGuide.length > 0 ||
		motorSummary.length > 0;

	console.log(
		`[venue-extras] wakamatsu ${raceNo}R: entry ${wakamatsuEntryTable.length} / before ${wakamatsuBeforeInfo.length} / start ${startExhibition.length} / exhibition ${originalExhibition.length} / series ${wakamatsuSeriesResults.length} / course ${wakamatsuCourseStats.length} / national3 ${wakamatsuNationalRecent3.length} / local3 ${wakamatsuLocalRecent3.length} / frame10 ${wakamatsuFramePast10.length} / score ${wakamatsuScoreRateGuide.length} / motor ${motorSummary.length}`,
	);

	if (!hasAny) {
		return {
			raceNo,
			status: "waiting",
			source: WAKAMATSU_SOURCE,
			sourceType: "official-venue-yosou-tabs",
			wakamatsuEntryTable: [],
			wakamatsuBeforeInfo: [],
			startExhibition: [],
			originalExhibition: [],
			motorSummary: [],
			wakamatsuMotorHistory: [],
			wakamatsuRacerComments: [],
			racerComments: [],
			wakamatsuSeriesResults: [],
			wakamatsuCourseStats: [],
			wakamatsuNationalRecent3: [],
			wakamatsuLocalRecent3: [],
			wakamatsuFramePast10: [],
			wakamatsuScoreRateGuide: [],
		};
	}

	return {
		raceNo,
		status: "available",
		source: WAKAMATSU_SOURCE,
		sourceType: "official-venue-yosou-tabs",
		officialBeforeInfo,
		wakamatsuEntryTable,
		wakamatsuBeforeInfo,
		startExhibition,
		originalExhibition,
		motorSummary,
		wakamatsuMotorHistory,
		wakamatsuRacerComments,
		racerComments: wakamatsuRacerComments,
		wakamatsuSeriesResults,
		wakamatsuCourseStats,
		wakamatsuNationalRecent3,
		wakamatsuLocalRecent3,
		wakamatsuFramePast10,
		wakamatsuScoreRateGuide,
	};
}

function parseFukuokaIdentity($, cell) {
	const infoLines = $(cell)
		.find(".com-subinfo")
		.toArray()
		.map((element) => readCellText($, element))
		.filter(Boolean);
	const playerName = readCellText($, $(cell).find(".com-rname").first());
	const head = infoLines[0] ?? "";
	const tail = infoLines[1] ?? "";
	const [className = "", branch = ""] = head.split("/").map((value) => compactText(value));
	const [registerNo = "", origin = "", age = ""] = tail.split("/").map((value) => compactText(value));

	return {
		className,
		registerNo,
		registrationNo: registerNo,
		playerName,
		profile: [branch, origin, age].filter(Boolean).join("/"),
	};
}

function parseFukuokaMotorEvaluationCode($, cell) {
	const imageSrc = $(cell).find("img").attr("src") ?? "";
	return imageSrc.match(/icon_race(\d+)\.png/)?.[1] ?? "";
}

function formatFukuokaMotorEvaluation({ dash = "", turn = "", stretch = "" }) {
	return [
		dash ? `出足:${dash}` : "",
		turn ? `まわり足:${turn}` : "",
		stretch ? `伸び足:${stretch}` : "",
	].filter(Boolean).join(" / ");
}

function parseFukuokaEntryRows(html) {
	const $ = load(html);
	const table = $(".category-syussou table").first().get(0) ?? findTableByKeywords($, ["平均ST", "モーター", "選手コメント"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tr").toArray();

	for (let rowIndex = 2; rowIndex + 2 < trList.length; rowIndex += 3) {
		const firstCells = $(trList[rowIndex]).children("td,th").toArray();
		const secondCells = $(trList[rowIndex + 1]).children("td,th").toArray();
		const thirdCells = $(trList[rowIndex + 2]).children("td,th").toArray();
		if (firstCells.length < 13) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[1]));
		if (!frameNo) {
			continue;
		}

		const identity = parseFukuokaIdentity($, firstCells[2]);
		const dashEvaluation = parseFukuokaMotorEvaluationCode($, firstCells[8]);
		const stretchEvaluation = parseFukuokaMotorEvaluationCode($, firstCells[9]);
		const turnEvaluation = parseFukuokaMotorEvaluationCode($, firstCells[10]);
		const cellComment = readCellText($, thirdCells[0] ?? null)
			.replace(/^選手コメント：?\s*/, "")
			.trim();
		const lightboxComment = readCellText($, $(firstCells[12]).find(".comment-table, .comment-list, dd.box.left").first())
			.replace(/^選手コメント：?\s*/, "")
			.trim();

		rows.push({
			frameNo,
			className: identity.className,
			registerNo: identity.registerNo,
			playerName: identity.playerName,
			profile: identity.profile,
			averageStart: readCellText($, firstCells[4]),
			nationalWinRate: readCellText($, firstCells[5]),
			nationalSecondRate: readCellText($, secondCells[0]),
			localWinRate: readCellText($, firstCells[6]),
			localSecondRate: readCellText($, secondCells[1]),
			motorNo: readCellText($, firstCells[7]),
			motorSecondRate: readCellText($, secondCells[2]),
			boatNo: "",
			boatSecondRate: "",
			comment: lightboxComment || cellComment,
			motorEvaluation: formatFukuokaMotorEvaluation({
				dash: dashEvaluation,
				turn: turnEvaluation,
				stretch: stretchEvaluation,
			}),
			earlyGuide: readCellText($, firstCells[11]),
			source: FUKUOKA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseFukuokaBeforeInfo(html) {
	const $ = load(html);
	const table = $(".category-cyokuzen table.cyokuzen").first().get(0) ?? findTableByKeywords($, ["展示タイム", "前走成績", "部品交換"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tr").toArray();

	for (let rowIndex = 2; rowIndex + 2 < trList.length; rowIndex += 3) {
		const firstCells = $(trList[rowIndex]).children("td,th").toArray();
		const secondCells = $(trList[rowIndex + 1]).children("td,th").toArray();
		const thirdCells = $(trList[rowIndex + 2]).children("td,th").toArray();
		if (firstCells.length < 11) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[0]));
		if (!frameNo) {
			continue;
		}

		const identity = parseFukuokaIdentity($, firstCells[1]);
		const previousRaceInfo = [
			readCellText($, firstCells[6]),
			readCellText($, firstCells[7]),
			readCellText($, firstCells[8]),
		].filter(Boolean).join(" / ");

		rows.push({
			frameNo,
			registerNo: identity.registerNo,
			className: identity.className,
			playerName: identity.playerName,
			profile: identity.profile,
			exhibitionTime: readCellText($, firstCells[3]),
			weight: readCellText($, firstCells[2]),
			weightAdjustment: readCellText($, secondCells[0]),
			tilt: readCellText($, firstCells[4]),
			partsExchange: readCellText($, $(thirdCells[0]).find("dd.box.left").first()) || readCellText($, thirdCells[0]),
			previousRaceInfo,
			motorNo: "",
			motorSecondRate: "",
			currentAverageStart: readCellText($, firstCells[9]),
			startOrder: readCellText($, firstCells[10]),
			source: FUKUOKA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseFukuokaStartLaneOffset(styleText) {
	const matched = String(styleText ?? "").match(/left:([\-\d.]+)px/);
	const laneOffset = Number.parseFloat(matched?.[1] ?? "NaN");
	return Number.isFinite(laneOffset) ? laneOffset : null;
}

function parseFukuokaStartExhibition(html, beforeInfoRows = []) {
	const $ = load(html);
	const table = $(".block.stTenji table.stTenji").first().get(0) ?? findTableByKeywords($, ["スタート展示", "S/D", "ST"]);

	if (!table) {
		return [];
	}

	const beforeInfoByFrame = new Map(beforeInfoRows.map((row) => [row.frameNo, row]));
	const rows = [];

	$(table)
		.find("tr")
		.slice(1)
		.each((rowIndex, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 5) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const beforeInfo = beforeInfoByFrame.get(frameNo) ?? null;
			rows.push({
				course: frameNo,
				frameNo,
				playerName: beforeInfo?.playerName ?? "",
				className: beforeInfo?.className ?? "",
				registerNo: beforeInfo?.registerNo ?? "",
				currentAverageStart: beforeInfo?.currentAverageStart ?? "",
				style: readCellText($, cells[1]),
				startTiming: readCellText($, $(cells[4]).find(".st").first()) || readCellText($, cells[4]),
				startOrder: beforeInfo?.startOrder ?? "",
				startLaneOffset: parseFukuokaStartLaneOffset($(cells[2]).find(".stTen").attr("style")),
				source: FUKUOKA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseFukuokaOriginalExhibition(html) {
	const $ = load(html);
	const table = $(".category-tenji table.tenji").first().get(0) ?? findTableByKeywords($, ["一周", "まわり足", "直線"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tr")
		.slice(2)
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 10) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseFukuokaIdentity($, cells[1]);
			rows.push({
				frameNo,
				className: identity.className,
				playerName: identity.playerName,
				registerNo: identity.registerNo,
				weight: readCellText($, cells[2]),
				weightAdjustment: readCellText($, cells[3]),
				tilt: readCellText($, cells[4]),
				exhibitionTime: readCellText($, cells[5]),
				motorNo: "",
				oneLapTime: readCellText($, cells[6]),
				turnTime: readCellText($, cells[7]),
				straightTime: readCellText($, cells[8]),
				exhibitionEvaluation: readCellText($, cells[9]),
				memo: "福岡公式 展示情報から取得",
				source: FUKUOKA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseFukuokaMotorEvaluation(entryRows, beforeInfoRows = []) {
	const beforeInfoByFrame = new Map(beforeInfoRows.map((row) => [row.frameNo, row]));

	return entryRows.map((row) => {
		const beforeInfo = beforeInfoByFrame.get(row.frameNo) ?? null;
		return {
			frameNo: row.frameNo,
			className: row.className,
			registerNo: row.registerNo,
			playerName: row.playerName,
			profile: row.profile,
			motorNo: row.motorNo,
			motorSecondRate: row.motorSecondRate,
			motorEvaluation: row.motorEvaluation,
			motorComment: row.comment,
			bestExhibitionTime: "",
			partsExchange: beforeInfo?.partsExchange ?? "",
			source: FUKUOKA_SOURCE,
		};
	});
}

function parseFukuokaSeriesResults(html) {
	const $ = load(html);
	const table = $(".category-setsukan table.setukan").first().get(0) ?? findTableByKeywords($, ["節間成績", "ST", "着"]);

	if (!table) {
		return [];
	}

	const dayLabels = $(table)
		.find("tr")
		.eq(1)
		.children("th")
		.toArray()
		.slice(1)
		.flatMap((cell) => {
			const label = readCellText($, cell);
			const spanCount = Number.parseInt($(cell).attr("colspan") ?? "1", 10);
			if (!label) {
				return [];
			}
			const repeatCount = Number.isFinite(spanCount) && spanCount > 0 ? spanCount : 1;
			return Array.from({ length: repeatCount }, () => label);
		})
		.slice(0, 16);

	const rows = [];
	const trList = $(table).find("tr").toArray();
	for (let rowIndex = 2; rowIndex + 3 < trList.length; rowIndex += 4) {
		const firstCells = $(trList[rowIndex]).children("td,th").toArray();
		const secondCells = $(trList[rowIndex + 1]).children("td,th").toArray();
		const thirdCells = $(trList[rowIndex + 2]).children("td,th").toArray();
		const fourthCells = $(trList[rowIndex + 3]).children("td,th").toArray();
		if (firstCells.length < 5) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[0]));
		if (!frameNo) {
			continue;
		}

		const identity = parseFukuokaIdentity($, firstCells[1]);
		rows.push({
			frameNo,
			className: identity.className,
			registerNo: identity.registerNo,
			playerName: identity.playerName,
			profile: identity.profile,
			raceNumbers: firstCells.slice(3).map((cell) => readCellText($, cell)).slice(0, 16),
			courses: secondCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 16),
			startTimings: thirdCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 16),
			finishOrders: fourthCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 16),
			dayLabels,
			source: FUKUOKA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseFukuokaRacerComments(html) {
	return parseFukuokaEntryRows(html)
		.map((row) => ({
			frameNo: row.frameNo,
			registerNo: row.registerNo,
			className: row.className,
			playerName: row.playerName,
			profile: row.profile,
			comment: row.comment,
			motorComment: row.motorEvaluation,
			source: FUKUOKA_SOURCE,
		}))
		.filter((row) => row.comment || row.motorComment);
}

function parseFukuokaFramePast10(html) {
	const $ = load(html);
	const table = $(".category-waku10 table.Waku10").first().get(0) ?? findTableByKeywords($, ["枠番別過去10走", "平均ST"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tr").toArray();
	for (let rowIndex = 2; rowIndex + 1 < trList.length; rowIndex += 2) {
		const firstCells = $(trList[rowIndex]).children("td,th").toArray();
		const secondCells = $(trList[rowIndex + 1]).children("td,th").toArray();
		if (firstCells.length < 15) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[0]));
		if (!frameNo) {
			continue;
		}

		const identity = parseFukuokaIdentity($, firstCells[1]);
		rows.push({
			frameNo,
			className: identity.className,
			registerNo: identity.registerNo,
			playerName: identity.playerName,
			profile: identity.profile,
			courseHistory: firstCells.slice(3, 13).map((cell) => readCellText($, cell)).slice(0, 10),
			finishHistory: secondCells.slice(1, 11).map((cell) => readCellText($, cell)).slice(0, 10),
			startTimingHistory: [],
			frameWinRate: readCellText($, firstCells[13]),
			frameAverageStart: readCellText($, firstCells[14]),
			frameStartOrder: "",
			source: FUKUOKA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseFukuokaScoreRankingRows(html) {
	const $ = load(html);
	const table = $("table.table")
		.toArray()
		.find((element) => {
			const text = compactText($(element).text()).replaceAll(" ", "");
			return text.includes("得点率") && text.includes("選手名") && text.includes("登番");
		}) ?? null;

	if (!table) {
		return [];
	}

	return $(table)
		.find("tr")
		.toArray()
		.map((rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 11 || $(rowElement).find("th").length > 0) {
				return null;
			}

			return {
				scoreRank: readCellText($, cells[0]),
				className: readCellText($, cells[1]),
				registrationNo: readCellText($, cells[2]),
				playerName: readCellText($, cells[3]),
				scoreRate: readCellText($, cells[4]),
				score: readCellText($, cells[5]),
				penalty: readCellText($, cells[6]),
				starts: readCellText($, cells[7]),
				earlyGuide1: readCellText($, cells[9]),
				earlyGuide2: readCellText($, cells[10]),
			};
		})
		.filter(Boolean);
}

function parseFukuokaScoreRateGuide(html, entryRows, fallbackHtml = "") {
	const rankingRows = parseFukuokaScoreRankingRows(fallbackHtml || html);
	if (!rankingRows.length || !entryRows.length) {
		return [];
	}

	const rankingByRegistrationNo = new Map(rankingRows.map((row) => [row.registrationNo, row]));

	return entryRows
		.map((row) => {
			const ranking = rankingByRegistrationNo.get(row.registerNo);
			if (!ranking) {
				return null;
			}

			return {
				frameNo: row.frameNo,
				registrationNo: row.registerNo,
				playerName: row.playerName,
				className: row.className || ranking.className,
				averageStart: row.averageStart,
				winRate: row.nationalWinRate,
				secondRate: row.nationalSecondRate,
				localWinRate: row.localWinRate,
				localSecondRate: row.localSecondRate,
				motorNo: row.motorNo,
				motorSecondRate: row.motorSecondRate,
				scoreRate: ranking.scoreRate,
				scoreRank: ranking.scoreRank,
				earlyGuide1: ranking.earlyGuide1,
				earlyGuide2: ranking.earlyGuide2,
				source: FUKUOKA_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function parseFukuokaCourseStats() {
	return [];
}

function parseFukuokaNationalRecent3() {
	return [];
}

function parseFukuokaLocalRecent3() {
	return [];
}

async function fetchFukuokaRaceExtra({ date, raceNo, sharedScoreHtml = "" }) {
	const settled = await Promise.allSettled([
		fetchFukuokaHtml(toFukuokaRaceTabUrl({ date, raceNo, type: "syussou" })),
		fetchFukuokaHtml(toFukuokaRaceTabUrl({ date, raceNo, type: "cyokuzen" })),
		fetchFukuokaHtml(toFukuokaRaceTabUrl({ date, raceNo, type: "tenji_info" })),
		fetchFukuokaHtml(toFukuokaRaceTabUrl({ date, raceNo, type: "setsukan" })),
		fetchFukuokaHtml(toFukuokaRaceTabUrl({ date, raceNo, type: "waku10" })),
		fetchFukuokaHtml(toFukuokaRaceTabUrl({ date, raceNo, type: "tokuhayami" })),
	]);

	const syussouHtml = settled[0]?.status === "fulfilled" ? settled[0].value : "";
	const beforeHtml = settled[1]?.status === "fulfilled" ? settled[1].value : "";
	const originalHtml = settled[2]?.status === "fulfilled" ? settled[2].value : "";
	const seriesHtml = settled[3]?.status === "fulfilled" ? settled[3].value : "";
	const frame10Html = settled[4]?.status === "fulfilled" ? settled[4].value : "";
	const scoreHtml = settled[5]?.status === "fulfilled" ? settled[5].value : "";

	const fukuokaEntryRows = parseFukuokaEntryRows(syussouHtml);
	const fukuokaBeforeInfo = parseFukuokaBeforeInfo(beforeHtml).map((row) => {
		const entryRow = fukuokaEntryRows.find((entry) => entry.frameNo === row.frameNo);
		return {
			...row,
			motorNo: entryRow?.motorNo ?? "",
			motorSecondRate: entryRow?.motorSecondRate ?? "",
		};
	});
	const startExhibition = parseFukuokaStartExhibition(beforeHtml, fukuokaBeforeInfo);
	const originalExhibition = parseFukuokaOriginalExhibition(originalHtml).map((row) => {
		const entryRow = fukuokaEntryRows.find((entry) => entry.frameNo === row.frameNo);
		return {
			...row,
			motorNo: entryRow?.motorNo ?? "",
		};
	});
	const fukuokaMotorEvaluation = parseFukuokaMotorEvaluation(fukuokaEntryRows, fukuokaBeforeInfo);
	const fukuokaSeriesResults = parseFukuokaSeriesResults(seriesHtml);
	const fukuokaRacerComments = parseFukuokaRacerComments(syussouHtml);
	const fukuokaFramePast10 = parseFukuokaFramePast10(frame10Html);
	const fukuokaScoreRateGuide = parseFukuokaScoreRateGuide(scoreHtml, fukuokaEntryRows, sharedScoreHtml);
	const fukuokaCourseStats = parseFukuokaCourseStats();
	const fukuokaNationalRecent3 = parseFukuokaNationalRecent3();
	const fukuokaLocalRecent3 = parseFukuokaLocalRecent3();
	const officialBeforeInfo = fukuokaScoreRateGuide.length
		? {
				status: "available",
				source: FUKUOKA_SOURCE,
				scoreQuickLook: fukuokaScoreRateGuide,
			}
		: null;

	const hasAny =
		fukuokaEntryRows.length > 0 ||
		fukuokaBeforeInfo.length > 0 ||
		startExhibition.length > 0 ||
		originalExhibition.length > 0 ||
		fukuokaMotorEvaluation.length > 0 ||
		fukuokaSeriesResults.length > 0 ||
		fukuokaRacerComments.length > 0 ||
		fukuokaFramePast10.length > 0 ||
		fukuokaScoreRateGuide.length > 0;

	console.log(
		`[venue-extras] fukuoka ${raceNo}R: entry ${fukuokaEntryRows.length} / before ${fukuokaBeforeInfo.length} / start ${startExhibition.length} / exhibition ${originalExhibition.length} / motor ${fukuokaMotorEvaluation.length} / series ${fukuokaSeriesResults.length} / comments ${fukuokaRacerComments.length} / frame10 ${fukuokaFramePast10.length} / score ${fukuokaScoreRateGuide.length} / course ${fukuokaCourseStats.length} / national3 ${fukuokaNationalRecent3.length} / local3 ${fukuokaLocalRecent3.length}`,
	);

	if (!hasAny) {
		return {
			raceNo,
			status: "waiting",
			source: FUKUOKA_SOURCE,
			sourceType: "fukuoka-official-race-extra",
			fukuokaEntryRows: [],
			fukuokaBeforeInfo: [],
			startExhibition: [],
			originalExhibition: [],
			fukuokaMotorEvaluation: [],
			fukuokaSeriesResults: [],
			fukuokaRacerComments: [],
			racerComments: [],
			fukuokaFramePast10: [],
			fukuokaScoreRateGuide: [],
			fukuokaCourseStats: [],
			fukuokaNationalRecent3: [],
			fukuokaLocalRecent3: [],
			officialBeforeInfo: null,
		};
	}

	return {
		raceNo,
		status: "available",
		source: FUKUOKA_SOURCE,
		sourceType: "fukuoka-official-race-extra",
		fukuokaEntryRows,
		fukuokaBeforeInfo,
		startExhibition,
		originalExhibition,
		fukuokaMotorEvaluation,
		fukuokaSeriesResults,
		fukuokaRacerComments,
		racerComments: fukuokaRacerComments,
		fukuokaFramePast10,
		fukuokaScoreRateGuide,
		fukuokaCourseStats,
		fukuokaNationalRecent3,
		fukuokaLocalRecent3,
		officialBeforeInfo,
	};
}

async function createFukuokaVenue(feed, date) {
	const fukuokaVenue = findVenue(feed, FUKUOKA_VENUE_NAME);

	if (!fukuokaVenue) {
		console.log("[venue-extras] fukuoka: not held today");
		return null;
	}

	try {
		const races = getRaceList(fukuokaVenue);
		const sharedScoreHtml = await fetchFukuokaHtml(toFukuokaScoreRankingUrl()).catch(() => "");
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(await fetchFukuokaRaceExtra({ date, raceNo: race.raceNo, sharedScoreHtml }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;

		return {
			venueCode: String(fukuokaVenue.venueCode ?? "22"),
			venueName: FUKUOKA_VENUE_NAME,
			source: FUKUOKA_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-fukuoka-data",
			note: "福岡公式HPの直前情報・展示・ST・モーター・節間成績・コメント・枠番別10走・得点率早見を取得",
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] fukuoka failed: ${error.message}`);

		return {
			venueCode: String(fukuokaVenue.venueCode ?? "22"),
			venueName: FUKUOKA_VENUE_NAME,
			source: FUKUOKA_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `福岡公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
}

function parseKojimaIdentity($, cell, className = "") {
	const playerName = readCellText($, $(cell).find("a").first());
	const profile = readCellText($, $(cell).find(".small, span").last());
	const registerNo = compactText(String(profile).split("/")[0] ?? "");

	return {
		className: compactText(className),
		registerNo,
		playerName,
		profile,
	};
}

function parseKojimaRankingIdentity($, cell) {
	const playerName = readCellText($, $(cell).find("a").first());
	const registrationNo = readCellText($, $(cell).find(".no").first());
	const className = readCellText($, $(cell).find(".no2").first()).replace(/[()]/g, "");
	return {
		playerName,
		registrationNo,
		className,
	};
}

function parseKojimaEntryRows(html) {
	const $ = load(html);
	const table = $("table.table_yoso").first().get(0) ?? findTableByKeywords($, ["今節成績", "平均ST", "モーター", "ボート"]);

	if (!table) {
		return [];
	}

	const dayLabels = $(table)
		.find("thead tr.sub-head th.col9")
		.toArray()
		.flatMap((cell) => {
			const label = readCellText($, cell);
			return label ? [label, label] : [];
		})
		.slice(0, 12);

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			if (trList.length < 4) {
				return;
			}

			const firstCells = $(trList[0]).children("td,th").toArray();
			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo || firstCells.length < 10) {
				return;
			}

			const className = readCellText($, firstCells[2]);
			const identity = parseKojimaIdentity($, firstCells[1], className);
			const nationalLines = readCleanLines($(firstCells[5]));
			const localLines = readCleanLines($(firstCells[6]));
			const motorLines = readCleanLines($(firstCells[7]));
			const boatLines = readCleanLines($(firstCells[8]));
			const nextRace = readCellText($, firstCells[firstCells.length - 1]);

			rows.push({
				frameNo,
				...identity,
				averageStart: readCellText($, firstCells[4]),
				nationalWinRate: nationalLines[0] ?? "",
				nationalSecondRate: nationalLines[1] ?? "",
				localWinRate: localLines[0] ?? "",
				localSecondRate: localLines[1] ?? "",
				motorNo: motorLines[0] ?? "",
				motorSecondRate: motorLines[1] ?? "",
				boatNo: boatLines[0] ?? "",
				boatSecondRate: boatLines[1] ?? "",
				nextRace,
				dayLabels,
				source: KOJIMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaSeriesResults(html) {
	const $ = load(html);
	const table = $("table.table_yoso").first().get(0) ?? findTableByKeywords($, ["今節成績", "平均ST", "着"]);

	if (!table) {
		return [];
	}

	const dayLabels = $(table)
		.find("thead tr.sub-head th.col9")
		.toArray()
		.flatMap((cell) => {
			const label = readCellText($, cell);
			return label ? [label, label] : [];
		})
		.slice(0, 12);

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			if (trList.length < 4) {
				return;
			}

			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = $(trList[1]).children("td,th").toArray();
			const thirdCells = $(trList[2]).children("td,th").toArray();
			const fourthCells = $(trList[3]).children("td,th").toArray();
			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo || firstCells.length < 10) {
				return;
			}

			const identity = parseKojimaIdentity($, firstCells[1], readCellText($, firstCells[2]));
			rows.push({
				frameNo,
				...identity,
				averageStart: readCellText($, firstCells[4]),
				raceNumbers: firstCells.slice(10, 22).map((cell) => readCellText($, cell)).slice(0, 12),
				courses: secondCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12),
				startTimings: thirdCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12),
				finishOrders: fourthCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12),
				dayLabels,
				source: KOJIMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaRecentResults(html) {
	const $ = load(html);
	const table = $("table.table_yoso2").first().get(0) ?? findTableByKeywords($, ["前節", "2節前", "3節前"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const cells = $(tbody).find("tr").first().children("td,th").toArray();
			if (cells.length < 8) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseKojimaIdentity($, cells[1], readCellText($, cells[2]));
			const history = cells.slice(3).map((cell) => ({
				seriesClass: $(cell).find("dt").first().attr("class") ?? "",
				stadium: readCellText($, $(cell).find("dt").last()),
				dateRange: readCellText($, $(cell).find("dd").first()),
				results: compactText($(cell).clone().find("dl").remove().end().text()),
			}));

			rows.push({
				frameNo,
				...identity,
				history,
				source: KOJIMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaMotorInfoMap(html) {
	const $ = load(html);
	const table = $("#ta_motor").first().get(0) ?? findTableByKeywords($, ["今節使用者", "前検", "2連率"]);
	const map = new Map();

	if (!table) {
		return map;
	}

	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 10) {
				return;
			}

			const current = parseKojimaRankingIdentity($, cells[2]);
			if (!current.registrationNo) {
				return;
			}

			map.set(current.registrationNo, {
				motorRank: readCellText($, cells[0]),
				motorNo: readCellText($, cells[1]),
				preInspectionTime: readCellText($, cells[3]),
				motorSecondRate: readCellText($, cells[4]).replace(/%$/u, ""),
				finals: readCellText($, cells[5]),
				championships: readCellText($, cells[6]),
				source: KOJIMA_SOURCE,
			});
		});

	return map;
}

function parseKojimaMotorStats(html, motorInfoMap = new Map()) {
	const $ = load(html);
	const table = $("table.table_yoso3").first().get(0) ?? findTableByKeywords($, ["No", "2連対率", "使用選手"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			if (trList.length < 3) {
				return;
			}

			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = $(trList[1]).children("td,th").toArray();
			const thirdCells = $(trList[2]).children("td,th").toArray();
			if (firstCells.length < 9) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseKojimaIdentity($, firstCells[1], readCellText($, firstCells[2]));
			const motorLines = readCleanLines($(firstCells[3]));
			const motorInfo = motorInfoMap.get(identity.registerNo) ?? null;
			const history = firstCells.slice(6, 9).map((cell) => ({
				playerName: readCellText($, $(cell).find("dt").first()),
				className: ($(cell).find("dt").first().attr("class") ?? "").toUpperCase(),
				dateRange: readCellText($, $(cell).find("dd").first()),
				results: compactText($(cell).clone().find("dl").remove().end().text()),
			}));

			rows.push({
				frameNo,
				...identity,
				motorNo: motorLines[0] ?? motorInfo?.motorNo ?? "",
				motorSecondRate: motorLines[1] ?? motorInfo?.motorSecondRate ?? "",
				firstCount: readCellText($, firstCells[4]),
				starts: readCellText($, firstCells[5]),
				secondCount: readCellText($, secondCells[0]),
				finals: readCellText($, secondCells[1]) || motorInfo?.finals || "",
				thirdCount: readCellText($, thirdCells[0]),
				championships: readCellText($, thirdCells[1]) || motorInfo?.championships || "",
				preInspectionTime: motorInfo?.preInspectionTime ?? "",
				motorRank: motorInfo?.motorRank ?? "",
				history,
				source: KOJIMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaFrameStats(html) {
	const $ = load(html);
	const table = $("table.table_yoso1_2").first().get(0) ?? findTableByKeywords($, ["10走", "枠番別データ", "平均ST"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			if (trList.length < 3) {
				return;
			}

			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = $(trList[1]).children("td,th").toArray();
			const thirdCells = $(trList[2]).children("td,th").toArray();
			if (firstCells.length < 17) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseKojimaIdentity($, firstCells[1], readCellText($, firstCells[2]));
			rows.push({
				frameNo,
				...identity,
				courseHistory: firstCells.slice(4, 14).map((cell) => readCellText($, cell)).slice(0, 10),
				startTimingHistory: secondCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 10),
				finishHistory: thirdCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 10),
				frameWinRate: readCellText($, firstCells[14]),
				frameAverageStart: readCellText($, firstCells[15]),
				frameStartOrder: readCellText($, firstCells[16]),
				source: KOJIMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaScoreRankingRows(html) {
	const $ = load(html);
	const table = $("#ta_yosen").first().get(0) ?? findTableByKeywords($, ["得点率", "選手名", "本日の出走"]);

	if (!table) {
		return [];
	}

	return $(table)
		.find("tbody tr")
		.toArray()
		.map((rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 10) {
				return null;
			}

			const identity = parseKojimaRankingIdentity($, cells[1]);
			if (!identity.registrationNo) {
				return null;
			}

			return {
				scoreRank: readCellText($, cells[0]),
				...identity,
				scoreRate: readCellText($, cells[2]),
				starts: readCellText($, cells[3]),
				score: readCellText($, cells[4]),
				penalty: readCellText($, cells[5]),
				totalScore: readCellText($, cells[6]),
				bestTime: readCellText($, cells[7]),
				todayRaces: $(cells[cells.length - 1])
					.find("a")
					.toArray()
					.map((link) => readCellText($, link)),
			};
		})
		.filter(Boolean);
}

function parseKojimaScoreRateGuide(html, entryRows) {
	const rankingRows = parseKojimaScoreRankingRows(html);
	if (!rankingRows.length || !entryRows.length) {
		return [];
	}

	const rankingByRegistrationNo = new Map(rankingRows.map((row) => [row.registrationNo, row]));

	return entryRows
		.map((row) => {
			const ranking = rankingByRegistrationNo.get(row.registerNo);
			if (!ranking) {
				return null;
			}

			return {
				frameNo: row.frameNo,
				registrationNo: row.registerNo,
				playerName: row.playerName,
				className: row.className || ranking.className,
				averageStart: row.averageStart,
				winRate: row.nationalWinRate,
				secondRate: row.nationalSecondRate,
				localWinRate: row.localWinRate,
				localSecondRate: row.localSecondRate,
				motorNo: row.motorNo,
				motorSecondRate: row.motorSecondRate,
				scoreRate: ranking.scoreRate,
				scoreRank: ranking.scoreRank,
				starts: ranking.starts,
				todayRaces: ranking.todayRaces,
				source: KOJIMA_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaBeforeInfo(html) {
	const $ = load(html);
	const table = $("#tenji02").first().get(0) ?? findTableByKeywords($, ["直前情報", "展示タイム", "部品交換"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody")
		.slice(1)
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			if (trList.length < 3) {
				return;
			}

			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = $(trList[1]).children("td,th").toArray();
			const thirdCells = $(trList[2]).children("td,th").toArray();
			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo || firstCells.length < 6) {
				return;
			}

			const identity = parseKojimaIdentity($, firstCells[1], readCellText($, firstCells[2]));
			rows.push({
				frameNo,
				...identity,
				exhibitionTime: readCellText($, firstCells[3]),
				weight: readCellText($, firstCells[4]),
				adjustment: readCellText($, secondCells[0]),
				tilt: readCellText($, firstCells[5]),
				partsExchange: readCellText($, thirdCells[0]),
				source: KOJIMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaStartExhibition(html, beforeInfoRows = []) {
	const $ = load(html);
	const table = $("#tenji01").first().get(0) ?? findTableByKeywords($, ["スタート展示", "コース", "スタート順"]);
	const slipTable = $("#tenji01_2").first();

	if (!table) {
		return [];
	}

	const beforeMap = new Map(beforeInfoRows.map((row) => [row.frameNo, row]));
	const slipMap = new Map(
		slipTable
			.find("dl")
			.toArray()
			.map((entry) => {
				const boatClass = $(entry).find("dd").attr("class") ?? "";
				const match = boatClass.match(/boat([1-6])/u);
				const frameNo = parseFrameNo(match?.[1] ?? "");
				if (!frameNo) {
					return null;
				}
				return [
					frameNo,
					{
						exhibitionStartTiming: readCellText($, $(entry).find("dt").first()),
						startType: readCellText($, $(entry).find(".sd").first()),
					},
				];
			})
			.filter(Boolean),
	);

	const rows = [];
	$(table)
		.find("tbody")
		.slice(1)
		.each((_, tbody) => {
			const cells = $(tbody).find("tr").first().children("td,th").toArray();
			if (cells.length < 4) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[1]));
			if (!frameNo) {
				return;
			}

			const beforeRow = beforeMap.get(frameNo) ?? null;
			const slip = slipMap.get(frameNo) ?? null;
			rows.push({
				frameNo,
				playerName: beforeRow?.playerName ?? "",
				course: readCellText($, cells[0]),
				averageStart: readCellText($, cells[2]),
				startOrder: readCellText($, cells[3]),
				exhibitionStartTiming: slip?.exhibitionStartTiming ?? "",
				startType: slip?.startType ?? "",
				source: KOJIMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaOriginalExhibition(html, beforeInfoRows = []) {
	const $ = load(html);
	const table = $("#tenji04").first().get(0) ?? findTableByKeywords($, ["オリジナル展示データ", "一周", "まわり足", "直線"]);

	if (!table) {
		return [];
	}

	const beforeMap = new Map(beforeInfoRows.map((row) => [row.frameNo, row]));
	const rows = [];
	$(table)
		.find("tbody")
		.slice(1)
		.each((_, tbody) => {
			const trList = $(tbody).find("tr").toArray();
			if (trList.length < 2) {
				return;
			}

			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = $(trList[1]).children("td,th").toArray();
			if (firstCells.length < 7) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const beforeRow = beforeMap.get(frameNo) ?? null;
			rows.push({
				frameNo,
				playerName: beforeRow?.playerName ?? "",
				weight: readCellText($, firstCells[1]),
				adjustment: readCellText($, secondCells[0]),
				tilt: readCellText($, firstCells[2]),
				exhibitionTime: readCellText($, firstCells[3]),
				lapTime: readCellText($, firstCells[4]),
				turnTime: readCellText($, firstCells[5]),
				straightTime: readCellText($, firstCells[6]),
				source: KOJIMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKojimaCourseStats(html, raceNo) {
	const $ = load(html);
	const scope = $(`#cour_${toKojimaRaceNo(raceNo)}`).first();
	const table = scope.find("table#sin_ta").first();

	if (!scope.length || !table.length) {
		return [];
	}

	const rows = [];
	table.children("tbody").each((_, tbody) => {
		const rawRows = $(tbody).find("tr").toArray();
		const trList = rawRows.length > 1 && readCellText($, $(rawRows[0]).children("td,th").first()) === "枠" ? rawRows.slice(1) : rawRows;
		if (!trList.length) {
			return;
		}

		const firstCells = $(trList[0]).children("td,th").toArray();
		if (firstCells.length < 11) {
			return;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[0]));
		if (!frameNo) {
			return;
		}

		const identity = parseKojimaIdentity($, firstCells[1], "");
		const courseRows = trList
			.map((rowElement, rowIndex) => {
				const cells = $(rowElement).children("td,th").toArray();
				const offset = rowIndex === 0 ? 2 : 0;
				if (cells.length < offset + 9) {
					return null;
				}

				return {
					course: readCellText($, cells[offset]),
					entryRate: readCellText($, cells[offset + 1]),
					averageStart: readCellText($, cells[offset + 2]),
					firstRate: readCellText($, cells[offset + 3]),
					secondRate: readCellText($, cells[offset + 4]),
					thirdRate: readCellText($, cells[offset + 5]),
					fourthRate: readCellText($, cells[offset + 6]),
					fifthRate: readCellText($, cells[offset + 7]),
					sixthRate: readCellText($, cells[offset + 8]),
				};
			})
			.filter(Boolean);

		rows.push({
			frameNo,
			...identity,
			courseRows,
			source: KOJIMA_SOURCE,
		});
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

async function fetchKojimaRaceExtra({ raceNo, sharedScoreHtml = "", sharedCourseHtml = "", sharedMotorHtml = "" }) {
	const settled = await Promise.allSettled([
		fetchKojimaHtml(toKojimaRaceTabUrl({ raceNo, type: "syusso08" })),
		fetchKojimaHtml(toKojimaRaceTabUrl({ raceNo, type: "syusso02" })),
		fetchKojimaHtml(toKojimaRaceTabUrl({ raceNo, type: "syusso05" })),
		fetchKojimaHtml(toKojimaRaceTabUrl({ raceNo, type: "syusso06" })),
		fetchKojimaHtml(toKojimaRaceTabUrl({ raceNo, type: "yoso05", mobile: true })),
	]);

	const seriesHtml = settled[0]?.status === "fulfilled" ? settled[0].value : "";
	const recentHtml = settled[1]?.status === "fulfilled" ? settled[1].value : "";
	const motorHtml = settled[2]?.status === "fulfilled" ? settled[2].value : "";
	const frameHtml = settled[3]?.status === "fulfilled" ? settled[3].value : "";
	const beforeHtml = settled[4]?.status === "fulfilled" ? settled[4].value : "";

	const kojimaEntryRows = parseKojimaEntryRows(seriesHtml);
	const sharedMotorMap = parseKojimaMotorInfoMap(sharedMotorHtml);
	const kojimaSeriesResults = parseKojimaSeriesResults(seriesHtml);
	const kojimaRecentResults = parseKojimaRecentResults(recentHtml);
	const kojimaMotorStats = parseKojimaMotorStats(motorHtml, sharedMotorMap);
	const kojimaFrameStats = parseKojimaFrameStats(frameHtml);
	const kojimaScoreRateGuide = parseKojimaScoreRateGuide(sharedScoreHtml, kojimaEntryRows);
	const kojimaBeforeInfo = parseKojimaBeforeInfo(beforeHtml).map((row) => {
		const entryRow = kojimaEntryRows.find((entry) => entry.frameNo === row.frameNo);
		const motorRow = kojimaMotorStats.find((entry) => entry.frameNo === row.frameNo);
		return {
			...row,
			motorNo: entryRow?.motorNo ?? motorRow?.motorNo ?? "",
			motorSecondRate: entryRow?.motorSecondRate ?? motorRow?.motorSecondRate ?? "",
			preInspectionTime: motorRow?.preInspectionTime ?? "",
		};
	});
	const startExhibition = parseKojimaStartExhibition(beforeHtml, kojimaBeforeInfo).map((row) => {
		const beforeRow = kojimaBeforeInfo.find((entry) => entry.frameNo === row.frameNo);
		return {
			...row,
			motorNo: beforeRow?.motorNo ?? "",
		};
	});
	const originalExhibition = parseKojimaOriginalExhibition(beforeHtml, kojimaBeforeInfo).map((row) => {
		const beforeRow = kojimaBeforeInfo.find((entry) => entry.frameNo === row.frameNo);
		return {
			...row,
			motorNo: beforeRow?.motorNo ?? "",
		};
	});
	const kojimaCourseStats = parseKojimaCourseStats(sharedCourseHtml, raceNo);
	const kojimaRacerComments = [];
	const officialBeforeInfo = kojimaScoreRateGuide.length
		? {
				status: "available",
				source: KOJIMA_SOURCE,
				scoreQuickLook: kojimaScoreRateGuide,
			}
		: null;

	const hasAny =
		kojimaSeriesResults.length > 0 ||
		kojimaRecentResults.length > 0 ||
		kojimaMotorStats.length > 0 ||
		kojimaFrameStats.length > 0 ||
		kojimaScoreRateGuide.length > 0 ||
		kojimaBeforeInfo.length > 0 ||
		startExhibition.length > 0 ||
		originalExhibition.length > 0 ||
		kojimaCourseStats.length > 0;

	console.log(
		`[venue-extras] kojima ${raceNo}R: series ${kojimaSeriesResults.length} / recent ${kojimaRecentResults.length} / motor ${kojimaMotorStats.length} / frame ${kojimaFrameStats.length} / score ${kojimaScoreRateGuide.length} / before ${kojimaBeforeInfo.length} / start ${startExhibition.length} / exhibition ${originalExhibition.length} / comments ${kojimaRacerComments.length} / course ${kojimaCourseStats.length}`,
	);

	if (!hasAny) {
		return {
			raceNo,
			status: "waiting",
			source: KOJIMA_SOURCE,
			sourceType: "kojima-official-race-extra",
			kojimaSeriesResults: [],
			kojimaRecentResults: [],
			kojimaMotorStats: [],
			kojimaFrameStats: [],
			kojimaScoreRateGuide: [],
			kojimaBeforeInfo: [],
			startExhibition: [],
			originalExhibition: [],
			kojimaRacerComments: [],
			racerComments: [],
			kojimaCourseStats: [],
			officialBeforeInfo: null,
		};
	}

	return {
		raceNo,
		status: "available",
		source: KOJIMA_SOURCE,
		sourceType: "kojima-official-race-extra",
		kojimaSeriesResults,
		kojimaRecentResults,
		kojimaMotorStats,
		kojimaFrameStats,
		kojimaScoreRateGuide,
		kojimaBeforeInfo,
		startExhibition,
		originalExhibition,
		kojimaRacerComments,
		racerComments: kojimaRacerComments,
		kojimaCourseStats,
		officialBeforeInfo,
	};
}

async function createKojimaVenue(feed, date) {
	const kojimaVenue = findVenue(feed, KOJIMA_VENUE_NAME);

	if (!kojimaVenue) {
		console.log("[venue-extras] kojima: not held today");
		return null;
	}

	try {
		const races = getRaceList(kojimaVenue);
		const [sharedScoreHtml, sharedCourseHtml, sharedMotorHtml] = await Promise.all([
			fetchKojimaHtml(toKojimaScoreRankingUrl()).catch(() => ""),
			fetchKojimaHtml(toKojimaCourseUrl()).catch(() => ""),
			fetchKojimaHtml(toKojimaMotorInfoUrl()).catch(() => ""),
		]);
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(
				await fetchKojimaRaceExtra({
					raceNo: race.raceNo,
					sharedScoreHtml,
					sharedCourseHtml,
					sharedMotorHtml,
				}),
			);
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;

		return {
			venueCode: String(kojimaVenue.venueCode ?? "16"),
			venueName: KOJIMA_VENUE_NAME,
			source: KOJIMA_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-kojima-data",
			note: "児島公式HPの今節成績・近況成績・モーター成績・枠番別成績・得点ランキング・直前情報・スタート展示・オリジナル展示・進入コース別成績を取得",
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] kojima failed: ${error.message}`);

		return {
			venueCode: String(kojimaVenue.venueCode ?? "16"),
			venueName: KOJIMA_VENUE_NAME,
			source: KOJIMA_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `児島公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
}

async function createWakamatsuVenue(feed, date) {
	const wakamatsuVenue = findVenue(feed, WAKAMATSU_VENUE_NAME);

	if (!wakamatsuVenue) {
		console.log("[venue-extras] wakamatsu: not held today");
		return null;
	}

	try {
		const races = getRaceList(wakamatsuVenue);
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(await fetchWakamatsuRaceExtra({ date, raceNo: race.raceNo }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;

		return {
			venueCode: String(wakamatsuVenue.venueCode ?? "20"),
			venueName: WAKAMATSU_VENUE_NAME,
			source: WAKAMATSU_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-wakamatsu-data",
			note: "若松公式HPの出走表・直前情報・展示情報・近況成績・モーター履歴を取得",
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] wakamatsu failed: ${error.message}`);

		return {
			venueCode: String(wakamatsuVenue.venueCode ?? "20"),
			venueName: WAKAMATSU_VENUE_NAME,
			source: WAKAMATSU_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `若松公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
}

async function fetchBiwakoRaceExtra({ date, raceNo }) {
	const originalUrl = toBiwakoRaceInfoUrl({ date, raceNo, kind: 2 });
	const beforeInfoUrl = toBiwakoRaceInfoUrl({ date, raceNo, kind: 0 });
	const startUrl = toBiwakoRaceInfoUrl({ date, raceNo, kind: 1 });
	const seriesUrl = toBiwakoYosouTabUrl({ date, raceNo, type: "setsukan" });
	const frame10Url = toBiwakoYosouTabUrl({ date, raceNo, type: "waku10" });
	const scoreUrl = toBiwakoYosouTabUrl({ date, raceNo, type: "tokuhayami" });
	const settled = await Promise.allSettled([
		fetchHtml(originalUrl),
		fetchHtml(beforeInfoUrl),
		fetchHtml(startUrl),
		fetchHtml(seriesUrl),
		fetchHtml(frame10Url),
		fetchHtml(scoreUrl),
	]);
	const originalHtml = settled[0]?.status === "fulfilled" ? settled[0].value : "";
	const beforeInfoHtml = settled[1]?.status === "fulfilled" ? settled[1].value : "";
	const startHtml = settled[2]?.status === "fulfilled" ? settled[2].value : "";
	const seriesHtml = settled[3]?.status === "fulfilled" ? settled[3].value : "";
	const frame10Html = settled[4]?.status === "fulfilled" ? settled[4].value : "";
	const scoreHtml = settled[5]?.status === "fulfilled" ? settled[5].value : "";
	const partsExchangeMap = parseBiwakoPartsExchangeMap(beforeInfoHtml);
	const originalExhibition = parseBiwakoOriginalExhibition(originalHtml).map((row) => ({
		...row,
		partsExchange: partsExchangeMap.get(row.frameNo) ?? "",
	}));
	const startExhibition = parseBiwakoStartExhibition(startHtml);
	const biwakoSeriesResults = parseBiwakoSeriesResults(seriesHtml);
	const biwakoFramePast10 = parseBiwakoFramePast10(frame10Html);
	const biwakoScoreRateGuide = parseBiwakoScoreRateGuide(scoreHtml);
	const officialBeforeInfo = biwakoScoreRateGuide.length
		? {
				status: "available",
				source: BIWAKO_SOURCE,
				scoreQuickLook: biwakoScoreRateGuide,
			}
		: null;

	console.log(
		`[venue-extras] biwako ${raceNo}R: exhibition ${originalExhibition.length} / start ${startExhibition.length} / frame10 ${biwakoFramePast10.length} / series ${biwakoSeriesResults.length} / score ${biwakoScoreRateGuide.length}`,
	);

	if (!originalExhibition.length && !startExhibition.length && !biwakoFramePast10.length && !biwakoSeriesResults.length && !biwakoScoreRateGuide.length) {
		return {
			raceNo,
			status: "waiting",
			source: BIWAKO_SOURCE,
			sourceType: "official-venue-yosou-tabs",
			startExhibition: [],
			originalExhibition: [],
			biwakoSeriesResults: [],
			biwakoFramePast10: [],
			biwakoScoreRateGuide: [],
		};
	}

	return {
		raceNo,
		status: "available",
		source: BIWAKO_SOURCE,
		sourceType: "official-venue-yosou-tabs",
		officialBeforeInfo,
		startExhibition,
		originalExhibition,
		biwakoSeriesResults,
		biwakoFramePast10,
		biwakoScoreRateGuide,
	};
}

async function createBiwakoVenue(feed, date) {
	const biwakoVenue = findVenue(feed, BIWAKO_VENUE_NAME);

	if (!biwakoVenue) {
		console.log("[venue-extras] biwako: not held today");
		return null;
	}

	try {
		const races = getRaceList(biwakoVenue);
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(await fetchBiwakoRaceExtra({ date, raceNo: race.raceNo }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;

		return {
			venueCode: String(biwakoVenue.venueCode ?? "11"),
			venueName: BIWAKO_VENUE_NAME,
			source: BIWAKO_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-biwako-data",
			note: "びわこ公式HPのスタート展示・オリジナル展示・枠番別過去10走・得点率早見を取得",
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] biwako failed: ${error.message}`);

		return {
			venueCode: String(biwakoVenue.venueCode ?? "11"),
			venueName: BIWAKO_VENUE_NAME,
			source: BIWAKO_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `びわこ公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
}

function normalizeFocusText(value) {
	return compactText(value)
		.replace(/[－―ー]/g, "-")
		.replace(/[＝]/g, "=")
		.replace(/\s+/g, " ");
}

function parseFocusLine(line) {
	const normalized = normalizeFocusText(line)
		.replace(/^（?本命）?/, "")
		.replace(/^（?押さえ）?/, "")
		.trim();

	if (!/[1-6]/.test(normalized)) {
		return "";
	}

	return normalized;
}

/**
 * 大村
 */
function findOmuraExhibitionTable($) {
	return $("table")
		.toArray()
		.find((table) => {
			const text = compactText($(table).text());

			return (
				text.includes("展示") &&
				text.includes("一周") &&
				text.includes("回り足") &&
				text.includes("直線") &&
				text.includes("展示評価")
			);
		});
}

function parseOmuraOriginalExhibition(html) {
	const $ = load(html);
	const table = findOmuraExhibitionTable($);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			const values = cells.map((cell) => readCellText($, cell)).filter(Boolean);

			if (values.length < 9) {
				return;
			}

			const frameNo = parseFrameNo(values[0]);

			if (!frameNo) {
				return;
			}

			const playerName = values[1] ?? "";
			const startTiming = values[2] ?? "";
			const exhibitionTime = values[3] ?? "";
			const oneLapTime = values[4] ?? "";
			const turnTime = values[5] ?? "";
			const straightTime = values[6] ?? "";
			const tilt = values[7] ?? "";
			const startDisplay = values[8] ?? "";
			const exhibitionEvaluation = values[9] ?? "";

			if (!oneLapTime && !turnTime && !straightTime && !exhibitionEvaluation) {
				return;
			}

			rows.push({
				frameNo,
				playerName,
				startTiming: isValidTimingValue(startTiming) ? startTiming : "",
				exhibitionTime,
				oneLapTime,
				turnTime,
				straightTime,
				tilt,
				startDisplay,
				exhibitionEvaluation,
				memo: "大村公式HP 直前予想から取得",
				source: OMURA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function normalizePlayerNameKey(value) {
	return compactText(value).replace(/\s+/g, "");
}

function parseOmuraProfileCell($, cell) {
	const registerNo = compactText($(cell).find(".y_toban").text());
	const playerName = compactText($(cell).find(".y_playername").text());
	const branch = compactText($(cell).find(".y_from").text()).replace(/[()]/g, "");
	const classAndMeta = compactText($(cell).find(".y_class").text());
	const [className = "", age = "", weight = ""] = classAndMeta.split("/").map((value) => compactText(value));

	return {
		registerNo,
		playerName,
		branch,
		className,
		age,
		weight,
		profile: [branch, age, weight].filter(Boolean).join("/"),
	};
}

function parseOmuraRateCell($, cell) {
	const values = readCleanLines($(cell));
	return {
		primary: values[0] ?? "",
		secondary: values[1] ?? "",
	};
}

function parseOmuraEntryTable(html) {
	const $ = load(html);
	const table = $("#new_player_table_wrap").first();
	if (!table.length) {
		return [];
	}

	const tableRows = table.find("tr").toArray();
	const rows = [];

	for (let index = 2; index < tableRows.length; index += 4) {
		const row1 = tableRows[index];
		const row2 = tableRows[index + 1];
		const row3 = tableRows[index + 2];
		const row4 = tableRows[index + 3];

		if (!row1 || !row2 || !row3 || !row4) {
			continue;
		}

		const row1Cells = $(row1).children("td,th").toArray();
		const row2Cells = $(row2).children("td,th").toArray();
		const row3Cells = $(row3).children("td,th").toArray();
		const row4Cells = $(row4).children("td,th").toArray();
		const boatCell = row1Cells[1];
		const profileCell = row1Cells[3];

		if (!boatCell || !profileCell) {
			continue;
		}

		const frameNo = parseEmbeddedFrameNo(readCellText($, boatCell));
		if (!frameNo) {
			continue;
		}

		const identity = parseOmuraProfileCell($, profileCell);
		if (!identity.playerName) {
			continue;
		}

		const national = parseOmuraRateCell($, row1Cells[7]);
		const motor = parseOmuraRateCell($, row1Cells[8]);
		const local = parseOmuraRateCell($, row3Cells[4]);
		const boat = parseOmuraRateCell($, row3Cells[5]);
		const accidentRate = readCellText($, row1Cells[row1Cells.length - 2]);
		const earlyGuide = readCellText($, row1Cells[row1Cells.length - 1]);

		rows.push({
			frameNo,
			className: identity.className,
			registerNo: identity.registerNo,
			playerName: identity.playerName,
			profile: identity.profile,
			branch: identity.branch,
			age: identity.age,
			weight: identity.weight,
			f: readCellText($, row1Cells[4]),
			l: readCellText($, row3Cells[1]),
			averageStart: readCellText($, row1Cells[row1Cells.length - 3]),
			accidentRate,
			earlyGuide,
			dashEvaluation: readCellText($, row1Cells[6]),
			stretchEvaluation: readCellText($, row2Cells[1]),
			turnEvaluation: readCellText($, row3Cells[3]),
			motorEvaluation: readCellText($, row4Cells[1]),
			nationalWinRate: national.primary,
			nationalSecondRate: national.secondary,
			localWinRate: local.primary,
			localSecondRate: local.secondary,
			motorNo: motor.primary,
			motorSecondRate: motor.secondary,
			boatNo: boat.primary,
			boatSecondRate: boat.secondary,
			source: OMURA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseOmuraNationalFrameStats(html) {
	const $ = load(html);
	const table = $("#tblcomment").first();
	if (!table.length) {
		return [];
	}

	const rows = [];
	const tableRows = table.find("tr").toArray();

	for (let index = 2; index < tableRows.length; index += 3) {
		const row1 = tableRows[index];
		const row2 = tableRows[index + 1];
		if (!row1 || !row2) {
			continue;
		}

		const row1Cells = $(row1).children("td,th").toArray();
		const row2Cells = $(row2).children("td,th").toArray();
		const frameNo = parseFrameNo(readCellText($, row1Cells[0]));
		const playerName = readCellText($, row1Cells[1]);
		if (!frameNo || !playerName) {
			continue;
		}

		const progressValues = $(row1Cells[2])
			.find("span.is-progress1, span.is-progress2, span.is-progress3, span.is-progress4")
			.toArray()
			.map((node) => compactText($(node).text()));

		rows.push({
			frameNo,
			playerName,
			firstRate: progressValues[0] ?? "",
			secondRate: progressValues[1] ?? "",
			thirdRate: progressValues[2] ?? "",
			otherRate: progressValues[3] ?? "",
			frameTrifectaRate: readCellText($, row2Cells[0]),
			frameAverageStart: readCellText($, row2Cells[1]),
			frameAverageStartRank: readCellText($, row2Cells[2]),
			source: OMURA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseOmuraFrameLast10(html) {
	const $ = load(html);
	const table = $("#result10").first();
	if (!table.length) {
		return [];
	}

	const rows = [];
	const tableRows = table.find("tr").toArray();

	for (let index = 1; index < tableRows.length; index += 3) {
		const courseRow = tableRows[index];
		const finishRow = tableRows[index + 1];
		const startRow = tableRows[index + 2];
		if (!courseRow || !finishRow || !startRow) {
			continue;
		}

		const courseCells = $(courseRow).children("td,th").toArray();
		const finishCells = $(finishRow).children("td,th").toArray();
		const startCells = $(startRow).children("td,th").toArray();
		const frameNo = parseFrameNo(readCellText($, courseCells[0]));
		const playerName = readCellText($, courseCells[1]);
		if (!frameNo || !playerName) {
			continue;
		}

		rows.push({
			frameNo,
			playerName,
			courseHistory: courseCells.slice(3, 13).map((cell) => readCellText($, cell)),
			finishHistory: finishCells.slice(1, 11).map((cell) => readCellText($, cell)),
			startTimingHistory: startCells.slice(1, 11).map((cell) => readCellText($, cell)),
			frameWinRate: readCellText($, courseCells[13]),
			frameAverageStart: readCellText($, courseCells[14]),
			source: OMURA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getPreviousDateKey(date) {
	const current = new Date(`${String(date ?? "")}T00:00:00+09:00`);
	if (Number.isNaN(current.getTime())) {
		return "";
	}

	current.setUTCDate(current.getUTCDate() - 1);
	return `${current.getUTCFullYear()}${String(current.getUTCMonth() + 1).padStart(2, "0")}${String(current.getUTCDate()).padStart(2, "0")}`;
}

function parseOmuraPreviousDayResults(html, date) {
	const $ = load(html);
	const table = $("#new_player_table_wrap").first();
	if (!table.length) {
		return [];
	}

	const previousDateKey = getPreviousDateKey(date);
	if (!previousDateKey) {
		return [];
	}

	const result = [];
	const tableRows = table.find("tr").toArray();

	for (let index = 2; index < tableRows.length; index += 4) {
		const row1 = tableRows[index];
		const row2 = tableRows[index + 1];
		const row3 = tableRows[index + 2];
		const row4 = tableRows[index + 3];
		if (!row1 || !row2 || !row3 || !row4) {
			continue;
		}

		const row1Cells = $(row1).children("td,th").toArray();
		const row2Cells = $(row2).children("td,th").toArray();
		const row3Cells = $(row3).children("td,th").toArray();
		const row4Cells = $(row4).children("td,th").toArray();

		const frameNo = parseEmbeddedFrameNo(readCellText($, row1Cells[1]));
		const identity = parseOmuraProfileCell($, row1Cells[3]);
		if (!frameNo || !identity.playerName) {
			continue;
		}

		const raceNoCells = row1Cells.slice(10, -3);
		const courseCells = row2Cells.slice(3);
		const startCells = row3Cells.slice(7);
		const finishCells = row4Cells.slice(3);
		const items = [];

		for (let cellIndex = 0; cellIndex < finishCells.length; cellIndex += 1) {
			const finishCell = finishCells[cellIndex];
			const link = $(finishCell).find("a").attr("href") || "";
			if (!link.includes(`day=${previousDateKey}`)) {
				continue;
			}

			const linkedRaceMatch = link.match(/race=(\d+)/);
			items.push({
				date: previousDateKey,
				raceNo: linkedRaceMatch?.[1] ?? readCellText($, raceNoCells[cellIndex]),
				course: readCellText($, courseCells[cellIndex]),
				startTiming: readCellText($, startCells[cellIndex]),
				finishOrder: readCellText($, finishCell),
			});
		}

		result.push({
			frameNo,
			className: identity.className,
			registerNo: identity.registerNo,
			playerName: identity.playerName,
			date: previousDateKey,
			items,
			source: OMURA_SOURCE,
		});
	}

	return result.sort((left, right) => left.frameNo - right.frameNo);
}

function parseOmuraExhibitionInfo(spHtml, chokuzenHtml, startHtml) {
	const rowsByFrame = new Map();

	const ensureRow = (frameNo) => {
		const existing = rowsByFrame.get(frameNo);
		if (existing) {
			return existing;
		}

		const created = {
			frameNo,
			course: "",
			playerName: "",
			startTiming: "",
			exhibitionTime: "",
			oneLapTime: "",
			turnTime: "",
			straightTime: "",
			tilt: "",
			partsExchange: "",
			startType: "",
			evaluation: "",
			source: OMURA_SOURCE,
		};

		rowsByFrame.set(frameNo, created);
		return created;
	};

	if (startHtml) {
		const $ = load(startHtml);
		$("#tblstart tr")
			.slice(1)
			.each((_, row) => {
				const cells = $(row).children("td,th").toArray();
				const frameNo = parseFrameNo(readCellText($, cells[0]));
				if (!frameNo) {
					return;
				}

				const exhibition = ensureRow(frameNo);
				exhibition.playerName = exhibition.playerName || compactText(readCellText($, cells[1]));
				exhibition.course = compactText(readCellText($, cells[2]));
				exhibition.startTiming = compactText(readCellText($, cells[3]));
			});
	}

	if (chokuzenHtml) {
		const $ = load(chokuzenHtml);
		const tableRows = $("#tblchokuzen tr").toArray();

		for (let index = 1; index < tableRows.length; index += 2) {
			const detailRow = tableRows[index];
			const partsRow = tableRows[index + 1];
			if (!detailRow) {
				continue;
			}

			const detailCells = $(detailRow).children("td,th").toArray();
			const frameNo = parseFrameNo(readCellText($, detailCells[0]));
			if (!frameNo) {
				continue;
			}

			const exhibition = ensureRow(frameNo);
			exhibition.playerName = exhibition.playerName || compactText(readCellText($, detailCells[1]));
			exhibition.exhibitionTime = exhibition.exhibitionTime || compactText(readCellText($, detailCells[4]));
			exhibition.tilt = compactText(readCellText($, detailCells[5]));
			exhibition.partsExchange = partsRow ? compactText($(partsRow).text()) : exhibition.partsExchange;
		}
	}

	if (spHtml) {
		const $ = load(spHtml);
		$("table.data.chokuzen")
			.first()
			.find("tr")
			.slice(1)
			.each((_, row) => {
				const cells = $(row).children("td,th").toArray();
				const frameNo = parseFrameNo(readCellText($, cells[0]));
				if (!frameNo) {
					return;
				}

				const exhibition = ensureRow(frameNo);
				exhibition.playerName = exhibition.playerName || compactText(readCellText($, cells[1]));
				exhibition.startTiming = exhibition.startTiming || compactText(readCellText($, cells[2]));
				exhibition.exhibitionTime = compactText(readCellText($, cells[3]));
				exhibition.oneLapTime = compactText(readCellText($, cells[4]));
				exhibition.turnTime = compactText(readCellText($, cells[5]));
				exhibition.straightTime = compactText(readCellText($, cells[6]));
				exhibition.tilt = exhibition.tilt || compactText(readCellText($, cells[7]));
				exhibition.startType = compactText(readCellText($, cells[8]));
				exhibition.evaluation = compactText(readCellText($, cells[9]));
			});
	}

	return Array.from(rowsByFrame.values())
		.filter((row) => row.frameNo && (row.playerName || row.course || row.startTiming || row.exhibitionTime || row.oneLapTime || row.turnTime || row.straightTime || row.tilt || row.partsExchange || row.startType || row.evaluation))
		.sort((left, right) => left.frameNo - right.frameNo);
}

function parseOmuraRacerCommentsMotor(html, entryRows) {
	const $ = load(html);
	const table = $("#tblcomment").first();
	if (!table.length || !entryRows.length) {
		return [];
	}

	const frameByName = new Map(entryRows.map((row) => [normalizePlayerNameKey(row.playerName), row.frameNo]));
	const rows = [];

	table.find("tr").slice(1).each((_, row) => {
		const cells = $(row).children("td,th").toArray();
		if (cells.length < 4) {
			return;
		}

		const playerName = compactText($(cells[0]).text());
		const frameNo = frameByName.get(normalizePlayerNameKey(playerName));
		if (!frameNo) {
			return;
		}

		const commentCell = $(cells[1]).clone();
		commentCell.find("br").replaceWith("\n");
		const comment = compactText(commentCell.text());
		const motorCell = $(cells[2]);

		rows.push({
			frameNo,
			playerName,
			comment,
			motorEvaluation: compactText(motorCell.find(".motorpoint").text()),
			motorNo: compactText(motorCell.find("a").text()).replace(/号機$/, ""),
			pastCommentUrl: $(cells[3]).find("a").attr("href") || "",
			source: OMURA_SOURCE,
		});
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

async function fetchOmuraRaceExtra({ date, raceNo }) {
	const day = toOmuraDay(date);
	const race = toOmuraRaceNo(raceNo);
	const topUrl = `https://omurakyotei.jp/yosou/sp/?day=${day}&race=${race}`;
	const entryUrl = `https://omurakyotei.jp/yosou/syussou.php?day=${day}&race=${race}`;
	const commentUrl = `https://omurakyotei.jp/yosou/comment.php?day=${day}&race=${race}`;
	const startUrl = `https://omurakyotei.jp/yosou/start.php?day=${day}&race=${race}`;
	const chokuzenUrl = `https://omurakyotei.jp/yosou/chokuzen.php?day=${day}&race=${race}`;

	try {
		const [topHtml, entryHtml, commentHtml, startHtml, chokuzenHtml] = await Promise.all([
			fetchHtml(topUrl),
			fetchHtml(entryUrl),
			fetchHtml(commentUrl),
			fetchHtml(startUrl),
			fetchHtml(chokuzenUrl),
		]);

		const originalExhibition = parseOmuraOriginalExhibition(topHtml);
		const omuraExhibitionInfo = parseOmuraExhibitionInfo(topHtml, chokuzenHtml, startHtml);
		const omuraEntryTable = parseOmuraEntryTable(entryHtml);
		const omuraNationalFrameStats = parseOmuraNationalFrameStats(entryHtml);
		const omuraFrameLast10 = parseOmuraFrameLast10(entryHtml);
		const omuraPreviousDayResults = parseOmuraPreviousDayResults(entryHtml, date);
		const omuraRacerCommentsMotor = parseOmuraRacerCommentsMotor(commentHtml, omuraEntryTable);
		const hasAnyData = Boolean(
			originalExhibition.length ||
			omuraExhibitionInfo.length ||
			omuraEntryTable.length ||
			omuraNationalFrameStats.length ||
			omuraFrameLast10.length ||
			omuraPreviousDayResults.some((row) => row.items.length > 0) ||
			omuraRacerCommentsMotor.length,
		);

		console.log(
			`[venue-extras] omura ${raceNo}R: entry ${omuraEntryTable.length}, prevday ${omuraPreviousDayResults.filter((row) => row.items.length > 0).length}, national ${omuraNationalFrameStats.length}, last10 ${omuraFrameLast10.length}, comments ${omuraRacerCommentsMotor.length}, exhibition ${omuraExhibitionInfo.length}`,
		);

		return {
			raceNo,
			status: hasAnyData ? "available" : "waiting",
			source: OMURA_SOURCE,
			sourceType: "official-venue-beforeinfo",
			originalExhibition,
			omuraExhibitionInfo,
			omuraEntryTable,
			omuraPreviousDayResults,
			omuraNationalFrameStats,
			omuraFrameLast10,
			omuraRacerCommentsMotor,
		};
	} catch (error) {
		console.warn(`[venue-extras] omura ${raceNo}R failed: ${error.message}`);
		return {
			raceNo,
			status: "fetch-failed",
			source: OMURA_SOURCE,
			sourceType: "official-venue-beforeinfo",
			originalExhibition: [],
			omuraExhibitionInfo: [],
			omuraEntryTable: [],
			omuraPreviousDayResults: [],
			omuraNationalFrameStats: [],
			omuraFrameLast10: [],
			omuraRacerCommentsMotor: [],
			note: error.message,
		};
	}
}

async function createOmuraVenue(feed, date) {
	const omuraVenue = findVenue(feed, OMURA_VENUE_NAME);

	if (!omuraVenue) {
		console.log("[venue-extras] omura: not held today");
		return null;
	}

	const races = getRaceList(omuraVenue);
	const raceExtras = [];

	for (const race of races) {
		const raceExtra = await fetchOmuraRaceExtra({
			date,
			raceNo: race.raceNo,
		});

		raceExtras.push(raceExtra);

		await sleep(REQUEST_INTERVAL_MS);
	}

	if (!raceExtras.some((raceExtra) =>
		Array.isArray(raceExtra?.omuraExhibitionInfo) && raceExtra.omuraExhibitionInfo.length > 0 ||
		Array.isArray(raceExtra?.omuraEntryTable) && raceExtra.omuraEntryTable.length > 0 ||
		Array.isArray(raceExtra?.omuraNationalFrameStats) && raceExtra.omuraNationalFrameStats.length > 0 ||
		Array.isArray(raceExtra?.omuraFrameLast10) && raceExtra.omuraFrameLast10.length > 0 ||
		Array.isArray(raceExtra?.omuraRacerCommentsMotor) && raceExtra.omuraRacerCommentsMotor.length > 0 ||
		Array.isArray(raceExtra?.originalExhibition) && raceExtra.originalExhibition.length > 0
	)) {
		console.log("[venue-extras] omura: held today, but no beforeinfo rows are available yet");

		return {
			venueCode: String(omuraVenue.venueCode ?? "24"),
			venueName: OMURA_VENUE_NAME,
			source: OMURA_SOURCE,
			isAvailable: false,
			status: "waiting-beforeinfo",
			note: "大村公式HPの直前展示はまだ公開前です。展示航走終了後に取得できる可能性があります。",
			races: [],
		};
	}

	return {
		venueCode: String(omuraVenue.venueCode ?? "24"),
		venueName: OMURA_VENUE_NAME,
		source: OMURA_SOURCE,
		isAvailable: true,
		note: "大村公式HPの出走表・前日成績・全国枠・枠番別過去10走・コメント/モーター評価・展示情報を追加保持",
		races: raceExtras,
	};
}

/**
 * 唐津
 */
function findKaratsuExhibitionTable($) {
	return $("table")
		.toArray()
		.find((table) => {
			const text = compactText($(table).text());

			return (
				text.includes("展示情報") ||
				(
					text.includes("体重") &&
					text.includes("チルト") &&
					text.includes("一周") &&
					text.includes("まわり足") &&
					text.includes("直線") &&
					text.includes("展示評価")
				)
			);
		});
}

function parseKaratsuOriginalExhibition(html) {
	const $ = load(html);
	const table = findKaratsuExhibitionTable($);

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			const values = cells.map((cell) => readCellText($, cell)).filter(Boolean);

			if (values.length < 8) {
				return;
			}

			const frameNo = parseFrameNo(values[0]);

			if (!frameNo) {
				return;
			}

			const weight = values[1] ?? "";
			const tilt = values[2] ?? "";
			const exhibitionTime = values[3] ?? "";
			const oneLapTime = values[4] ?? "";
			const turnTime = values[5] ?? "";
			const straightTime = values[6] ?? "";
			const exhibitionEvaluation = values[7] ?? "";

			if (!oneLapTime && !turnTime && !straightTime && !exhibitionEvaluation) {
				return;
			}

			rows.push({
				frameNo,
				weight,
				tilt,
				exhibitionTime,
				oneLapTime,
				turnTime,
				straightTime,
				exhibitionEvaluation,
				memo: "唐津公式HP 直前情報・予想から取得",
				source: KARATSU_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function findKaratsuRacerCommentStartIndex(lines) {
	for (let index = 0; index < lines.length; index += 1) {
		const current = compactText(lines[index]);
		const next = compactText(lines[index + 1]);
		const combinedHeading = `${current}${next}`;

		const looksLikeCommentHeading =
			current.includes("選手コメント") ||
			combinedHeading.includes("選手コメント") ||
			(current === "選手" && next === "コメント");

		if (!looksLikeCommentHeading) {
			continue;
		}

		const nearbyLines = lines.slice(index, index + 24).map((line) => compactText(line)).join(" ");

		if (
			nearbyLines.includes("前日") &&
			nearbyLines.includes("直前") &&
			nearbyLines.includes("履歴")
		) {
			return index;
		}
	}

	return -1;
}

function isKaratsuCommentCandidate(value) {
	const text = compactText(value);

	if (!text) {
		return false;
	}

	if (text.includes("選手コメント")) {
		return false;
	}

	if (text.includes("コメント履歴")) {
		return false;
	}

	if (text.includes("履歴")) {
		return false;
	}

	if (text.includes("前日") || text.includes("直前")) {
		return false;
	}

	if (text.includes("Image")) {
		return false;
	}

	if (text.includes("レース情報") || text.includes("データファイル")) {
		return false;
	}

	if (text.includes("Copyright")) {
		return false;
	}

	if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
		return false;
	}

	if (/^\d{4}$/.test(text)) {
		return false;
	}

	if (/^[1-6]$/.test(text)) {
		return false;
	}

	return text.length >= 6;
}

function parseKaratsuRacerComments(html) {
	const $ = load(html);
	const lines = readCleanLines($("body"));
	const startIndex = findKaratsuRacerCommentStartIndex(lines);

	if (startIndex < 0) {
		return [];
	}

	const endIndex = lines.findIndex((line, index) => {
		if (index <= startIndex) {
			return false;
		}

		return (
			line.includes("レース情報") ||
			line.includes("データファイル") ||
			line.includes("Copyright") ||
			line === "TOP"
		);
	});

	const scopedLines = lines.slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined);
	const comments = [];
	const seenFrames = new Set();

	for (let index = 0; index < scopedLines.length; index += 1) {
		const frameNo = parseFrameNo(scopedLines[index]);

		if (!frameNo || seenFrames.has(frameNo)) {
			continue;
		}

		for (let lookAhead = index + 1; lookAhead < Math.min(index + 14, scopedLines.length); lookAhead += 1) {
			const candidate = compactText(scopedLines[lookAhead]);

			if (parseFrameNo(candidate)) {
				break;
			}

			if (candidate.includes("コメント履歴")) {
				break;
			}

			if (!isKaratsuCommentCandidate(candidate)) {
				continue;
			}

			comments.push({
				frameNo,
				comment: candidate,
				source: KARATSU_SOURCE,
			});

			seenFrames.add(frameNo);
			break;
		}
	}

	return comments.sort((left, right) => left.frameNo - right.frameNo);
}

function normalizeKaratsuMotorGrade(value) {
	const text = compactText(value).replace(/[Ａ-Ｄ]/g, (char) =>
		String.fromCharCode(char.charCodeAt(0) - 0xfee0),
	);

	const match = text.match(/[A-D]/i);
	return match ? match[0].toUpperCase() : text;
}

function isKaratsuMotorNoLine(value) {
	return /^\d{1,3}$/.test(compactText(value));
}

function isKaratsuMotorResultLine(value) {
	const text = compactText(value).replace(/[－ー―]/g, "-");

	if (!text || text === "-") {
		return false;
	}

	return /^[0-9転落ＦＬ妨失欠不エ\-]+$/.test(text);
}

function isKaratsuMotorGradeLine(value) {
	return /^[A-DＡ-Ｄ]$/.test(compactText(value));
}

function isKaratsuMotorCommentLine(value) {
	const text = compactText(value);

	if (!text) {
		return false;
	}

	if (
		text.includes("モーター総括") ||
		text.includes("総括コメント") ||
		text.includes("節間成績") ||
		text.includes("素性") ||
		text.includes("使用選手") ||
		text.includes("表の見方") ||
		text.includes("2節前") ||
		text.includes("3節前") ||
		text.includes("前節")
	) {
		return false;
	}

	if (/^[1-6]$/.test(text)) {
		return false;
	}

	if (isKaratsuMotorNoLine(text) || isKaratsuMotorGradeLine(text) || isKaratsuMotorResultLine(text)) {
		return false;
	}

	return text.length >= 6;
}

function parseKaratsuMotorSummaryFromTable(html) {
	const $ = load(html);
	const table = $("table")
		.toArray()
		.find((tableElement) => {
			const text = compactText($(tableElement).text());

			return (
				text.includes("総括コメント") &&
				text.includes("素性") &&
				text.includes("節間成績")
			);
		});

	if (!table) {
		return [];
	}

	const rows = [];

	$(table)
		.find("tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			const values = cells.map((cell) => readCellText($, cell)).filter(Boolean);

			if (values.length < 5) {
				return;
			}

			const frameNo = parseFrameNo(values[0]);

			if (!frameNo) {
				return;
			}

			const motorNo = values[1] ?? "";
			const previousUser = values[2] ?? "";
			const recentResults = values[3] ?? "";
			const motorGrade = normalizeKaratsuMotorGrade(values[4] ?? "");
			const comment = compactText(values.slice(5).join(" "));

			if (!motorNo && !comment) {
				return;
			}

			rows.push({
				frameNo,
				motorNo,
				previousUser,
				recentResults,
				motorGrade,
				comment,
				source: KARATSU_SOURCE,
			});
		});

	return rows
		.filter((row) => row.frameNo >= 1 && row.frameNo <= 6)
		.slice(0, 6)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKaratsuMotorSummaryFromLines(html) {
	const $ = load(html);
	const lines = readCleanLines($("body")).map((line) => compactText(line));
	const startIndex = lines.findIndex((line) => line.includes("モーター総括"));

	if (startIndex < 0) {
		return [];
	}

	const headerEndIndex = lines.findIndex((line, index) => {
		if (index <= startIndex) {
			return false;
		}

		return line.includes("総括コメント");
	});

	const dataStartIndex = headerEndIndex > startIndex ? headerEndIndex + 1 : startIndex + 1;

	const endIndex = lines.findIndex((line, index) => {
		if (index <= dataStartIndex) {
			return false;
		}

		return (
			line === "2節前" ||
			line === "前節" ||
			line === "3節前" ||
			line.includes("表の見方") ||
			line.includes("レース情報") ||
			line.includes("データファイル")
		);
	});

	const scopedLines = lines
		.slice(dataStartIndex, endIndex > dataStartIndex ? endIndex : undefined)
		.map((line) => compactText(line))
		.filter(Boolean);

	const rows = [];
	const seenFrames = new Set();

	for (let index = 0; index < scopedLines.length - 5; index += 1) {
		const frameNo = parseFrameNo(scopedLines[index]);

		if (!frameNo || seenFrames.has(frameNo)) {
			continue;
		}

		const motorNo = compactText(scopedLines[index + 1]);
		const previousUser = compactText(scopedLines[index + 2]);
		const recentResults = compactText(scopedLines[index + 3]);
		const motorGrade = normalizeKaratsuMotorGrade(scopedLines[index + 4]);
		const comment = compactText(scopedLines[index + 5]);

		if (
			!isKaratsuMotorNoLine(motorNo) ||
			!previousUser ||
			!isKaratsuMotorResultLine(recentResults) ||
			!isKaratsuMotorGradeLine(motorGrade) ||
			!isKaratsuMotorCommentLine(comment)
		) {
			continue;
		}

		rows.push({
			frameNo,
			motorNo,
			previousUser,
			recentResults,
			motorGrade,
			comment,
			source: KARATSU_SOURCE,
		});

		seenFrames.add(frameNo);
		index += 5;
	}

	return rows
		.filter((row) => row.frameNo >= 1 && row.frameNo <= 6)
		.slice(0, 6)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKaratsuMotorSummary(html) {
	const lineRows = parseKaratsuMotorSummaryFromLines(html);

	if (lineRows.length > 0) {
		return lineRows;
	}

	return parseKaratsuMotorSummaryFromTable(html);
}

function isKaratsuAbilityNumber(value) {
	const text = compactText(value);

	if (text === "-") {
		return true;
	}

	return /^-?\d+(\.\d+)?$/.test(text);
}

function isKaratsuStartPowerValue(value) {
	const text = compactText(value);

	if (text === "-" || text === "—") {
		return true;
	}

	return /^\.?\d{1,2}$/.test(text) || /^\d\.\d{1,2}$/.test(text);
}

function parseKaratsuAbilityIndex(html) {
	const $ = load(html);
	const lines = readCleanLines($("body")).map((line) => compactText(line));

	const startIndex = lines.findIndex((line, index) => {
		if (line !== "能力指数") {
			return false;
		}

		const nearbyLines = lines.slice(index, index + 12).join(" ");

		return (
			nearbyLines.includes("能力値") &&
			nearbyLines.includes("枠番相性") &&
			nearbyLines.includes("スタート力")
		);
	});

	if (startIndex < 0) {
		return [];
	}

	const headerEndIndex = lines.findIndex((line, index) => {
		if (index <= startIndex) {
			return false;
		}

		return line.includes("スタート力");
	});

	if (headerEndIndex < 0) {
		return [];
	}

	const dataStartIndex = headerEndIndex + 1;

	const endIndex = lines.findIndex((line, index) => {
		if (index <= dataStartIndex) {
			return false;
		}

		return (
			line.includes("表の見方") ||
			line.includes("レース情報") ||
			line.includes("データファイル") ||
			line.includes("オッズ") ||
			line.includes("結果") ||
			line.includes("Copyright")
		);
	});

	const scopedLines = lines
		.slice(dataStartIndex, endIndex > dataStartIndex ? endIndex : undefined)
		.map((line) => compactText(line))
		.filter(Boolean);

	const rows = [];
	const seenFrames = new Set();

	for (let index = 0; index < scopedLines.length - 3; index += 1) {
		const frameNo = parseFrameNo(scopedLines[index]);

		if (!frameNo || seenFrames.has(frameNo)) {
			continue;
		}

		const abilityValue = compactText(scopedLines[index + 1]);
		const frameCompatibility = compactText(scopedLines[index + 2]);
		const startPower = compactText(scopedLines[index + 3]);

		if (
			!isKaratsuAbilityNumber(abilityValue) ||
			!isKaratsuAbilityNumber(frameCompatibility) ||
			!isKaratsuStartPowerValue(startPower)
		) {
			continue;
		}

		rows.push({
			frameNo,
			abilityValue,
			frameCompatibility,
			startPower,
			source: KARATSU_SOURCE,
		});

		seenFrames.add(frameNo);
		index += 3;
	}

	return rows
		.filter((row) => row.frameNo >= 1 && row.frameNo <= 6)
		.slice(0, 6)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function findKaratsuStartExhibitionTable($) {
	return $("table")
		.toArray()
		.find((tableElement) => {
			const text = compactText($(tableElement).text());

			return (
				text.includes("スタート展示") &&
				text.includes("今節平均ST") &&
				text.includes("スタート順") &&
				text.includes("コース")
			);
		});
}

function isKaratsuStartTimingValue(value) {
	const text = compactText(value);

	return /^F?\.\d{2}$/.test(text);
}

function isKaratsuStartOrderValue(value) {
	const text = compactText(value);

	return /^-+$/.test(text) || /^\d+(\.\d+)?$/.test(text);
}

function parseKaratsuStartExhibition(html) {
	const $ = load(html);
	const lines = readCleanLines($("body")).map((line) => compactText(line));

	const startIndex = lines.findIndex((line, index) => {
		if (line !== "スタート展示") {
			return false;
		}

		const nearbyLines = lines.slice(index, index + 12).map((item) => compactText(item));

		return (
			nearbyLines.some((item) => item.includes("コ｜ス") || item.includes("コース")) &&
			nearbyLines.some((item) => item.includes("今節平均ST")) &&
			nearbyLines.some((item) => item.includes("スタート順"))
		);
	});

	if (startIndex < 0) {
		return [];
	}

	const headerEndIndex = lines.findIndex((line, index) => {
		if (index <= startIndex) {
			return false;
		}

		return line.includes("スタート順");
	});

	if (headerEndIndex < 0) {
		return [];
	}

	const dataStartIndex = headerEndIndex + 1;

	const endIndex = lines.findIndex((line, index) => {
		if (index <= dataStartIndex) {
			return false;
		}

		return (
			line.includes("S…スロースタート") ||
			line.includes("水面気象状況") ||
			line.includes("展示情報") ||
			line.includes("選手コメント") ||
			line.includes("からつ専属解説者")
		);
	});

	const scopedLines = lines
		.slice(dataStartIndex, endIndex > dataStartIndex ? endIndex : undefined)
		.map((line) => compactText(line))
		.filter(Boolean);

	const rows = [];
	const seenCourses = new Set();

	for (let index = 0; index < scopedLines.length - 5; index += 1) {
		const course = parseFrameNo(scopedLines[index]);
		const frameNo = parseFrameNo(scopedLines[index + 1]);

		if (!course || !frameNo || seenCourses.has(course)) {
			continue;
		}

		const currentAverageStart = compactText(scopedLines[index + 2]);
		const style = compactText(scopedLines[index + 3]);
		const startTiming = compactText(scopedLines[index + 4]);
		const startOrder = compactText(scopedLines[index + 5]);

		if (style !== "S" && style !== "D") {
			continue;
		}

		if (!isKaratsuStartTimingValue(startTiming)) {
			continue;
		}

		rows.push({
			course,
			frameNo,
			currentAverageStart,
			style,
			startTiming,
			startOrder,
			source: KARATSU_SOURCE,
		});

		seenCourses.add(course);
		index += 5;
	}

	return rows
		.filter((row) => row.course >= 1 && row.course <= 6 && row.frameNo >= 1 && row.frameNo <= 6)
		.slice(0, 6)
		.sort((left, right) => left.course - right.course);
}

function parseKaratsuVenuePrediction(html) {
	const $ = load(html);
	const lines = readCleanLines($("body"));
	const startIndex = lines.findIndex((line) => line.includes("からつ専属解説者の直前予想"));

	if (startIndex < 0) {
		return null;
	}

	const endIndex = lines.findIndex((line, index) => index > startIndex && (
		line.includes("AI予想") ||
		line.includes("水面気象状況") ||
		line.includes("前走成績")
	));

	const scopedLines = lines.slice(startIndex + 1, endIndex > startIndex ? endIndex : startIndex + 20);
	const confidenceLineIndex = scopedLines.findIndex((line) => line.includes("自信度"));
	const focusLines = scopedLines
		.filter((line) => line.includes("本命") || line.includes("押さえ"))
		.map(parseFocusLine)
		.filter(Boolean);

	let confidence = "";

	if (confidenceLineIndex >= 0) {
		const sameLineMatch = scopedLines[confidenceLineIndex].match(/(\d+%)/);
		const nextLineMatch = scopedLines[confidenceLineIndex + 1]?.match(/(\d+%)/);
		confidence = sameLineMatch?.[1] ?? nextLineMatch?.[1] ?? "";
	}

	const commentLines = scopedLines.filter((line) => {
		if (line.includes("コメント")) {
			return false;
		}

		if (line.includes("本命") || line.includes("押さえ") || line.includes("自信度")) {
			return false;
		}

		if (/^\d+%$/.test(line)) {
			return false;
		}

		return line.length > 0;
	});

	const comment = compactText(commentLines.join(" "));

	if (!confidence && !focusLines.length && !comment) {
		return null;
	}

	return {
		confidence,
		mainFocus: focusLines,
		comment,
		source: KARATSU_SOURCE,
	};
}

async function fetchKaratsuRaceExtra({ raceNo }) {
	const url = `https://www.boatrace-karatsu.jp/sp/index.php?page=yosou-cyokuzen&race=${raceNo}`;
	const syussouUrl = `https://www.boatrace-karatsu.jp/sp/index.php?page=yosou-syussou&race=${raceNo}`;


	try {
		const html = await fetchHtml(url);
		const originalExhibition = parseKaratsuOriginalExhibition(html);
		const venuePrediction = parseKaratsuVenuePrediction(html);
		const racerComments = parseKaratsuRacerComments(html);
		const startExhibition = parseKaratsuStartExhibition(html);

		let motorSummary = [];
		let abilityIndex = [];

		try {
			const syussouHtml = await fetchHtml(syussouUrl);
			motorSummary = parseKaratsuMotorSummary(syussouHtml);
			abilityIndex = parseKaratsuAbilityIndex(syussouHtml);
			} catch (error) {
				console.warn(`[venue-extras] karatsu ${raceNo}R motor summary failed: ${error.message}`);
			}

		if (
			!originalExhibition.length &&
			!venuePrediction &&
			!racerComments.length &&
			!startExhibition.length &&
			!motorSummary.length &&
			!abilityIndex.length
		) {
			console.log(`[venue-extras] karatsu ${raceNo}R: no extra rows yet`);
			return null;
		}

		console.log(
				`[venue-extras] karatsu ${raceNo}R: ${originalExhibition.length} exhibition rows${venuePrediction ? " + prediction" : ""}${racerComments.length ? ` + ${racerComments.length} comments` : ""}${startExhibition.length ? ` + ${startExhibition.length} start rows` : ""}${motorSummary.length ? ` + ${motorSummary.length} motor summaries` : ""}${abilityIndex.length ? ` + ${abilityIndex.length} ability rows` : ""}`,
		);

		return {
			raceNo,
	        status: "available",
	        source: KARATSU_SOURCE,
	        sourceType: "official-venue-beforeinfo",
	        originalExhibition,
	        venuePrediction,
	        racerComments,
	        startExhibition,
	        motorSummary,
	        abilityIndex,
		};
	} catch (error) {
		console.warn(`[venue-extras] karatsu ${raceNo}R failed: ${error.message}`);
		return null;
	}
}

async function createKaratsuVenue(feed) {
	const karatsuVenue = findVenue(feed, KARATSU_VENUE_NAME);

	if (!karatsuVenue) {
		console.log("[venue-extras] karatsu: not held today");
		return null;
	}

	const races = getRaceList(karatsuVenue);
	const raceExtras = [];

	for (const race of races) {
		const raceExtra = await fetchKaratsuRaceExtra({
			raceNo: race.raceNo,
		});

		if (raceExtra) {
			raceExtras.push(raceExtra);
		}

		await sleep(REQUEST_INTERVAL_MS);
	}

	if (!raceExtras.length) {
		console.log("[venue-extras] karatsu: held today, but no beforeinfo rows are available yet");

		return {
			venueCode: String(karatsuVenue.venueCode ?? "23"),
			venueName: KARATSU_VENUE_NAME,
			source: KARATSU_SOURCE,
			isAvailable: false,
			status: "waiting-beforeinfo",
			note: "唐津公式HPの直前情報・予想はまだ公開前、またはHTML構造が未対応です。",
			races: [],
		};
	}

	return {
		venueCode: String(karatsuVenue.venueCode ?? "23"),
		venueName: KARATSU_VENUE_NAME,
		source: KARATSU_SOURCE,
		isAvailable: true,
		note: "唐津公式HPの直前情報・予想から、独自展示タイム・展示評価・直前予想を取得",
		races: raceExtras,
	};
}

function toHalfWidthDigits(value) {
	return String(value ?? "").replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function normalizeMarugameCell(value) {
	return compactText(toHalfWidthDigits(value))
		.replace(/[％%]/g, "")
		.replace(/[－ー−]/g, "-");
}

function normalizeMarugameMotorNo(value) {
	const text = normalizeMarugameCell(value).replace(/[^\d]/g, "");

	if (!text) {
		return "";
	}

	return String(Number.parseInt(text, 10));
}

function isMarugameDecimal(value) {
	return /^[0-9]+(?:\.[0-9]+)?$/.test(normalizeMarugameCell(value));
}

function isMarugameInteger(value) {
	return /^\d+$/.test(normalizeMarugameCell(value));
}

function toMarugameRaceNo(raceNo) {
	return String(raceNo).padStart(2, "0");
}

function toMarugameYosoUrl(date, raceNo) {
	const month = String(date ?? "").split("-")[1] ?? "05";
	const normalizedMonth = month.padStart(2, "0");
	const normalizedRaceNo = toMarugameRaceNo(raceNo);

	return `https://www.marugameboat.jp/asp/kyogi/15/pc/yoso${normalizedMonth}${normalizedRaceNo}.htm`;
}

/**
 * 丸亀
 */
function normalizeMarugameMotorGrade(rateValue) {
	const rate = Number.parseFloat(String(rateValue ?? "").replace("%", ""));

	if (!Number.isFinite(rate)) {
		return "C";
	}

	if (rate >= 45) {
		return "A";
	}

	if (rate >= 38) {
		return "B";
	}

	if (rate >= 30) {
		return "C";
	}

	return "D";
}

function parseMarugameMotorData(html) {
	const $ = load(html);
	const rows = [];

	$("tr").each((_, row) => {
		const cells = $(row)
			.find("th, td")
			.map((__, cell) => normalizeMarugameCell($(cell).text()))
			.get()
			.filter(Boolean);

		if (cells.length < 10) {
			return;
		}

		for (let index = 0; index <= cells.length - 10; index += 1) {
			const motorNo = normalizeMarugameMotorNo(cells[index]);
			const twoRate = normalizeMarugameCell(cells[index + 1]);
			const winRate = normalizeMarugameCell(cells[index + 2]);
			const firstCount = normalizeMarugameCell(cells[index + 3]);
			const secondCount = normalizeMarugameCell(cells[index + 4]);
			const thirdCount = normalizeMarugameCell(cells[index + 5]);
			const starts = normalizeMarugameCell(cells[index + 6]);
			const finals = normalizeMarugameCell(cells[index + 7]);
			const championships = normalizeMarugameCell(cells[index + 8]);
			const bestTime = normalizeMarugameCell(cells[index + 9]);

			if (
				!motorNo ||
				!isMarugameDecimal(twoRate) ||
				!isMarugameDecimal(winRate) ||
				!isMarugameInteger(firstCount) ||
				!isMarugameInteger(secondCount) ||
				!isMarugameInteger(thirdCount) ||
				!isMarugameInteger(starts) ||
				!isMarugameInteger(finals) ||
				!isMarugameInteger(championships)
			) {
				continue;
			}

			rows.push({
				motorNo,
				twoRate,
				winRate,
				firstCount,
				secondCount,
				thirdCount,
				starts,
				finals,
				championships,
				bestTime,
				source: MARUGAME_SOURCE,
			});

			break;
		}
	});

	if (rows.length === 0) {
		const bodyText = toHalfWidthDigits($("body").text()).replace(/\s+/g, " ");
		const fallbackPattern =
			/(?:^|\s)(\d{1,3})\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9]'[0-9]{2}"[0-9])/g;

		let match = fallbackPattern.exec(bodyText);

		while (match) {
			rows.push({
				motorNo: normalizeMarugameMotorNo(match[1]),
				twoRate: match[2],
				winRate: match[3],
				firstCount: match[4],
				secondCount: match[5],
				thirdCount: match[6],
				starts: match[7],
				finals: match[8],
				championships: match[9],
				bestTime: match[10],
				source: MARUGAME_SOURCE,
			});

			match = fallbackPattern.exec(bodyText);
		}
	}

	const uniqueRows = Array.from(new Map(rows.map((row) => [row.motorNo, row])).values());

	return uniqueRows;
}

function parseMarugameTideInfo(html, date) {
	const $ = load(html);
	const lines = readCleanLines($("body"));
	const targetDate = String(date ?? "").replace(/^\d{4}-/, "").replace("-", "/").replace(/^0/, "").replace("/0", "/");

	for (const line of lines) {
		const text = compactText(line);

		if (!text.startsWith(targetDate)) {
			continue;
		}

		const match = text.match(/^(\d{1,2}\/\d{1,2})\s+(.+?)\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+(.+)$/);

		if (!match) {
			continue;
		}

		return {
			date: match[1],
			dayLabel: match[2],
			highTideTime: match[3],
			lowTideTime: match[4],
			tideType: match[5],
			source: MARUGAME_SOURCE,
		};
	}

	return null;
}

function parseMarugameWaterSurfaceInfo(html) {
	const $ = load(html);
	const lines = readCleanLines($("body"));

	const surfaceIndex = lines.findIndex((line) => line.includes("水質") && line.includes("水位変化"));
	const featureIndex = lines.findIndex((line) => line.includes("水面特性"));
	const courseIndex = lines.findIndex((line) => line.includes("コース特性・レース傾向"));

	const surfaceSummary = surfaceIndex >= 0 ? compactText(lines.slice(surfaceIndex, surfaceIndex + 3).join(" ")) : "";
	const featureSummary = featureIndex >= 0 ? compactText(lines.slice(featureIndex + 1, featureIndex + 3).join(" ")) : "";
	const courseSummary = courseIndex >= 0 ? compactText(lines.slice(courseIndex + 1, courseIndex + 3).join(" ")) : "";

	if (!surfaceSummary && !featureSummary && !courseSummary) {
		return null;
	}

	return {
		surfaceSummary,
		featureSummary,
		courseSummary,
		source: MARUGAME_SOURCE,
	};
}

function isMarugameTimeValue(value) {
	const text = normalizeMarugameCell(value);

	return /^-+$/.test(text) || /^[0-9]{1,2}\.[0-9]{1,2}$/.test(text);
}

function isMarugameTiltValue(value) {
	const text = normalizeMarugameCell(value);

	return /^-+$/.test(text) || /^[+-]?[0-9](?:\.[0-9])?$/.test(text);
}

function parseMarugameOriginalExhibition(html) {
	const $ = load(html);
	const rawText = $("body").text();
	const normalizedText = compactText(rawText);

	const sectionStart = normalizedText.indexOf("オリジナル展示データ");

	if (sectionStart < 0) {
		return [];
	}

	const sectionEndCandidates = [
		normalizedText.indexOf("一周・まわり足・直線タイム", sectionStart),
		normalizedText.indexOf("選手コメント", sectionStart),
		normalizedText.indexOf("枠番別", sectionStart),
		normalizedText.indexOf("オッズ", sectionStart),
		normalizedText.indexOf("結果", sectionStart),
	].filter((index) => index > sectionStart);

	const sectionEnd = sectionEndCandidates.length
		? Math.min(...sectionEndCandidates)
		: normalizedText.length;

	const sectionText = normalizedText.slice(sectionStart, sectionEnd);

	const rows = [];
	const seenFrames = new Set();

	const rowPattern =
		/(?:^|\s)([1-6])\s+([AB]\d)(\d{4})\s+(.+?)\s+(\d{1,3}\/[^/\s]+\/\d{2})\s+([0-9]{2}\.[0-9])\s+([+-]?[0-9]\.[0-9])\s+([0-9]\.[0-9]{2})\s+([0-9]{2}\.[0-9]{2})\s+([0-9]\.[0-9]{2})\s+([0-9]\.[0-9]{2})(?:\s+([+-]?[0-9]\.[0-9]))?(?=\s+(?:[1-6]\s+[AB]\d\d{4}|$))/g;

	let match = rowPattern.exec(sectionText);

	while (match) {
		const frameNo = Number.parseInt(match[1], 10);

		if (frameNo >= 1 && frameNo <= 6 && !seenFrames.has(frameNo)) {
			rows.push({
				frameNo,
				playerName: compactText(match[4]),
				className: match[2],
				registerNo: match[3],
				profile: match[5],
				weight: match[6],
				tilt: match[7],
				exhibitionTime: match[8],
				oneLapTime: match[9],
				turnTime: match[10],
				straightTime: match[11],
				weightAdjustment: match[12] ?? "",
				exhibitionEvaluation: "",
				memo: "丸亀公式HP 直前情報・オリジナル展示から取得",
				source: MARUGAME_SOURCE,
			});

			seenFrames.add(frameNo);
		}

		match = rowPattern.exec(sectionText);
	}

	if (rows.length === 0) {
		console.log("[venue-extras debug] marugame original exhibition section sample:", sectionText.slice(0, 800));
	}

	return rows
		.filter((row) => row.frameNo >= 1 && row.frameNo <= 6)
		.slice(0, 6)
		.sort((left, right) => left.frameNo - right.frameNo);
}

async function fetchMarugameRaceExtra({ date, raceNo }) {
	const url = toMarugameYosoUrl(date, raceNo);

	try {
		const html = await fetchHtml(url);
		const originalExhibition = parseMarugameOriginalExhibition(html);

		if (!originalExhibition.length) {
			console.log(`[venue-extras] marugame ${raceNo}R: no original exhibition rows yet`);
			return {
				raceNo,
				originalExhibition: [],
			};
		}

		console.log(`[venue-extras] marugame ${raceNo}R: ${originalExhibition.length} original exhibition rows`);

		return {
			raceNo,
			originalExhibition,
		};
	} catch (error) {
		console.warn(`[venue-extras] marugame ${raceNo}R original exhibition failed: ${error.message}`);

		return {
			raceNo,
			originalExhibition: [],
		};
	}
}

function createMarugameRaceMotorSummary(race, motorData) {
	const racers = Array.isArray(race?.racers) ? race.racers : [];

	return racers
		.map((racer) => {
			const frameNo = Number(racer?.frameNo ?? racer?.frame ?? racer?.boatNumber);
			const motorNo = normalizeMarugameMotorNo(racer?.motorNo ?? racer?.motorNumber);
			const motor = motorData.find((item) => item.motorNo === motorNo);

			if (!frameNo || !motorNo || !motor) {
				return null;
			}

			return {
				frameNo,
				motorNo,
				previousUser: `モーター${motor.motorNo}`,
				recentResults: `2連率 ${motor.twoRate}% / 勝率 ${motor.winRate}`,
				motorGrade: normalizeMarugameMotorGrade(motor.twoRate),
				comment: `丸亀公式モーターデータ：1着${motor.firstCount} / 2着${motor.secondCount} / 3着${motor.thirdCount} / 出走${motor.starts} / 優出${motor.finals} / 優勝${motor.championships} / 最高${motor.bestTime}`,
				source: MARUGAME_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

async function createMarugameVenue(feed, date) {
	const marugameVenue = findVenue(feed, MARUGAME_VENUE_NAME);

	if (!marugameVenue) {
		console.log("[venue-extras] marugame: not held today");
		return null;
	}

	try {
		const [motorHtml, tideHtml, waterSurfaceHtml] = await Promise.all([
			fetchHtml(MARUGAME_MOTOR_DATA_URL),
			fetchHtml(MARUGAME_TIDE_URL),
			fetchHtml(MARUGAME_WATER_SURFACE_URL),
		]);

		const motorData = parseMarugameMotorData(motorHtml);
		const tideInfo = parseMarugameTideInfo(tideHtml, date);
		const waterSurfaceInfo = parseMarugameWaterSurfaceInfo(waterSurfaceHtml);
		const races = getRaceList(marugameVenue);
		const raceExtras = [];

		for (const race of races) {
	const motorSummary = createMarugameRaceMotorSummary(race, motorData);
	const raceOfficialExtra = await fetchMarugameRaceExtra({
		date,
		raceNo: race.raceNo,
	});

	const originalExhibition = raceOfficialExtra?.originalExhibition ?? [];

	if (!motorSummary.length && !originalExhibition.length && !waterSurfaceInfo && !tideInfo) {
		continue;
	}

	raceExtras.push({
		raceNo: race.raceNo,
		status: "available",
		source: MARUGAME_SOURCE,
		sourceType: "official-venue-motor-tide-original-exhibition",
		originalExhibition,
		motorSummary,
		tideInfo,
		waterSurfaceInfo,
	});

	await sleep(REQUEST_INTERVAL_MS);
}

		if (!raceExtras.length) {
			console.log("[venue-extras] marugame: held today, but no motor summary rows are available yet");

			return {
				venueCode: String(marugameVenue.venueCode ?? "15"),
				venueName: MARUGAME_VENUE_NAME,
				source: MARUGAME_SOURCE,
				isAvailable: false,
				status: "waiting-motor-data",
				note: "丸亀公式HPのモーターデータ照合がまだできませんでした。",
				races: [],
			};
		}

		console.log(
			`[venue-extras] marugame: ${raceExtras.length} races + ${motorData.length} motor rows${tideInfo ? " + tide" : ""}${waterSurfaceInfo ? " + water surface" : ""}`,
		);

		return {
			venueCode: String(marugameVenue.venueCode ?? "15"),
			venueName: MARUGAME_VENUE_NAME,
			source: MARUGAME_SOURCE,
			isAvailable: true,
			note: "丸亀公式HPのモーターデータ・潮汐表・水面特性から、会場独自データを取得",
			tideInfo,
			waterSurfaceInfo,
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] marugame failed: ${error.message}`);

		return {
			venueCode: String(marugameVenue.venueCode ?? "15"),
			venueName: MARUGAME_VENUE_NAME,
			source: MARUGAME_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `丸亀公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
}

/**
 * 鳴門
 */
function normalizeNarutoCell(value) {
	return compactText(value)
		.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
		.replace(/[％%]/g, "")
		.replace(/[－ー−]/g, "-")
		.replace(/[’′]/g, "'")
		.replace(/[”″]/g, '"');
}

function normalizeNarutoMotorNo(value) {
	const text = normalizeNarutoCell(value).replace(/[^\d]/g, "");

	if (!text) {
		return "";
	}

	return String(Number.parseInt(text, 10));
}

function isNarutoDecimal(value) {
	return /^[0-9]+(?:\.[0-9]+)?$/.test(normalizeNarutoCell(value));
}

function isNarutoInteger(value) {
	return /^\d+$/.test(normalizeNarutoCell(value));
}

function isNarutoBestTime(value) {
	return /^[0-9]'[0-9]{2}"[0-9]$/.test(normalizeNarutoCell(value));
}

function normalizeNarutoMotorGrade(rateValue) {
	const rate = Number.parseFloat(normalizeNarutoCell(rateValue));

	if (!Number.isFinite(rate)) {
		return "C";
	}

	if (rate >= 50) {
		return "A";
	}

	if (rate >= 40) {
		return "B";
	}

	if (rate >= 32) {
		return "C";
	}

	return "D";
}

function parseNarutoMotorData(html) {
	const $ = load(html);
	const rows = [];

	$("tr").each((_, row) => {
		const cells = $(row)
			.find("th, td")
			.map((__, cell) => normalizeNarutoCell($(cell).text()))
			.get()
			.filter(Boolean);

		if (cells.length < 11) {
			return;
		}

		for (let index = 0; index <= cells.length - 11; index += 1) {
			const motorNo = normalizeNarutoMotorNo(cells[index]);
			const twoRate = normalizeNarutoCell(cells[index + 1]);
			const winRate = normalizeNarutoCell(cells[index + 2]);
			const firstCount = normalizeNarutoCell(cells[index + 3]);
			const secondCount = normalizeNarutoCell(cells[index + 4]);
			const thirdCount = normalizeNarutoCell(cells[index + 5]);
			const starts = normalizeNarutoCell(cells[index + 6]);
			const finals = normalizeNarutoCell(cells[index + 7]);
			const championships = normalizeNarutoCell(cells[index + 8]);
			const averageExhibitionTime = normalizeNarutoCell(cells[index + 9]);
			const bestTime = normalizeNarutoCell(cells[index + 10]);

			if (
				!motorNo ||
				!isNarutoDecimal(twoRate) ||
				!isNarutoDecimal(winRate) ||
				!isNarutoInteger(firstCount) ||
				!isNarutoInteger(secondCount) ||
				!isNarutoInteger(thirdCount) ||
				!isNarutoInteger(starts) ||
				!isNarutoInteger(finals) ||
				!isNarutoInteger(championships) ||
				!isNarutoDecimal(averageExhibitionTime) ||
				!isNarutoBestTime(bestTime)
			) {
				continue;
			}

			const escape = normalizeNarutoCell(cells[index + 11] ?? "");
			const turn = normalizeNarutoCell(cells[index + 12] ?? "");
			const difference = normalizeNarutoCell(cells[index + 13] ?? "");
			const turnDifference = normalizeNarutoCell(cells[index + 14] ?? "");
			const comeFromBehind = normalizeNarutoCell(cells[index + 15] ?? "");
			const benefit = normalizeNarutoCell(cells[index + 16] ?? "");

			rows.push({
				motorNo,
				twoRate,
				winRate,
				firstCount,
				secondCount,
				thirdCount,
				starts,
				finals,
				championships,
				averageExhibitionTime,
				bestTime,
				decidingMoves: {
					escape: isNarutoInteger(escape) ? escape : "",
					turn: isNarutoInteger(turn) ? turn : "",
					difference: isNarutoInteger(difference) ? difference : "",
					turnDifference: isNarutoInteger(turnDifference) ? turnDifference : "",
					comeFromBehind: isNarutoInteger(comeFromBehind) ? comeFromBehind : "",
					benefit: isNarutoInteger(benefit) ? benefit : "",
				},
				source: NARUTO_SOURCE,
			});

			break;
		}
	});

	if (rows.length === 0) {
		const bodyText = normalizeNarutoCell($("body").text()).replace(/\s+/g, " ");
		const fallbackPattern =
			/(?:^|\s)(\d{1,3})\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]'[0-9]{2}"[0-9])(?:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+))?/g;

		let match = fallbackPattern.exec(bodyText);

		while (match) {
			rows.push({
				motorNo: normalizeNarutoMotorNo(match[1]),
				twoRate: match[2],
				winRate: match[3],
				firstCount: match[4],
				secondCount: match[5],
				thirdCount: match[6],
				starts: match[7],
				finals: match[8],
				championships: match[9],
				averageExhibitionTime: match[10],
				bestTime: match[11],
				decidingMoves: {
					escape: match[12] ?? "",
					turn: match[13] ?? "",
					difference: match[14] ?? "",
					turnDifference: match[15] ?? "",
					comeFromBehind: match[16] ?? "",
					benefit: match[17] ?? "",
				},
				source: NARUTO_SOURCE,
			});

			match = fallbackPattern.exec(bodyText);
		}
	}

	const uniqueRows = Array.from(new Map(rows.map((row) => [row.motorNo, row])).values());

	if (uniqueRows.length === 0) {
		console.log("[venue-extras debug] naruto motor text sample:", normalizeNarutoCell($("body").text()).slice(0, 800));
	}

	return uniqueRows;
}

function parseNarutoTideInfo(html, date) {
	const $ = load(html);
	const lines = readCleanLines($("body"));

	const targetDate = String(date ?? "")
		.replace(/^\d{4}-/, "")
		.replace("-", "/")
		.replace(/^0/, "")
		.replace("/0", "/");

	const targetDateWithZero = String(date ?? "")
		.replace(/^\d{4}-/, "")
		.replace("-", "/");

	for (const line of lines) {
		const text = normalizeNarutoCell(line);

		if (!text.startsWith(targetDate) && !text.startsWith(targetDateWithZero)) {
			continue;
		}

		const match = text.match(/^(\d{1,2}\/\d{1,2})\s+(.+?)\s+(.+?)\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})$/);

		if (!match) {
			continue;
		}

		return {
			date: match[1],
			dayLabel: match[2],
			tideType: match[3],
			lowTideTime: match[4],
			highTideTime: match[5],
			source: NARUTO_SOURCE,
		};
	}

	return null;
}

function parseNarutoWaterSurfaceInfo(html) {
	const $ = load(html);
	const lines = readCleanLines($("body")).map((line) => compactText(line));
	const bodyText = compactText(lines.join(" "));

	const surfaceSummary = [
		bodyText.includes("水質 海水") ? "水質：海水" : "",
		bodyText.includes("干満差 あり") ? "干満差：あり" : "",
		bodyText.includes("チルト角度") ? "チルト角度：-0.5 / 0 / 0.5 / 1 / 1.5 / 2 / 3" : "",
	]
		.filter(Boolean)
		.join(" / ");

	const waterPoint = bodyText.match(/形状がスタートラインから1マークへ向けて.+?コース不問で勝負できる面白いレース場です。/);
	const tidePoint = bodyText.match(/小鳴門海峡に面した海水の水面ですが.+?反対に下がっている時は断然乗りやすいです。/);
	const hanamichiPoint = bodyText.match(/バックストレッチの内側にすごく伸びる位置があって.+?舟券に絡んでくる展開もあります。/);
	const windPoint = bodyText.match(/基本的に、夏は向かい風.+?風が強い日は要注意です。/);

	const featureSummary = [waterPoint?.[0], tidePoint?.[0]]
		.filter(Boolean)
		.join(" ");

	const courseSummary = [hanamichiPoint?.[0], windPoint?.[0]]
		.filter(Boolean)
		.join(" ");

	if (!surfaceSummary && !featureSummary && !courseSummary) {
		return null;
	}

	return {
		surfaceSummary,
		featureSummary,
		courseSummary,
		source: NARUTO_SOURCE,
	};
}

function toNarutoRaceNo(raceNo) {
	return String(raceNo).padStart(2, "0");
}

function toNarutoDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function getNarutoRaceInfoCandidateUrls(date, raceNo) {
	const day = toNarutoDay(date);
	const race = String(raceNo);
	const racePadded = toNarutoRaceNo(raceNo);

	return [
		`https://www.n14.jp/`,
		`https://www.n14.jp/?race=${race}`,
		`https://www.n14.jp/?race_no=${race}`,
		`https://www.n14.jp/?rno=${race}`,
		`https://www.n14.jp/sp/index.php`,
		`https://www.n14.jp/sp/index.php?race=${race}`,
		`https://www.n14.jp/sp/index.php?race_no=${race}`,
		`https://www.n14.jp/sp/index.php?rno=${race}`,
		`https://www.n14.jp/sp/index.php?page=top&race=${race}`,
		`https://www.n14.jp/sp/index.php?page=top&race_no=${race}`,
		`https://www.n14.jp/modules/raceinfo/`,
		`https://www.n14.jp/modules/raceinfo/?race=${race}`,
		`https://www.n14.jp/modules/raceinfo/?race_no=${race}`,
		`https://www.n14.jp/modules/raceinfo/?rno=${race}`,
		`https://www.n14.jp/modules/raceinfo/?page=index&race=${race}`,
		`https://www.n14.jp/modules/raceinfo/?page=index&race_no=${race}`,
		`https://www.n14.jp/modules/raceinfo/?page=index_raceinfo&race=${race}`,
		`https://www.n14.jp/modules/raceinfo/?page=index_raceinfo&race_no=${race}`,
		`https://www.n14.jp/modules/raceinfo/?page=index_beforeinfo&race=${race}`,
		`https://www.n14.jp/modules/raceinfo/?page=index_beforeinfo&race_no=${race}`,
		`https://www.n14.jp/modules/raceinfo/?page=index_beforeinfo&rno=${race}`,
		`https://www.n14.jp/modules/raceinfo/?page=index_beforeinfo&day=${day}&race=${racePadded}`,
	];
}

function isNarutoRaceInfoHtml(html) {
	const text = compactText(load(html)("body").text());

	return (
		text.includes("直前情報") &&
		(
			text.includes("オリジナル展示データ") ||
			text.includes("オリジナル展示") ||
			text.includes("部品交換") ||
			text.includes("スタート展示") ||
			text.includes("選手コメント")
		)
	);
}

async function debugNarutoRaceInfoUrl(date, raceNo) {
	const candidateUrls = getNarutoRaceInfoCandidateUrls(date, raceNo);

	for (const url of candidateUrls) {
		try {
			const html = await fetchHtml(url);
			const text = compactText(load(html)("body").text());

			const looksUsable = isNarutoRaceInfoHtml(html);

			console.log(
				`[venue-extras debug] naruto ${raceNo}R url check: ${looksUsable ? "MATCH" : "skip"} ${url}`,
			);

			if (looksUsable) {
				console.log(
					`[venue-extras debug] naruto ${raceNo}R page sample: ${text.slice(0, 900)}`,
				);

				return {
					url,
					html,
				};
			}
		} catch (error) {
			console.log(`[venue-extras debug] naruto ${raceNo}R url failed: ${url} / ${error.message}`);
		}

		await sleep(REQUEST_INTERVAL_MS);
	}

	console.log(`[venue-extras debug] naruto ${raceNo}R: no usable race info url found`);

	return null;
}

function parseNarutoTopFrameConfig(html) {
	const scriptText = load(html)("script")
		.toArray()
		.map((element) => load(html)(element).html() ?? "")
		.join("\n");

	const initDay = scriptText.match(/init_day\s*=\s*"(\d{8})"/)?.[1] ?? "";
	const initRace = scriptText.match(/init_race\s*=\s*"(\d{1,2})"/)?.[1] ?? "";

	return {
		initDay,
		initRace,
	};
}

function toNarutoYosouUrl({ day, raceNo, type }) {
	return `https://www.n14.jp/modules/yosou/${type}.php?day=${day}&race=${raceNo}&if=1`;
}

function toNarutoYosouUrlWithKind({ day, raceNo, type, kind }) {
	return `https://www.n14.jp/modules/yosou/${type}.php?day=${day}&race=${raceNo}&kind=${kind}&if=1`;
}

async function fetchNarutoActiveYosouDay() {
	try {
		const topHtml = await fetchHtml("https://www.n14.jp/");
		const frameConfig = parseNarutoTopFrameConfig(topHtml);

		return frameConfig.initDay || "";
	} catch (error) {
		console.warn(`[venue-extras] naruto active day failed: ${error.message}`);
		return "";
	}
}

function parseNarutoOriginalExhibitionBase(html) {
	const $ = load(html);
	const text = compactText($("body").text());

	const startIndex = text.indexOf("オリジナル展示データ");

	if (startIndex < 0) {
		return [];
	}

	const endCandidates = [
		text.indexOf("電気…", startIndex),
		text.indexOf("直前予想", startIndex),
		text.indexOf("提供：", startIndex),
	].filter((index) => index > startIndex);

	const endIndex = endCandidates.length ? Math.min(...endCandidates) : text.length;
	const sectionText = text.slice(startIndex, endIndex);

	const rows = [];
	const seenFrames = new Set();

	const prefecturePattern =
		"(北海道|青 森|岩 手|宮 城|秋 田|山 形|福 島|茨 城|栃 木|群 馬|埼 玉|千 葉|東 京|神奈川|新 潟|富 山|石 川|福 井|山 梨|長 野|岐 阜|静 岡|愛 知|三 重|滋 賀|京 都|大 阪|兵 庫|奈 良|和歌山|鳥 取|島 根|岡 山|広 島|山 口|徳 島|香 川|愛 媛|高 知|福 岡|佐 賀|長 崎|熊 本|大 分|宮 崎|鹿児島|沖 縄)";

	const profilePattern = new RegExp(
		`${prefecturePattern}\\/${prefecturePattern}\\/\\d{2}`,
	);

	const isIntegerValue = (value) => /^\d+$/.test(compactText(value));
	const isDecimalValue = (value) => /^[0-9]+(?:\.[0-9]+)?$/.test(compactText(value));
	const isTiltValue = (value) => {
		const normalized = compactText(value);
		return normalized === "-.-" || /^[+-]?[0-9]+(?:\.[0-9])?$/.test(normalized);
	};
	const isWeightAdjustmentValue = (value) => /^[+-]?[0-9]+(?:\.[0-9])$/.test(compactText(value));

	const rowPattern = /(?:^|\s)([1-6]\s+[AB]\d\/\d{4}.*?)(?=\s+[1-6]\s+[AB]\d\/\d{4}|$)/g;
	let match = rowPattern.exec(sectionText);

	while (match) {
		const rowText = compactText(match[1]);

		const headMatch = rowText.match(/^([1-6])\s+([AB]\d)\/(\d{4})(.+)$/);

		if (!headMatch) {
			match = rowPattern.exec(sectionText);
			continue;
		}

		const frameNo = Number.parseInt(headMatch[1], 10);

		if (!frameNo || seenFrames.has(frameNo)) {
			match = rowPattern.exec(sectionText);
			continue;
		}

		const bodyText = compactText(headMatch[4]);
		const profileMatch = profilePattern.exec(bodyText);

		if (!profileMatch) {
			match = rowPattern.exec(sectionText);
			continue;
		}

		const playerName = compactText(bodyText.slice(0, profileMatch.index));
		const profile = compactText(profileMatch[0]);
		const afterProfileText = compactText(
			bodyText.slice(profileMatch.index + profileMatch[0].length),
		);

		const afterProfileMatch = afterProfileText.match(/^([0-9]{2}\.[0-9])\s+(.+)$/);

		if (!afterProfileMatch) {
			match = rowPattern.exec(sectionText);
			continue;
		}

		const tokens = compactText(afterProfileMatch[2]).split(" ").filter(Boolean);

		let weightAdjustment = "";

		if (
			tokens.length >= 4 &&
			isWeightAdjustmentValue(tokens[0]) &&
			isIntegerValue(tokens[1]) &&
			isDecimalValue(tokens[2]) &&
			isTiltValue(tokens[3])
		) {
			weightAdjustment = tokens.shift() ?? "";
		}

		const motorNo = normalizeNarutoMotorNo(tokens.shift() ?? "");
		const motorTwoRate = compactText(tokens.shift() ?? "");
		const tilt = compactText(tokens.shift() ?? "");

		if (!playerName || !motorNo || !isDecimalValue(motorTwoRate) || !isTiltValue(tilt)) {
			match = rowPattern.exec(sectionText);
			continue;
		}

		const remainingTokens = tokens.map((token) => compactText(token)).filter(Boolean);
		const exhibitionEvaluationIndex = remainingTokens.findIndex((token) => /^[A-D]$/.test(token));

		const exhibitionEvaluation =
			exhibitionEvaluationIndex >= 0 ? remainingTokens[exhibitionEvaluationIndex] : "";

		const previousRaceInfo =
			exhibitionEvaluationIndex >= 0
				? remainingTokens.slice(0, exhibitionEvaluationIndex).join(" ")
				: remainingTokens.join(" ");

		const partsReplacement =
			exhibitionEvaluationIndex >= 0
				? remainingTokens.slice(exhibitionEvaluationIndex + 1).join(" ")
				: "";

		rows.push({
			frameNo,
			playerName,
			className: headMatch[2],
			registerNo: headMatch[3],
			profile,
			weight: afterProfileMatch[1],
			weightAdjustment,
			motorNo,
			motorTwoRate,
			tilt,
			previousRaceInfo,
			exhibitionEvaluation,
			partsReplacement,
			exhibitionTime: "",
			oneLapTime: "",
			turnTime: "",
			straightTime: "",
			memo: partsReplacement
				? `鳴門公式HP 直前情報から取得 / 部品交換: ${partsReplacement}`
				: "鳴門公式HP 直前情報から取得",
			source: NARUTO_SOURCE,
		});

		seenFrames.add(frameNo);
		match = rowPattern.exec(sectionText);
	}

	if (!rows.length) {
		console.log("[venue-extras debug] naruto original exhibition sample:", sectionText.slice(0, 900));
	}

	return rows
		.filter((row) => row.frameNo >= 1 && row.frameNo <= 6)
		.slice(0, 6)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function parseNarutoRacerIdentity($, cell) {
	const items = $(cell)
		.find("li")
		.map((_, item) => normalizeNarutoCell($(item).text()))
		.get()
		.filter(Boolean);

	const [classAndRegister = "", playerName = "", profile = ""] = items;
	const [className = "", registerNo = ""] = classAndRegister.split("/");

	return {
		className,
		registerNo,
		playerName,
		profile,
	};
}

function parseNarutoOriginalExhibitionTimes(html) {
	const $ = load(html);
	const rows = [];

	$("table tbody").each((_, tbody) => {
		const trList = $(tbody).find("tr");

		for (let index = 0; index < trList.length; index += 2) {
			const firstCells = $(trList[index]).children("th, td").toArray();
			const secondCells = index + 1 < trList.length
				? $(trList[index + 1]).children("th, td").toArray()
				: [];

			if (firstCells.length < 8) {
				continue;
			}

			const frameNo = parseFrameNo(normalizeNarutoCell($(firstCells[0]).text()));
			if (!frameNo) {
				continue;
			}

			const identity = parseNarutoRacerIdentity($, firstCells[1]);
			if (!identity.playerName) {
				continue;
			}

			rows.push({
				frameNo,
				...identity,
				weight: normalizeNarutoCell($(firstCells[2]).text()),
				weightAdjustment: secondCells.length ? normalizeNarutoCell($(secondCells[0]).text()) : "",
				tilt: normalizeNarutoCell($(firstCells[3]).text()),
				exhibitionTime: normalizeNarutoCell($(firstCells[4]).text()),
				oneLapTime: normalizeNarutoCell($(firstCells[5]).text()),
				turnTime: normalizeNarutoCell($(firstCells[6]).text()),
				straightTime: normalizeNarutoCell($(firstCells[7]).text()),
				source: NARUTO_SOURCE,
			});
		}
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function mergeNarutoOriginalExhibitionRows(baseRows, timeRows) {
	const usedTimeIndexes = new Set();
	const mergedRows = baseRows.map((baseRow) => {
		const matchedIndex = timeRows.findIndex((timeRow, index) => {
			if (usedTimeIndexes.has(index)) {
				return false;
			}

			return (
				(timeRow.frameNo && timeRow.frameNo === baseRow.frameNo)
				|| (timeRow.registerNo && baseRow.registerNo && timeRow.registerNo === baseRow.registerNo)
				|| (
					timeRow.playerName
					&& baseRow.playerName
					&& normalizeNarutoCell(timeRow.playerName) === normalizeNarutoCell(baseRow.playerName)
				)
			);
		});

		if (matchedIndex < 0) {
			return baseRow;
		}

		usedTimeIndexes.add(matchedIndex);
		const timeRow = timeRows[matchedIndex];

		return {
			...timeRow,
			...baseRow,
			weight: timeRow.weight || baseRow.weight,
			weightAdjustment: timeRow.weightAdjustment || baseRow.weightAdjustment,
			tilt: timeRow.tilt || baseRow.tilt,
			exhibitionTime: timeRow.exhibitionTime || baseRow.exhibitionTime,
			oneLapTime: timeRow.oneLapTime || baseRow.oneLapTime,
			turnTime: timeRow.turnTime || baseRow.turnTime,
			straightTime: timeRow.straightTime || baseRow.straightTime,
			source: NARUTO_SOURCE,
		};
	});

	for (const [index, timeRow] of timeRows.entries()) {
		if (usedTimeIndexes.has(index)) {
			continue;
		}

		mergedRows.push({
			frameNo: timeRow.frameNo,
			playerName: timeRow.playerName,
			className: timeRow.className,
			registerNo: timeRow.registerNo,
			profile: timeRow.profile,
			weight: timeRow.weight,
			weightAdjustment: timeRow.weightAdjustment,
			motorNo: "",
			motorTwoRate: "",
			tilt: timeRow.tilt,
			previousRaceInfo: "",
			exhibitionEvaluation: "",
			partsReplacement: "",
			exhibitionTime: timeRow.exhibitionTime,
			oneLapTime: timeRow.oneLapTime,
			turnTime: timeRow.turnTime,
			straightTime: timeRow.straightTime,
			memo: "鳴門公式HP オリジナル展示データから取得",
			source: NARUTO_SOURCE,
		});
	}

	return mergedRows
		.filter((row) => row.frameNo >= 1 && row.frameNo <= 6)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function parseNarutoFrameHistory(html) {
	const $ = load(html);
	const rows = [];

	$("table tbody").each((_, tbody) => {
		const trList = $(tbody).find("tr");
		if (trList.length < 2) {
			return;
		}

		const firstCells = $(trList[0]).children("th, td").toArray();
		const secondCells = $(trList[1]).children("th, td").toArray();

		if (firstCells.length < 6) {
			return;
		}

		const frameNo = parseFrameNo(normalizeNarutoCell($(firstCells[0]).text()));
		if (!frameNo) {
			return;
		}

		const identity = parseNarutoRacerIdentity($, firstCells[1]);
		if (!identity.playerName) {
			return;
		}

		rows.push({
			frameNo,
			...identity,
			courseHistory: firstCells.slice(3, -3).map((cell) => normalizeNarutoCell($(cell).text())),
			finishHistory: secondCells.slice(1).map((cell) => normalizeNarutoCell($(cell).text())),
			frameWinRate: normalizeNarutoCell($(firstCells[firstCells.length - 3]).text()),
			frameAverageStart: normalizeNarutoCell($(firstCells[firstCells.length - 2]).text()),
			frameStartOrder: normalizeNarutoCell($(firstCells[firstCells.length - 1]).text()),
			source: NARUTO_SOURCE,
		});
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseNarutoRecentPerformance(html) {
	const $ = load(html);
	const rows = [];

	$("table tbody").each((_, tbody) => {
		const trList = $(tbody).find("tr");
		if (trList.length < 2) {
			return;
		}

		for (let rowIndex = 0; rowIndex + 1 < trList.length; rowIndex += 2) {
			const firstCells = $(trList[rowIndex]).children("th, td").toArray();
			const secondCells = $(trList[rowIndex + 1]).children("th, td").toArray();

			if (firstCells.length < 5) {
				continue;
			}

			const frameNo = parseFrameNo(normalizeNarutoCell($(firstCells[0]).text()));
			if (!frameNo) {
				continue;
			}

			const identity = parseNarutoRacerIdentity($, firstCells[1]);
			if (!identity.playerName) {
				continue;
			}

			const histories = firstCells.slice(2).map((cell, index) => ({
				label: normalizeNarutoCell($(cell).text()),
				results: normalizeNarutoCell($(secondCells[index]).text()),
			})).filter((history) => history.label || history.results);

			rows.push({
				frameNo,
				...identity,
				histories,
				source: NARUTO_SOURCE,
			});
		}
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

async function fetchNarutoRacerPerformance({ day, raceNo }) {
	const urls = [0, 1, 2].map((kind) =>
		toNarutoYosouUrlWithKind({
			day,
			raceNo,
			type: "group-racer-data",
			kind,
		}),
	);

	const results = await Promise.allSettled(urls.map((url) => fetchHtml(url)));

	const byFramePast10 = results[0]?.status === "fulfilled"
		? parseNarutoFrameHistory(results[0].value)
		: [];
	const narutoRecent = results[1]?.status === "fulfilled"
		? parseNarutoRecentPerformance(results[1].value)
		: [];
	const nationalRecent = results[2]?.status === "fulfilled"
		? parseNarutoRecentPerformance(results[2].value)
		: [];

	if (!byFramePast10.length && !narutoRecent.length && !nationalRecent.length) {
		return null;
	}

	return {
		byFramePast10,
		narutoRecent,
		nationalRecent,
	};
}

async function fetchNarutoRaceExtra({ day, raceNo }) {
	const cyokuzenUrl = toNarutoYosouUrl({
		day,
		raceNo,
		type: "group-cyokuzen",
	});
	const originalDataUrl = toNarutoYosouUrlWithKind({
		day,
		raceNo,
		type: "group-cyokuzen",
		kind: 2,
	});

	try {
		const [cyokuzenHtml, originalDataHtml, narutoRacerPerformance] = await Promise.all([
			fetchHtml(cyokuzenUrl),
			fetchHtml(originalDataUrl),
			fetchNarutoRacerPerformance({ day, raceNo }),
		]);

		const originalExhibition = mergeNarutoOriginalExhibitionRows(
			parseNarutoOriginalExhibitionBase(cyokuzenHtml),
			parseNarutoOriginalExhibitionTimes(originalDataHtml),
		);

		if (!originalExhibition.length && !narutoRacerPerformance) {
			console.log(`[venue-extras] naruto ${raceNo}R: no official rows yet`);
			return {
				raceNo,
				originalExhibition: [],
				narutoRacerPerformance: null,
			};
		}

		console.log(
			`[venue-extras] naruto ${raceNo}R: ${originalExhibition.length} original rows${narutoRacerPerformance ? " + racer performance" : ""}`,
		);

		return {
			raceNo,
			originalExhibition,
			narutoRacerPerformance,
		};
	} catch (error) {
		console.warn(`[venue-extras] naruto ${raceNo}R official extras failed: ${error.message}`);

		return {
			raceNo,
			originalExhibition: [],
			narutoRacerPerformance: null,
		};
	}
}

function createNarutoRaceMotorSummary(race, motorData) {
	const racers = Array.isArray(race?.racers) ? race.racers : [];

	return racers
		.map((racer) => {
			const frameNo = Number(racer?.frameNo ?? racer?.frame ?? racer?.boatNumber);
			const motorNo = normalizeNarutoMotorNo(racer?.motorNo ?? racer?.motorNumber);
			const motor = motorData.find((item) => item.motorNo === motorNo);

			if (!frameNo || !motorNo || !motor) {
				return null;
			}

			const decidingMoves = motor.decidingMoves
				? `逃げ${motor.decidingMoves.escape || 0} / まくり${motor.decidingMoves.turn || 0} / 差し${motor.decidingMoves.difference || 0} / まくり差し${motor.decidingMoves.turnDifference || 0}`
				: "";

			return {
				frameNo,
				motorNo,
				previousUser: `モーター${motor.motorNo}`,
				recentResults: `2連率 ${motor.twoRate}% / 勝率 ${motor.winRate} / 平均展示 ${motor.averageExhibitionTime}`,
				motorGrade: normalizeNarutoMotorGrade(motor.twoRate),
				comment: `鳴門公式モーターデータ：1着${motor.firstCount} / 2着${motor.secondCount} / 3着${motor.thirdCount} / 出走${motor.starts} / 優出${motor.finals} / 優勝${motor.championships} / 最高${motor.bestTime}${decidingMoves ? ` / ${decidingMoves}` : ""}`,
				source: NARUTO_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

async function createNarutoVenue(feed, date) {
	const narutoVenue = findVenue(feed, NARUTO_VENUE_NAME);

	if (!narutoVenue) {
		console.log("[venue-extras] naruto: not held today");
		return null;
	}

	try {
		const [motorHtml, tideHtml, waterSurfaceHtml] = await Promise.all([
			fetchHtml(NARUTO_MOTOR_DATA_URL),
			fetchHtml(NARUTO_TIDE_URL),
			fetchHtml(NARUTO_WATER_SURFACE_URL),
		]);

		const motorData = parseNarutoMotorData(motorHtml);
		const tideInfo = parseNarutoTideInfo(tideHtml, date);
		const waterSurfaceInfo = parseNarutoWaterSurfaceInfo(waterSurfaceHtml);
		const races = getRaceList(narutoVenue);
		const raceExtras = [];
		const activeYosouDay = await fetchNarutoActiveYosouDay();
		const yosouDay = activeYosouDay || toNarutoDay(date);

		if (activeYosouDay && activeYosouDay !== toNarutoDay(date)) {
			console.log(`[venue-extras] naruto: active yosou day ${activeYosouDay} differs from feed date ${toNarutoDay(date)}`);
		}

		for (const race of races) {
	const motorSummary = createNarutoRaceMotorSummary(race, motorData);
	const raceOfficialExtra = await fetchNarutoRaceExtra({
		day: yosouDay,
		raceNo: race.raceNo,
	});

	const originalExhibition = raceOfficialExtra?.originalExhibition ?? [];
		const narutoRacerPerformance = raceOfficialExtra?.narutoRacerPerformance ?? null;

		if (!motorSummary.length && !originalExhibition.length && !narutoRacerPerformance && !tideInfo && !waterSurfaceInfo) {
		continue;
	}

	raceExtras.push({
		raceNo: race.raceNo,
		status: "available",
		source: NARUTO_SOURCE,
		sourceType: "official-venue-motor-tide-water-cyokuzen",
		originalExhibition,
		narutoRacerPerformance,
		motorSummary,
		tideInfo,
		waterSurfaceInfo,
	});

	await sleep(REQUEST_INTERVAL_MS);
}

		if (!raceExtras.length) {
			console.log("[venue-extras] naruto: held today, but no venue rows are available yet");

			return {
				venueCode: String(narutoVenue.venueCode ?? "14"),
				venueName: NARUTO_VENUE_NAME,
				source: NARUTO_SOURCE,
				isAvailable: false,
				status: "waiting-naruto-data",
				note: "鳴門公式HPの会場独自データ照合がまだできませんでした。",
				races: [],
			};
		}

		const narutoCyokuzenRaceCount = raceExtras.filter((raceExtra) =>
	Array.isArray(raceExtra.originalExhibition) && raceExtra.originalExhibition.length > 0,
).length;

console.log(
	`[venue-extras] naruto: ${raceExtras.length} races + ${motorData.length} motor rows${tideInfo ? " + tide" : ""}${waterSurfaceInfo ? " + water surface" : ""}${narutoCyokuzenRaceCount ? ` + ${narutoCyokuzenRaceCount} cyokuzen races` : ""}`,
);

		return {
			venueCode: String(narutoVenue.venueCode ?? "14"),
			venueName: NARUTO_VENUE_NAME,
			source: NARUTO_SOURCE,
			isAvailable: true,
			note: "鳴門公式HPのモーターデータ・潮見表・水面特性から、会場独自データを取得",
			tideInfo,
			waterSurfaceInfo,
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] naruto failed: ${error.message}`);

		return {
			venueCode: String(narutoVenue.venueCode ?? "14"),
			venueName: NARUTO_VENUE_NAME,
			source: NARUTO_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `鳴門公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
}

async function main() {
	const generatedAt = getJstTimestamp();
	const feed = await readTodayRaceDetails();
	const date = feed?.date ?? getJstDate(generatedAt);
	const venueMap = new Map(
		createOfficialBeforeInfoVenues(feed).map((venue) => [venue.venueName, venue]),
	);

	const omuraVenue = await createOmuraVenue(feed, date);
	if (omuraVenue) {
		venueMap.set(omuraVenue.venueName, mergeVenueRecord(venueMap.get(omuraVenue.venueName) ?? null, omuraVenue));
	}

	const karatsuVenue = await createKaratsuVenue(feed);
	if (karatsuVenue) {
		venueMap.set(karatsuVenue.venueName, mergeVenueRecord(venueMap.get(karatsuVenue.venueName) ?? null, karatsuVenue));
	}

	const marugameVenue = await createMarugameVenue(feed, date);
	if (marugameVenue) {
		venueMap.set(marugameVenue.venueName, mergeVenueRecord(venueMap.get(marugameVenue.venueName) ?? null, marugameVenue));
	}

	const narutoVenue = await createNarutoVenue(feed, date);
	if (narutoVenue) {
		venueMap.set(narutoVenue.venueName, mergeVenueRecord(venueMap.get(narutoVenue.venueName) ?? null, narutoVenue));
	}

	const tamagawaVenue = await createTamagawaVenue(feed, date);
	if (tamagawaVenue) {
		venueMap.set(tamagawaVenue.venueName, mergeVenueRecord(venueMap.get(tamagawaVenue.venueName) ?? null, tamagawaVenue));
	}

	const tsuVenue = await createTsuVenue(feed, date);
	if (tsuVenue) {
		venueMap.set(tsuVenue.venueName, mergeVenueRecord(venueMap.get(tsuVenue.venueName) ?? null, tsuVenue));
	}

	const wakamatsuVenue = await createWakamatsuVenue(feed, date);
	if (wakamatsuVenue) {
		venueMap.set(wakamatsuVenue.venueName, mergeVenueRecord(venueMap.get(wakamatsuVenue.venueName) ?? null, wakamatsuVenue));
	}

	const fukuokaVenue = await createFukuokaVenue(feed, date);
	if (fukuokaVenue) {
		venueMap.set(fukuokaVenue.venueName, mergeVenueRecord(venueMap.get(fukuokaVenue.venueName) ?? null, fukuokaVenue));
	}

	const kojimaVenue = await createKojimaVenue(feed, date);
	if (kojimaVenue) {
		venueMap.set(kojimaVenue.venueName, mergeVenueRecord(venueMap.get(kojimaVenue.venueName) ?? null, kojimaVenue));
	}

	const biwakoVenue = await createBiwakoVenue(feed, date);
	if (biwakoVenue) {
		venueMap.set(biwakoVenue.venueName, mergeVenueRecord(venueMap.get(biwakoVenue.venueName) ?? null, biwakoVenue));
	}

	const venues = Array.from(venueMap.values());

	const output = {
		version: 1,
		generatedAt,
		date,
		source: "boatrace-official-beforeinfo+venue-official-sites",
		venues,
	};

	await mkdir(path.dirname(venueExtrasPath), { recursive: true });
	await writeFile(venueExtrasPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

	console.log(`updated: ${venueExtrasPath}`);
	console.log(`source: ${output.source}`);
	console.log(`date: ${output.date}`);
	console.log(`venues: ${venues.length}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
