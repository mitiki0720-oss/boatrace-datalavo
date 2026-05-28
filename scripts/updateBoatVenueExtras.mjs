import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { getJstTimestamp as getSharedJstTimestamp, getJstTimestampParts, normalizeTargetDate } from "./boatRaceDate.mjs";

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
const TOKUYAMA_VENUE_NAME = "徳山";
const TOKUYAMA_SOURCE = "boatrace-tokuyama.jp";
const MIKUNI_VENUE_NAME = "三国";
const MIKUNI_SOURCE = "boatrace-mikuni.jp";
const NARUTO_VENUE_NAME = "鳴門";
const NARUTO_SOURCE = "n14.jp";
const TAMAGAWA_VENUE_NAME = "多摩川";
const TAMAGAWA_SOURCE = "boatrace-tamagawa.com";
const TSU_VENUE_NAME = "津";
const TSU_SOURCE = "boatrace-tsu.com";
const TSU_SP_BASE_URL = "https://www.boatrace-tsu.com/sp/index.php";
const TSU_MOTOR_DATA_URL = `${TSU_SP_BASE_URL}?page=datafile-motordata`;
const TSU_BOAT_DATA_URL = `${TSU_SP_BASE_URL}?page=datafile-boat`;
const TSU_WATER_SURFACE_URL = `${TSU_SP_BASE_URL}?page=datafile-suimen`;
const WAKAMATSU_VENUE_NAME = "若松";
const WAKAMATSU_SOURCE = "wmb.jp";
const WAKAMATSU_TIDE_URL = "https://www.wmb.jp/modules/datafile/?page=index_tide_table";
const WAKAMATSU_WATER_SURFACE_URL = "https://www.wmb.jp/modules/datafile/?page=index_suimen";
const TOKONAME_VENUE_NAME = "\u5e38\u6ed1";
const TOKONAME_SOURCE = "boatrace-tokoname.jp";
const TOKONAME_SCORE_RATE_URL = "https://www.boatrace-tokoname.jp/modules/raceinfo/?page=index_tokutenrank";
const TOKONAME_TIMERANK_URL = "https://www.boatrace-tokoname.jp/modules/raceinfo/?page=index_timerank";
const TOKONAME_COURSE_URL = "https://www.boatrace-tokoname.jp/modules/raceinfo/?page=index_racecourse";
const TOKONAME_SECTION_RESULTS_URL = "https://www.boatrace-tokoname.jp/modules/raceinfo/?page=index_konsetsu";
const TOKONAME_MOTOR_DATA_URL = "https://www.boatrace-tokoname.jp/modules/datafile/";
const TOKONAME_BOAT_DATA_URL = "https://www.boatrace-tokoname.jp/modules/datafile/?page=index_boat";
const TOKONAME_WATER_SURFACE_URL = "https://www.boatrace-tokoname.jp/modules/datafile/?page=index_suimen";
const TOKONAME_TOP_URL = "https://www.boatrace-tokoname.jp/";
const TOKONAME_YOSOU_BASE_URL = "https://www.boatrace-tokoname.jp/modules/yosou/group-cyokuzen.php";
const ASHIYA_VENUE_NAME = "\u82a6\u5c4b";
const ASHIYA_SOURCE = "boatrace-ashiya.com";
const ASHIYA_RACE_INDEX_URL = "https://www.boatrace-ashiya.com/modules/raceinfo/?page=index_raceindex";
const ASHIYA_TIMERANK_URL = "https://www.boatrace-ashiya.com/modules/raceinfo/?page=index_timerank";
const ASHIYA_COURSE_URL = "https://www.boatrace-ashiya.com/modules/raceinfo/?page=index_racecourse";
const ASHIYA_SCORE_RATE_URL = "https://www.boatrace-ashiya.com/modules/raceinfo/?page=index_tokutenrank";
const ASHIYA_RACER_COMMENTS_URL = "https://www.boatrace-ashiya.com/modules/raceinfo/?page=index_racers_comment";
const ASHIYA_MOTOR_DATA_URL = "https://www.boatrace-ashiya.com/modules/datafile/";
const ASHIYA_BOAT_DATA_URL = "https://www.boatrace-ashiya.com/modules/datafile/?page=index_boat";
const ASHIYA_WATER_SURFACE_URL = "https://www.boatrace-ashiya.com/modules/datafile/?page=index_suimen";
const KIRYU_VENUE_NAME = "\u6850\u751f";
const KIRYU_SOURCE = "kiryu-kyotei.com";
const KIRYU_YOSOU_BASE_URL = "https://www.kiryu-kyotei.com/modules/yosou/";
const KIRYU_TIMERANK_URL = "https://www.kiryu-kyotei.com/modules/raceinfo/?page=index_timerank";
const KIRYU_MOTOR_RANK_URL = "https://www.kiryu-kyotei.com/modules/datafile/?page=index_motorrank";
const KIRYU_BOAT_RANK_URL = "https://www.kiryu-kyotei.com/modules/datafile/?page=index_boatrank";
const KIRYU_WATER_SURFACE_URL = "https://www.kiryu-kyotei.com/modules/datafile/?page=index_suimen";
const MIYAJIMA_VENUE_NAME = "\u5bae\u5cf6";
const MIYAJIMA_SOURCE = "boatrace-miyajima.com";
const MIYAJIMA_TOP_URL = "https://www.boatrace-miyajima.com/";
const MIYAJIMA_RACEDATA_URL = "https://www.boatrace-miyajima.com/racedata.html";
const MIYAJIMA_TIMERANK_URL = "https://www.boatrace-miyajima.com/raceinfo_timerank.html";
const MIYAJIMA_SCORE_RATE_URL = "https://www.boatrace-miyajima.com/yosen_point_rank.html";
const MIYAJIMA_WEATHER_LIVE_URL = "https://www.boatrace-miyajima.com/weather_live/data/weather.txt";
const FUKUOKA_VENUE_NAME = "福岡";
const FUKUOKA_SOURCE = "boatrace-fukuoka.com";
const HAMANAKO_VENUE_NAME = "浜名湖";
const HAMANAKO_SOURCE = "boatrace-hamanako.jp";
const HAMANAKO_YOSOU_BASE_URL = "https://www.boatrace-hamanako.jp/modules/yosou/";
const HAMANAKO_WATER_SURFACE_URL = "https://www.boatrace-hamanako.jp/modules/datafile/?page=index_suimen";
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
const MARUGAME_SCORE_RATE_URL = "https://www.marugameboat.jp/asp/htmlmade/marugame/rank/rank.htm";
const MARUGAME_PRECHECK_URL = "https://www.marugameboat.jp/asp/marugame/kyogi/kyogihtml/zenken/zenken1505.htm";
const TOKUYAMA_TIDE_URL = "https://www.boatrace-tokuyama.jp/modules/datafile/?page=index_tide_table";
const TOKUYAMA_WATER_SURFACE_URL = "https://www.boatrace-tokuyama.jp/modules/datafile/?page=index_suimen";
const MIKUNI_SCORE_RATE_URL = "https://www.boatrace-mikuni.jp/modules/raceinfo/?page=index_tokutenrank";
const MIKUNI_TIMERANK_URL = "https://www.boatrace-mikuni.jp/modules/raceinfo/?page=index_timerank";
const MIKUNI_MOTOR_DATA_URL = "https://www.boatrace-mikuni.jp/modules/datafile/";
const MIKUNI_WATER_SURFACE_URL = "https://www.boatrace-mikuni.jp/modules/datafile/?page=index_suimen";
const MIKUNIKS_RACES_BASE_URL = "https://www.mikuniks-web.jp/races/";
const MIKUNIKS_SOURCE = "mikuniks-web.jp/races";
const REQUEST_INTERVAL_MS = 250;

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
			default:
				break;
		}
	}

	return parsed;
}

function parseUpdateBoatVenueExtrasOptions(argv = process.argv.slice(2), env = process.env) {
	const cliArgs = parseCliArgs(argv);
	return {
		targetDate: normalizeTargetDate(cliArgs.targetDate ?? env.BOAT_RACE_TARGET_DATE),
	};
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJstTimestamp() {
	return getSharedJstTimestamp();
}

function getJstDate(timestamp) {
	return timestamp.slice(0, 10);
}

function toOmuraDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toTokuyamaDay(date) {
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

function normalizeVenueWeatherCondition(weather, options = {}) {
	if (!weather || typeof weather !== "object") {
		return null;
	}

	// Future venue integrations should normalize official weather, water condition,
	// tide, pressure, humidity, and rainfall here before saving generated extras.
	const condition = {
		weather: weather.weather ?? "",
		windDirection: weather.windDirection ?? weather.windDirectionText ?? "",
		windDirectionText: weather.windDirectionText ?? weather.windDirection ?? "",
		windSpeed: weather.windSpeed ?? "",
		waveHeight: weather.waveHeight ?? "",
		temperature: weather.temperature ?? weather.airTemperature ?? "",
		airTemperature: weather.airTemperature ?? weather.temperature ?? "",
		waterTemperature: weather.waterTemperature ?? "",
		pressure: weather.pressure ?? "",
		humidity: weather.humidity ?? "",
		rainfall: weather.rainfall ?? "",
		observedAt: weather.observedAt ?? "",
		updatedAt: weather.updatedAt ?? "",
		fetchedAt: weather.fetchedAt ?? "",
		source: options.source ?? weather.source ?? "",
		sourceUrl: options.sourceUrl ?? weather.sourceUrl ?? "",
		sourceLabel: options.sourceLabel ?? weather.sourceLabel ?? "",
	};

	const hasValue = [
		condition.weather,
		condition.windDirection,
		condition.windSpeed,
		condition.waveHeight,
		condition.temperature,
		condition.waterTemperature,
		condition.pressure,
		condition.humidity,
		condition.rainfall,
		condition.observedAt,
		condition.updatedAt,
	].some((value) => typeof value === "string" && value.trim().length > 0);

	return hasValue ? condition : null;
}

function mergeVenueWeatherCondition(baseWeather, overlayWeather) {
	const base = normalizeVenueWeatherCondition(baseWeather);
	const overlay = normalizeVenueWeatherCondition(overlayWeather);

	if (!base) {
		return overlay;
	}

	if (!overlay) {
		return base;
	}

	return normalizeVenueWeatherCondition({
		...base,
		...Object.fromEntries(Object.entries(overlay).filter(([, value]) => value !== undefined && value !== null && value !== "")),
	});
}

function buildOfficialBeforeInfoForRace(race) {
	const exhibitionRows = buildOfficialBeforeInfoExhibitionRows(race);
	const startExhibition = buildOfficialBeforeInfoStartExhibitionRows(race, exhibitionRows);
	const scoreQuickLook = buildOfficialBeforeInfoScoreQuickLookRows(race);
	const weatherActual = race?.weatherActual ?? null;
	const weatherCondition = normalizeVenueWeatherCondition(weatherActual, {
		source: BOATRACE_OFFICIAL_SOURCE,
		sourceLabel: "BOATRACE official weather",
	});
	const hasAny = exhibitionRows.length > 0 || startExhibition.length > 0 || scoreQuickLook.length > 0 || Boolean(weatherActual);

	return {
		status: hasAny ? "available" : "waiting",
		source: BOATRACE_OFFICIAL_SOURCE,
		exhibitionRows,
		startExhibition,
		scoreQuickLook,
		weatherActual,
		weatherCondition,
	};
}

function createOfficialBeforeInfoVenues(feed) {
	if (!feed || !Array.isArray(feed.venues)) {
		return [];
	}

	return feed.venues.map((venue) => {
		const races = getRaceList(venue).map((race) => {
			const officialBeforeInfo = buildOfficialBeforeInfoForRace(race);

			return {
				raceNo: race.raceNo,
				status: "available",
				source: BOATRACE_OFFICIAL_SOURCE,
				sourceType: "boatrace-official-beforeinfo",
				officialBeforeInfo,
				weatherCondition: officialBeforeInfo.weatherCondition,
			};
		});

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
			weatherCondition: mergeVenueWeatherCondition(existing.weatherCondition, race?.weatherCondition),
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
		weatherCondition: mergeVenueWeatherCondition(baseInfo.weatherCondition, overlayInfo.weatherCondition),
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

async function fetchTokonameHtml(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0 (compatible; KURARI-DATALAVO/1.0; +https://example.com)",
			"accept-language": "ja,en;q=0.8",
			referer: TOKONAME_TOP_URL,
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

async function fetchAshiyaHtml(url, { cookie = "", referer = "https://www.boatrace-ashiya.com/sp/index.php?page=yosou-yosou" } = {}) {
	const headers = {
		"user-agent": "Mozilla/5.0",
		"accept-language": "ja,en;q=0.8",
		referer,
		"x-requested-with": "XMLHttpRequest",
	};

	if (cookie) {
		headers.cookie = cookie;
	}

	const response = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}

	const getSetCookie = typeof response.headers.getSetCookie === "function"
		? response.headers.getSetCookie.bind(response.headers)
		: null;

	return {
		text: await response.text(),
		cookie: getSetCookie ? getSetCookie().map((value) => value.split(";")[0]).filter(Boolean).join("; ") : "",
	};
}

async function fetchKiryuHtml(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0",
			"accept-language": "ja,en;q=0.8",
			referer: KIRYU_YOSOU_BASE_URL,
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}

	return response.text();
}

async function fetchTsuPageHtml(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0",
			"accept-language": "ja,en;q=0.8",
			referer: "https://www.boatrace-tsu.com/sp/index.php",
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}

	return response.text();
}

async function fetchHamanakoHtml(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent": "Mozilla/5.0",
			"accept-language": "ja,en;q=0.8",
			referer: "https://www.boatrace-hamanako.jp/",
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

function toAshiyaDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toKiryuDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toWakamatsuDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toFukuokaDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toTokuyamaYosouUrl({ date, raceNo, type }) {
	return `https://www.boatrace-tokuyama.jp/modules/yosou/${type}.php?day=${toTokuyamaDay(date)}&race=${Number(raceNo)}&if=1`;
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

function toAshiyaRaceTabUrl({ date, raceNo, req, run = 0 }) {
	return `https://www.boatrace-ashiya.com/sp/ajax/ajax_yosou.php?targetday=${toAshiyaDay(date)}&race=${Number(raceNo)}&req=${req}&run=${Number(run)}`;
}

function toKiryuYosouUrl({ date, raceNo, type }) {
	return `${KIRYU_YOSOU_BASE_URL}${type}.php?day=${toKiryuDay(date)}&race=${Number(raceNo)}&if=1`;
}

function toKiryuMotorHistoryUrl(motorNo) {
	return `https://www.kiryu-kyotei.com/modules/datafile/?page=index_motor_hist&motor_no=${encodeURIComponent(String(motorNo))}`;
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

function toMikuniRaceCourseUrl(raceNo) {
	const url = new URL("https://www.boatrace-mikuni.jp/modules/raceinfo/");
	url.searchParams.set("page", "index_racecourse");
	url.searchParams.set("race", String(Number(raceNo)));
	return url.toString();
}

function toMikuniMotorHistoryUrl(motorNo) {
	const url = new URL("https://www.boatrace-mikuni.jp/modules/datafile/");
	url.searchParams.set("page", "index_motor_hist");
	url.searchParams.set("motor_no", String(motorNo ?? ""));
	url.searchParams.set("select", "7");
	return url.toString();
}

function toMikuniksRaceUrl(raceNo) {
	return new URL(String(Number(raceNo)), MIKUNIKS_RACES_BASE_URL).toString();
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
				lapTime: readCellText($, firstCells[4]),
				oneRoundTime: readCellText($, firstCells[4]),
				turnTime: readCellText($, firstCells[5]),
				mawariashi: readCellText($, firstCells[5]),
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

function readTsuCellOwnText($, cell) {
	const clone = $(cell).clone();
	clone.children("div, table").remove();
	return compactText(clone.text());
}

function parseTsuHistoryEntries($, container) {
	const entries = [];
	$(container)
		.find("table.tbl_history tbody")
		.each((_, tbody) => {
			const trList = $(tbody).children("tr").toArray();
			const title = readCellText($, $(trList[0]).children("td,th").first());
			const detailCells = trList[1] ? $(trList[1]).children("td,th").toArray() : [];
			const results = readCellText($, $(trList[2]).children("td,th").first());
			const dateRange = readCellText($, detailCells[0]);
			const racerName = readCellText($, detailCells[1]);

			if (!title && !dateRange && !racerName && !results) {
				return;
			}

			entries.push({
				title,
				dateRange,
				racerName,
				playerName: racerName,
				results,
			});
		});

	return entries;
}

function readTsuPowerMark($, cell) {
	const imageSrc = $(cell).find("img").first().attr("src") ?? "";
	return imageSrc.match(/ico_mark(\d+)/)?.[1] ?? "";
}

function parseTsuMotorBoat(html, motorStats = new Map(), boatStats = new Map()) {
	const $ = load(html);
	const table = $(".tbl_motor_boat").first();
	if (!table.length) {
		return { motorSummary: [], tsuMotorData: [], tsuBoatData: [], tsuMotorHistory: [] };
	}

	const motorSummary = [];
	const tsuMotorData = [];
	const tsuBoatData = [];
	const tsuMotorHistory = [];

	table
		.children("tbody")
		.first()
		.children("tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 7) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, cells[1]));
			if (!frameNo) {
				return;
			}

			const identity = parseTsuIdentity($, cells[2]);
			const motorCell = cells[3];
			const boatCell = cells[6];
			const motorNo = readCellText($, $(motorCell).find("a.js-lightbox-btn").first());
			const boatNo = readCellText($, $(boatCell).find("a.js-lightbox-btn").first());
			const motorSecondRate = readTsuCellOwnText($, motorCell);
			const boatSecondRate = readTsuCellOwnText($, boatCell);
			const motorStat = motorStats.get(motorNo) ?? {};
			const boatStat = boatStats.get(boatNo) ?? {};
			const motorHistoryEntries = parseTsuHistoryEntries($, motorCell);
			const boatHistoryEntries = parseTsuHistoryEntries($, boatCell);
			const previousMotor = motorHistoryEntries[0] ?? {};
			const motorGrade = [readTsuPowerMark($, cells[4]), readTsuPowerMark($, cells[5])].filter(Boolean).join("/");
			const base = {
				frameNo,
				registerNo: identity.registerNo,
				registrationNo: identity.registrationNo,
				playerName: identity.playerName,
				className: identity.className,
				profile: identity.profile,
				source: TSU_SOURCE,
			};

			if (motorNo) {
				motorSummary.push({
					...base,
					motorNo,
					previousUser: previousMotor.racerName ?? "",
					recentResults: previousMotor.results ?? "",
					motorGrade,
					comment: "",
					source: TSU_SOURCE,
				});
				tsuMotorData.push({
					...base,
					motorNo,
					motorSecondRate: motorSecondRate || motorStat.motorSecondRate || "",
					motorWinRate: motorStat.motorWinRate || "",
					firstCount: motorStat.firstCount || "",
					secondCount: motorStat.secondCount || "",
					thirdCount: motorStat.thirdCount || "",
					starts: motorStat.starts || "",
					finalCount: motorStat.finalCount || "",
					championCount: motorStat.championCount || "",
					motorGrade,
					previousUser: previousMotor.racerName ?? "",
					recentResults: previousMotor.results ?? "",
					historyEntries: motorHistoryEntries,
					source: TSU_SOURCE,
				});
				tsuMotorHistory.push({
					...base,
					motorNo,
					motorSecondRate: motorSecondRate || motorStat.motorSecondRate || "",
					motorWinRate: motorStat.motorWinRate || "",
					boatNo,
					boatSecondRate: boatSecondRate || boatStat.boatSecondRate || "",
					boatWinRate: boatStat.boatWinRate || "",
					previousUser: previousMotor.racerName ?? "",
					recentResults: previousMotor.results ?? "",
					motorGrade,
					historyEntries: motorHistoryEntries,
					boatHistoryEntries,
					source: TSU_SOURCE,
				});
			}

			if (boatNo) {
				tsuBoatData.push({
					...base,
					boatNo,
					boatSecondRate: boatSecondRate || boatStat.boatSecondRate || "",
					boatWinRate: boatStat.boatWinRate || "",
					firstCount: boatStat.firstCount || "",
					secondCount: boatStat.secondCount || "",
					thirdCount: boatStat.thirdCount || "",
					starts: boatStat.starts || "",
					finalCount: boatStat.finalCount || "",
					championCount: boatStat.championCount || "",
					historyEntries: boatHistoryEntries,
					source: TSU_SOURCE,
				});
			}
		});

	return {
		motorSummary: motorSummary.sort((left, right) => left.frameNo - right.frameNo),
		tsuMotorData: tsuMotorData.sort((left, right) => left.frameNo - right.frameNo),
		tsuBoatData: tsuBoatData.sort((left, right) => left.frameNo - right.frameNo),
		tsuMotorHistory: tsuMotorHistory.sort((left, right) => left.frameNo - right.frameNo),
	};
}

function parseTsuDatafileStats(html, { noKey, secondRateKey, winRateKey }) {
	const $ = load(html);
	const rows = new Map();
	$("table")
		.first()
		.children("tbody")
		.first()
		.children("tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 9) {
				return;
			}

			const no = readCellText($, $(cells[0]).find("a.js-lightbox-btn").first());
			if (!no) {
				return;
			}

			rows.set(no, {
				[noKey]: no,
				[secondRateKey]: readTsuCellOwnText($, cells[1]),
				[winRateKey]: readTsuCellOwnText($, cells[2]),
				firstCount: readTsuCellOwnText($, cells[3]),
				secondCount: readTsuCellOwnText($, cells[4]),
				thirdCount: readTsuCellOwnText($, cells[5]),
				starts: readTsuCellOwnText($, cells[6]),
				finalCount: readTsuCellOwnText($, cells[7]),
				championCount: readTsuCellOwnText($, cells[8]),
				source: TSU_SOURCE,
			});
		});

	return rows;
}

function parseTsuCourseRateTable($, table) {
	return $(table)
		.find("tr")
		.toArray()
		.flatMap((rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			const courseNo = parseEmbeddedFrameNo(readCellText($, cells[0]));
			if (!courseNo || cells.length < 7) {
				return [];
			}

			return [{
				courseNo,
				firstRate: readCellText($, cells[1]),
				secondRate: readCellText($, cells[2]),
				thirdRate: readCellText($, cells[3]),
				fourthRate: readCellText($, cells[4]),
				fifthRate: readCellText($, cells[5]),
				sixthRate: readCellText($, cells[6]),
			}];
		});
}

function parseTsuDecisionRateTable($, table) {
	return $(table)
		.find("tr")
		.toArray()
		.flatMap((rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			const courseNo = parseEmbeddedFrameNo(readCellText($, cells[0]));
			if (!courseNo || cells.length < 7) {
				return [];
			}

			return [{
				courseNo,
				escapeRate: readCellText($, cells[1]),
				frontRunRate: readCellText($, cells[1]),
				makuriRate: readCellText($, cells[2]),
				sashiRate: readCellText($, cells[3]),
				makuriSashiRate: readCellText($, cells[4]),
				overtakeRate: readCellText($, cells[5]),
				luckyRate: readCellText($, cells[6]),
			}];
		});
}

function parseTsuWaterSurfaceInfo(html) {
	const $ = load(html);
	const surfaceText = compactText($(".suimen_tokusei_area").first().text());
	const courseRates = parseTsuCourseRateTable($, $(".cbetsu_table").first());
	const decisionRates = parseTsuDecisionRateTable($, $(".cbetsu_table").eq(1));
	const boatCourseRates = parseTsuCourseRateTable($, $(".wbetsu_table").first());
	const decisionByCourse = new Map(decisionRates.map((row) => [row.courseNo, row]));
	const courseResults = courseRates.map((row) => ({
		...row,
		decisionRates: decisionByCourse.get(row.courseNo) ?? null,
		source: TSU_SOURCE,
	}));
	const topCourse = courseRates
		.map((row) => ({ courseNo: row.courseNo, firstRate: Number.parseFloat(row.firstRate) }))
		.filter((row) => Number.isFinite(row.firstRate))
		.sort((left, right) => right.firstRate - left.firstRate)[0];

	if (!surfaceText && !courseResults.length && !boatCourseRates.length) {
		return { waterSurfaceInfo: null, tsuCourseResults: [] };
	}

	return {
		waterSurfaceInfo: {
			surfaceSummary: surfaceText,
			featureSummary: surfaceText,
			courseSummary: [
				courseResults.length ? `Course finish rates ${courseResults.length} rows` : "",
				decisionRates.length ? `Decision rates ${decisionRates.length} rows` : "",
				topCourse ? `Top first-place course: ${topCourse.courseNo} course ${topCourse.firstRate}%` : "",
				boatCourseRates.length ? `Frame-course rates ${boatCourseRates.length} rows` : "",
			].filter(Boolean).join(" / "),
			courseResults,
			boatCourseRates,
			source: TSU_SOURCE,
		},
		tsuCourseResults: courseResults,
	};
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

function parseTokuyamaIdentity($, cell) {
	const lines = $(cell)
		.find("li")
		.toArray()
		.map((item) => readCellText($, item))
		.filter(Boolean);

	if (lines.length >= 3) {
		const head = compactText(lines[0]);
		const match = head.match(/^([AB][12])\/?(\d+)$/);
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

function parseTokuyamaMotorMark($, cell) {
	const src = $(cell).find("img").attr("src") ?? "";

	if (src.includes("ico-mark-01")) {
		return "◎";
	}

	if (src.includes("ico-mark-02")) {
		return "○";
	}

	if (src.includes("ico-mark-03")) {
		return "△";
	}

	return readCellText($, cell).replace(/^.*[:：]/, "").trim();
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

function parseWakamatsuTideInfo(html, date) {
	const $ = load(html);
	const lines = readCleanLines($("body"));
	const targetDate = String(date ?? "").replaceAll("-", "/");
	const targetDateShort = targetDate.replace(/\/0/g, "/");

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const text = compactText(line);
		const normalizedText = text.replace(/\/0/g, "/");

		if (!text.startsWith(targetDate) && !normalizedText.startsWith(targetDateShort)) {
			continue;
		}

		const match = text.match(/^(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})\s+([+-]?\d+(?:\.\d+)?m)\s+(\d{1,2}:\d{2})\s+([+-]?\d+(?:\.\d+)?m)$/);

		if (match) {
			return {
				date: match[1],
				dayLabel: "",
				lowTideTime: match[2],
				lowTideLevel: match[3],
				highTideTime: match[4],
				highTideLevel: match[5],
				tideType: "",
				source: WAKAMATSU_SOURCE,
			};
		}

		const lowTideTime = compactText(lines[index + 1] ?? "");
		const lowTideLevel = compactText(lines[index + 2] ?? "");
		const highTideTime = compactText(lines[index + 3] ?? "");
		const highTideLevel = compactText(lines[index + 4] ?? "");

		if (
			/^\d{1,2}:\d{2}$/.test(lowTideTime) &&
			/^[+-]?\d+(?:\.\d+)?m$/.test(lowTideLevel) &&
			/^\d{1,2}:\d{2}$/.test(highTideTime) &&
			/^[+-]?\d+(?:\.\d+)?m$/.test(highTideLevel)
		) {
			return {
				date: text,
				dayLabel: "",
				lowTideTime,
				lowTideLevel,
				highTideTime,
				highTideLevel,
				tideType: "",
				source: WAKAMATSU_SOURCE,
			};
		}
	}

	return null;
}

function parseWakamatsuWaterSurfaceInfo(html) {
	const $ = load(html);
	const lines = readCleanLines($("body")).map((line) => compactText(line));
	const surfaceIndex = lines.findIndex((line, index) =>
		line === "水質" && lines[index + 1] === "流れ・水位変化" && lines[index + 2] === "チルト",
	);
	const surfaceSummary = surfaceIndex >= 0
		? [
				lines[surfaceIndex + 3] ? `水質 ${lines[surfaceIndex + 3]}` : "",
				lines[surfaceIndex + 4] ? `流れ・水位変化 ${lines[surfaceIndex + 4]}` : "",
				lines[surfaceIndex + 5] ? `チルト ${lines[surfaceIndex + 5]}` : "",
			].filter(Boolean).join(" / ")
		: "";

	const featureHeadingIndex = lines.findIndex((line, index) =>
		line === "水面特性" && lines[index + 1] === "レースの特徴",
	);
	const featureSummary = featureHeadingIndex >= 0 ? lines[featureHeadingIndex + 2] ?? "" : "";
	const courseSummary = featureHeadingIndex >= 0 ? lines[featureHeadingIndex + 3] ?? "" : "";

	if (!surfaceSummary && !featureSummary && !courseSummary) {
		return null;
	}

	return {
		surfaceSummary,
		featureSummary,
		courseSummary,
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

function parseTokuyamaOriginalExhibition(html) {
	const $ = load(html);
	const table = $("table.c_table.group.cyokuzen").first().get(0) ?? findTableByKeywords($, ["展示タイム", "一周", "まわり足"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const bodyRows = $(table).find("tbody tr").toArray();

	for (let rowIndex = 0; rowIndex + 1 < bodyRows.length; rowIndex += 2) {
		const firstRow = $(bodyRows[rowIndex]);
		const secondRow = $(bodyRows[rowIndex + 1]);
		const frameNo = parseFrameNo(readCellText($, firstRow.find("td.waku,th.waku").first()));

		if (!frameNo) {
			continue;
		}

		const identity = parseTokuyamaIdentity($, firstRow.find("td.com-racer-data, td[class*='tei_sub_color']").first());
		const partsExchange = readCellText($, secondRow.find("td.col-buhin").first());
		const previousRaceInfo = [
			readCellText($, firstRow.find("td.col13").first()),
			readCellText($, firstRow.find("td.col14").first()),
			readCellText($, firstRow.find("td.col15").first()),
			readCellText($, firstRow.find("td.col16").first()),
		].filter(Boolean).join(" / ");

		rows.push({
			frameNo,
			...identity,
			weight: readCellText($, firstRow.find("td.col5").first()),
			weightAdjustment: readCellText($, firstRow.find("td.col6").first()),
			motorNo: readCellText($, firstRow.find("td.col7").first()),
			motorSecondRate: readCellText($, firstRow.find("td.col8").first()),
			tilt: readCellText($, firstRow.find("td.col9").first()),
			exhibitionTime: readCellText($, firstRow.find("td.col10").first()),
			oneLapTime: readCellText($, firstRow.find("td.col11").first()),
			turnTime: readCellText($, firstRow.find("td.col12").first()),
			straightTime: "",
			exhibitionEvaluation: readCellText($, firstRow.find("td.col1").first()),
			memo: [
				partsExchange ? `部品交換 ${partsExchange}` : "",
				previousRaceInfo ? `前走 ${previousRaceInfo}` : "",
			].filter(Boolean).join(" / "),
			source: TOKUYAMA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTokuyamaMotorSummary(html) {
	const $ = load(html);
	const table = $("table.c_table.motor_history").first().get(0) ?? findTableByKeywords($, ["モーター履歴", "使用選手", "節間成績"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const bodyRows = $(table).find("tbody tr").toArray();

	for (let rowIndex = 0; rowIndex + 2 < bodyRows.length; rowIndex += 3) {
		const firstRow = $(bodyRows[rowIndex]);
		const secondRow = $(bodyRows[rowIndex + 1]);
		const thirdRow = $(bodyRows[rowIndex + 2]);
		const frameNo = parseFrameNo(readCellText($, firstRow.find("td.col1,th.col1").first()));

		if (!frameNo) {
			continue;
		}

		const identity = parseTokuyamaIdentity($, firstRow.find("td.col2").first());
		const motorSegments = readCellSegments($, firstRow.find("td.col3").first());
		const historyEntries = [firstRow, secondRow, thirdRow]
			.map((row) => ({
				label: readCellText($, row.find("td.col6").first()),
				playerName: readCellText($, row.find("td.col7").first()),
				results: readCellText($, row.find("td.col8").first()),
			}))
			.filter((item) => item.label || item.playerName || item.results);
		const motorGrade = [
			`出${parseTokuyamaMotorMark($, firstRow.find("td[class^='col4']").first()) || "-"}`,
			`伸${parseTokuyamaMotorMark($, secondRow.find("td[class^='col4']").first()) || "-"}`,
			`回${parseTokuyamaMotorMark($, thirdRow.find("td[class^='col4']").first()) || "-"}`,
		].join(" / ");

		rows.push({
			frameNo,
			...identity,
			motorNo: motorSegments[0] ?? "",
			motorSecondRate: motorSegments[1] ?? "",
			previousUser: historyEntries[0]?.playerName ?? "",
			recentResults: historyEntries[0]?.results ?? "",
			motorGrade,
			comment: historyEntries
				.map((item) => [item.label, item.playerName, item.results].filter(Boolean).join(" "))
				.filter(Boolean)
				.join(" / "),
			source: TOKUYAMA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTokuyamaAbilityIndex(html) {
	const $ = load(html);
	const table = $("table.c_table").first().get(0) ?? findTableByKeywords($, ["能力指数", "枠相性", "ST力"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
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
				source: TOKUYAMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTokuyamaFramePast10(html) {
	const $ = load(html);
	const table = $("table.c_table.group").first().get(0) ?? findTableByKeywords($, ["枠番別データ", "平均ST", "前走"]);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table)
		.children("tbody")
		.each((_, bodyElement) => {
			const trList = $(bodyElement).children("tr").toArray();
			if (trList.length < 2) {
				return;
			}

			const firstCells = $(trList[0]).children("td,th").toArray();
			const secondCells = $(trList[1]).children("td,th").toArray();
			if (firstCells.length < 16 || secondCells.length < 11) {
				return;
			}

			const frameNo = parseFrameNo(readCellText($, firstCells[0]));
			if (!frameNo) {
				return;
			}

			const identity = parseTokuyamaIdentity($, firstCells[1]);
			rows.push({
				frameNo,
				className: identity.className,
				registrationNo: identity.registrationNo,
				registerNo: identity.registerNo,
				playerName: identity.playerName,
				profile: identity.profile,
				courseHistory: firstCells.slice(3, 13).map((cell) => readCellText($, cell)).slice(0, 10),
				finishHistory: secondCells.slice(1, 11).map((cell) => readCellText($, cell)).slice(0, 10),
				startTimingHistory: [],
				frameWinRate: readCellText($, firstCells[13]),
				frameAverageStart: readCellText($, firstCells[14]),
				frameStartOrder: readCellText($, firstCells[15]),
				source: TOKUYAMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTokuyamaScoreRateGuide(html) {
	const $ = load(html);
	const table = $("table.c_table").first().get(0) ?? findTableByKeywords($, ["得点率", "順位", "1着", "6着"]);

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

			const identity = parseTokuyamaIdentity($, cells[1]);
			rows.push({
				frameNo,
				registrationNo: identity.registrationNo,
				registerNo: identity.registerNo,
				playerName: identity.playerName,
				className: identity.className,
				scoreRate: readCellText($, cells[2]),
				source: TOKUYAMA_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTokuyamaSectionResults(html) {
	const $ = load(html);
	const table = $("table.c_table").first().get(0) ?? findTableByKeywords($, ["ST", "着"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tbody tr").toArray();

	for (let rowIndex = 0; rowIndex + 3 < trList.length; rowIndex += 4) {
		const firstCells = $(trList[rowIndex]).children("td,th").toArray();
		const secondCells = $(trList[rowIndex + 1]).children("td,th").toArray();
		const thirdCells = $(trList[rowIndex + 2]).children("td,th").toArray();
		const fourthCells = $(trList[rowIndex + 3]).children("td,th").toArray();
		const frameNo = parseFrameNo(readCellText($, firstCells[0]));

		if (!frameNo) {
			continue;
		}

		const raceNumbers = firstCells.slice(3).map((cell) => readCellText($, cell)).slice(0, 12);
		const courses = secondCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12);
		const startTimings = thirdCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12);
		const finishOrders = fourthCells.slice(1).map((cell) => readCellText($, cell)).slice(0, 12);
		const sectionResults = raceNumbers
			.map((raceNo, index) => ({
				raceNo,
				course: courses[index] ?? "",
				startTiming: startTimings[index] ?? "",
				finishOrder: finishOrders[index] ?? "",
			}))
			.filter((item) => item.raceNo && item.raceNo !== "-")
			.map((item) => `${item.raceNo}R ${item.course && item.course !== "-" ? `${item.course}コース` : ""} ${item.startTiming && item.startTiming !== "-" ? `ST${item.startTiming}` : ""} ${item.finishOrder && item.finishOrder !== "-" ? `${item.finishOrder}着` : ""}`.replace(/\s+/g, " ").trim())
			.join(" / ");

		rows.push({
			frameNo,
			sectionResults,
			source: TOKUYAMA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTokuyamaTideInfo(html, date) {
	const $ = load(html);
	const table = findTableByKeywords($, ["日付", "干潮", "満潮"]);

	if (!table) {
		return null;
	}

	const targetDate = String(date ?? "").replaceAll("-", "/");
	let matchedRow = null;

	$(table)
		.find("tbody tr")
		.each((_, rowElement) => {
			if (matchedRow) {
				return;
			}

			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 5) {
				return;
			}

			const rowDate = readCellText($, cells[0]);
			if (rowDate !== targetDate) {
				return;
			}

			matchedRow = {
				date: rowDate,
				lowTideTime: readCellText($, cells[1]),
				lowTideLevel: readCellText($, cells[2]),
				highTideTime: readCellText($, cells[3]),
				highTideLevel: readCellText($, cells[4]),
			};
		});

	if (!matchedRow) {
		return null;
	}

	return {
		...matchedRow,
		dayLabel: "",
		tideType: "",
		source: TOKUYAMA_SOURCE,
	};
}

function parseTokuyamaWaterSurfaceInfo(html) {
	const $ = load(html);
	const table = findTableByKeywords($, ["水質", "干満の差", "チルト角度", "水面特性"]);

	if (!table) {
		return null;
	}

	const valueMap = new Map();
	$(table)
		.find("tr")
		.each((_, rowElement) => {
			const cells = $(rowElement).children("td,th").toArray();
			if (cells.length < 2) {
				return;
			}

			valueMap.set(readCellText($, cells[0]), readCellText($, cells[1]));
		});

	const surfaceSummary = [
		valueMap.get("水質") ? `水質 ${valueMap.get("水質")}` : "",
		valueMap.get("干満の差") ? `干満の差 ${valueMap.get("干満の差")}` : "",
		valueMap.get("チルト角度") ? `チルト角度 ${valueMap.get("チルト角度")}` : "",
	].filter(Boolean).join(" / ");
	const featureSummary = compactText(valueMap.get("水面特性") ?? "");
	const courseSummary = compactText(valueMap.get("レース特徴") ?? "");

	if (!surfaceSummary && !featureSummary && !courseSummary) {
		return null;
	}

	return {
		surfaceSummary,
		featureSummary,
		courseSummary,
		source: TOKUYAMA_SOURCE,
	};
}

async function fetchTokuyamaRaceExtra({ date, raceNo }) {
	const settled = await Promise.allSettled([
		fetchHtml(toTokuyamaYosouUrl({ date, raceNo, type: "tenji" })),
		fetchHtml(toTokuyamaYosouUrl({ date, raceNo, type: "motor_history" })),
		fetchHtml(toTokuyamaYosouUrl({ date, raceNo, type: "capability_index" })),
		fetchHtml(toTokuyamaYosouUrl({ date, raceNo, type: "waku10" })),
		fetchHtml(toTokuyamaYosouUrl({ date, raceNo, type: "tokuhayami" })),
		fetchHtml(toTokuyamaYosouUrl({ date, raceNo, type: "setsukan" })),
	]);
	const tenjiHtml = settled[0]?.status === "fulfilled" ? settled[0].value : "";
	const motorHistoryHtml = settled[1]?.status === "fulfilled" ? settled[1].value : "";
	const capabilityHtml = settled[2]?.status === "fulfilled" ? settled[2].value : "";
	const framePast10Html = settled[3]?.status === "fulfilled" ? settled[3].value : "";
	const scoreHtml = settled[4]?.status === "fulfilled" ? settled[4].value : "";
	const sectionHtml = settled[5]?.status === "fulfilled" ? settled[5].value : "";
	const originalExhibition = tenjiHtml ? parseTokuyamaOriginalExhibition(tenjiHtml) : [];
	const motorSummary = motorHistoryHtml ? parseTokuyamaMotorSummary(motorHistoryHtml) : [];
	const abilityIndex = capabilityHtml ? parseTokuyamaAbilityIndex(capabilityHtml) : [];
	const tokuyamaFramePast10 = framePast10Html ? parseTokuyamaFramePast10(framePast10Html) : [];
	const sectionResultsByFrame = new Map(
		(sectionHtml ? parseTokuyamaSectionResults(sectionHtml) : []).map((row) => [row.frameNo, row.sectionResults]),
	);
	const scoreQuickLook = scoreHtml
		? parseTokuyamaScoreRateGuide(scoreHtml).map((row) => ({
			...row,
			sectionResults: sectionResultsByFrame.get(row.frameNo) ?? "",
		}))
		: [];
	const officialBeforeInfo = scoreQuickLook.length > 0
		? {
			status: "available",
			source: TOKUYAMA_SOURCE,
			scoreQuickLook,
		}
		: null;

	console.log(
		`[venue-extras] tokuyama ${raceNo}R: exhibition ${originalExhibition.length} / motor ${motorSummary.length} / ability ${abilityIndex.length} / frame10 ${tokuyamaFramePast10.length} / score ${scoreQuickLook.length}`,
	);

	if (!originalExhibition.length && !motorSummary.length && !abilityIndex.length && !tokuyamaFramePast10.length && !scoreQuickLook.length) {
		return {
			raceNo,
			status: "waiting",
			source: TOKUYAMA_SOURCE,
			sourceType: "official-venue-yosou-tabs",
			originalExhibition: [],
			motorSummary: [],
			abilityIndex: [],
			tokuyamaFramePast10: [],
		};
	}

	return {
		raceNo,
		status: "available",
		source: TOKUYAMA_SOURCE,
		sourceType: "official-venue-yosou-tabs",
		officialBeforeInfo,
		originalExhibition,
		motorSummary,
		abilityIndex,
		tokuyamaFramePast10,
	};
}

async function createTokuyamaVenue(feed, date) {
	const tokuyamaVenue = findVenue(feed, TOKUYAMA_VENUE_NAME);

	if (!tokuyamaVenue) {
		console.log("[venue-extras] tokuyama: not held today");
		return null;
	}

	try {
		const races = getRaceList(tokuyamaVenue);
		const [tideHtml, waterSurfaceHtml] = await Promise.all([
			fetchHtml(TOKUYAMA_TIDE_URL).catch(() => ""),
			fetchHtml(TOKUYAMA_WATER_SURFACE_URL).catch(() => ""),
		]);
		const tideInfo = tideHtml ? parseTokuyamaTideInfo(tideHtml, date) : null;
		const waterSurfaceInfo = waterSurfaceHtml ? parseTokuyamaWaterSurfaceInfo(waterSurfaceHtml) : null;
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(await fetchTokuyamaRaceExtra({ date, raceNo: race.raceNo }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;
		console.log(
			`[venue-extras] tokuyama: ${availableRaceCount}/${raceExtras.length} races${tideInfo ? " + tide" : ""}${waterSurfaceInfo ? " + water surface" : ""}`,
		);

		return {
			venueCode: String(tokuyamaVenue.venueCode ?? "18"),
			venueName: TOKUYAMA_VENUE_NAME,
			source: TOKUYAMA_SOURCE,
			isAvailable: availableRaceCount > 0 || Boolean(tideInfo || waterSurfaceInfo),
			status: availableRaceCount > 0 || tideInfo || waterSurfaceInfo ? "available" : "waiting-tokuyama-data",
			note: "徳山公式HPの展示情報・モーター履歴・能力指数・得点率早見・潮見表・水面特性を取得",
			tideInfo,
			waterSurfaceInfo,
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] tokuyama failed: ${error.message}`);

		return {
			venueCode: String(tokuyamaVenue.venueCode ?? "18"),
			venueName: TOKUYAMA_VENUE_NAME,
			source: TOKUYAMA_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `徳山公式HPの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
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

async function fetchTsuRaceExtra({ date, race, raceNo, motorStats = new Map(), boatStats = new Map(), waterSurfaceInfo = null, tsuCourseResults = [] }) {
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
	const {
		motorSummary,
		tsuMotorData,
		tsuBoatData,
		tsuMotorHistory,
	} = parseTsuMotorBoat(syussouHtml, motorStats, boatStats);
	const motorByFrame = new Map(tsuMotorData.map((row) => [row.frameNo, row]));
	const boatByFrame = new Map(tsuBoatData.map((row) => [row.frameNo, row]));
	const mergedTsuBeforeInfo = tsuBeforeInfo.map((row) => {
		const motor = motorByFrame.get(row.frameNo) ?? {};
		const boat = boatByFrame.get(row.frameNo) ?? {};
		return {
			...row,
			motorNo: motor.motorNo ?? "",
			motorSecondRate: motor.motorSecondRate ?? "",
			motorWinRate: motor.motorWinRate ?? "",
			boatNo: boat.boatNo ?? "",
			boatSecondRate: boat.boatSecondRate ?? "",
			boatWinRate: boat.boatWinRate ?? "",
		};
	});
	const mergedOriginalExhibition = originalExhibition.map((row) => {
		const motor = motorByFrame.get(row.frameNo) ?? {};
		const boat = boatByFrame.get(row.frameNo) ?? {};
		return {
			...row,
			motorNo: motor.motorNo ?? "",
			motorSecondRate: motor.motorSecondRate ?? "",
			motorWinRate: motor.motorWinRate ?? "",
			boatNo: boat.boatNo ?? "",
			boatSecondRate: boat.boatSecondRate ?? "",
			boatWinRate: boat.boatWinRate ?? "",
		};
	});
	const mergedScoreRateGuide = tsuScoreRateGuide.map((row) => {
		const motor = motorByFrame.get(row.frameNo) ?? {};
		const before = mergedTsuBeforeInfo.find((item) => item.frameNo === row.frameNo) ?? {};
		return {
			...row,
			registrationNo: before.registrationNo ?? row.registrationNo ?? "",
			registerNo: before.registerNo ?? row.registerNo ?? "",
			playerName: before.playerName ?? row.playerName ?? "",
			className: before.className ?? row.className ?? "",
			motorNo: motor.motorNo ?? row.motorNo ?? "",
			motorSecondRate: motor.motorSecondRate ?? row.motorSecondRate ?? "",
			motorWinRate: motor.motorWinRate ?? "",
		};
	});
	const startExhibitionRows = startExhibition.length
		? startExhibition
		: buildOfficialBeforeInfoStartExhibitionRows(race, mergedTsuBeforeInfo);
	const officialBeforeInfo = mergedTsuBeforeInfo.length || startExhibitionRows.length || mergedScoreRateGuide.length
		? {
				status: "available",
				source: TSU_SOURCE,
				exhibitionRows: mergedTsuBeforeInfo,
				scoreQuickLook: mergedScoreRateGuide,
				...(startExhibitionRows.length ? { startExhibition: startExhibitionRows } : {}),
			}
		: null;

	console.log(
		`[venue-extras] tsu ${raceNo}R: before ${mergedTsuBeforeInfo.length} / exhibition ${mergedOriginalExhibition.length} / start ${startExhibitionRows.length} / frame10 ${tsuFramePast10.length} / comments ${tsuRacerComments.length} / series ${tsuSeriesResults.length} / national3 ${tsuNationalRecent3.length} / local3 ${tsuLocalRecent3.length} / score ${mergedScoreRateGuide.length} / motor ${motorSummary.length} / boat ${tsuBoatData.length} / course ${tsuCourseResults.length}`,
	);

	if (!mergedTsuBeforeInfo.length && !startExhibition.length && !mergedOriginalExhibition.length && !tsuFramePast10.length && !tsuRacerComments.length && !tsuSeriesResults.length && !tsuNationalRecent3.length && !tsuLocalRecent3.length && !mergedScoreRateGuide.length && !motorSummary.length && !tsuBoatData.length) {
		return {
			raceNo,
			status: "waiting",
			source: TSU_SOURCE,
			sourceType: "official-venue-yosou-tabs",
			officialBeforeInfo,
			weatherCondition: null,
			waterSurfaceInfo,
			beforeInfo: [],
			tsuBeforeInfo: [],
			...(startExhibitionRows.length ? { startExhibition: startExhibitionRows } : {}),
			...(mergedOriginalExhibition.length ? { originalExhibition: mergedOriginalExhibition } : {}),
			motorSummary: [],
			tsuMotorData: [],
			tsuBoatData: [],
			tsuMotorHistory: [],
			tsuCourseResults,
			tsuFramePast10: [],
			frameLast10: [],
			tsuRacerComments: [],
			racerComments: [],
			tsuSeriesResults: [],
			sectionResults: [],
			tsuNationalRecent3: [],
			nationalRecent3: [],
			tsuLocalRecent3: [],
			localRecent3: [],
			tsuScoreRateGuide: [],
			scoreRateGuide: [],
		};
	}

	return {
		raceNo,
		status: "available",
		source: TSU_SOURCE,
		sourceType: "official-venue-yosou-tabs",
		officialBeforeInfo,
		waterSurfaceInfo,
		beforeInfo: mergedTsuBeforeInfo,
		tsuBeforeInfo: mergedTsuBeforeInfo,
		...(startExhibitionRows.length ? { startExhibition: startExhibitionRows } : {}),
		...(mergedOriginalExhibition.length ? { originalExhibition: mergedOriginalExhibition } : {}),
		motorSummary,
		tsuMotorData,
		tsuBoatData,
		tsuMotorHistory,
		tsuCourseResults,
		tsuFramePast10,
		frameLast10: tsuFramePast10,
		tsuRacerComments,
		racerComments,
		tsuSeriesResults,
		sectionResults: tsuSeriesResults,
		tsuNationalRecent3,
		nationalRecent3: tsuNationalRecent3,
		tsuLocalRecent3,
		localRecent3: tsuLocalRecent3,
		tsuScoreRateGuide: mergedScoreRateGuide,
		scoreRateGuide: mergedScoreRateGuide,
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
		const [motorDataHtml, boatDataHtml, waterSurfaceHtml] = await Promise.all([
			fetchTsuPageHtml(TSU_MOTOR_DATA_URL).catch((error) => {
				console.warn(`[venue-extras] tsu motor data failed: ${error.message}`);
				return "";
			}),
			fetchTsuPageHtml(TSU_BOAT_DATA_URL).catch((error) => {
				console.warn(`[venue-extras] tsu boat data failed: ${error.message}`);
				return "";
			}),
			fetchTsuPageHtml(TSU_WATER_SURFACE_URL).catch((error) => {
				console.warn(`[venue-extras] tsu water surface failed: ${error.message}`);
				return "";
			}),
		]);
		const motorStats = motorDataHtml
			? parseTsuDatafileStats(motorDataHtml, { noKey: "motorNo", secondRateKey: "motorSecondRate", winRateKey: "motorWinRate" })
			: new Map();
		const boatStats = boatDataHtml
			? parseTsuDatafileStats(boatDataHtml, { noKey: "boatNo", secondRateKey: "boatSecondRate", winRateKey: "boatWinRate" })
			: new Map();
		const { waterSurfaceInfo, tsuCourseResults } = waterSurfaceHtml
			? parseTsuWaterSurfaceInfo(waterSurfaceHtml)
			: { waterSurfaceInfo: null, tsuCourseResults: [] };

		for (const race of races) {
			raceExtras.push(await fetchTsuRaceExtra({ date, race, raceNo: race.raceNo, motorStats, boatStats, waterSurfaceInfo, tsuCourseResults }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;

		return {
			venueCode: String(tsuVenue.venueCode ?? "09"),
			venueName: TSU_VENUE_NAME,
			source: TSU_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-tsu-data",
			waterSurfaceInfo,
			tsuCourseResults,
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

function normalizeMikuniPlayerName(value) {
	return compactText(value).replace(/\s+/g, "");
}

function getRaceRacerRows(race) {
	return Array.isArray(race?.racers) ? race.racers : [];
}

function getRacerFrameNo(racer) {
	return readRaceFrameNo(racer?.frameNo ?? racer?.frame ?? racer?.lane ?? racer?.boatNumber);
}

function getRacerRegistrationNo(racer) {
	return readRaceString(racer?.registrationNo ?? racer?.racerId ?? racer?.registerNo);
}

function getRacerPlayerName(racer) {
	return readRaceString(racer?.playerName ?? racer?.name ?? racer?.boatRacerName);
}

function findMikuniRowForRacer(rows, racer) {
	const registrationNo = getRacerRegistrationNo(racer);
	const playerName = normalizeMikuniPlayerName(getRacerPlayerName(racer));

	return rows.find((row) =>
		(registrationNo && row.registrationNo === registrationNo) ||
		(playerName && normalizeMikuniPlayerName(row.playerName) === playerName)
	) ?? null;
}

function parseMikuniScoreRateGuide(html) {
	const $ = load(html);
	const rows = [];
	const table = findTableByKeywords($, ["得点率", "節間成績"]);

	if (!table) {
		return rows;
	}

	$(table).find("tr").each((_, tr) => {
		const cells = $(tr).children("th, td").toArray().map((cell) => readCellText($, cell));
		if (cells.length < 10 || !/^\d+$/.test(cells[0])) {
			return;
		}

		rows.push({
			rank: cells[0],
			className: cells[1],
			registrationNo: cells[2],
			playerName: cells[3],
			branch: cells[4],
			scoreRate: cells[5],
			score: cells[6],
			deduction: cells[7],
			starts: cells[8],
			sectionResults: cells[9],
			remarks: cells.slice(10).filter(Boolean).join(" / "),
			source: MIKUNI_SOURCE,
		});
	});

	return rows;
}

function parseMikuniTimerank(html) {
	const $ = load(html);
	const rows = [];
	const table = findTableByKeywords($, ["前検タイム", "モーター"]);

	if (!table) {
		return rows;
	}

	$(table).find("tr").each((_, tr) => {
		const cells = $(tr).children("th, td").toArray().map((cell) => readCellText($, cell));
		if (cells.length < 9 || !/^[AB]\d$/.test(cells[0])) {
			return;
		}

		rows.push({
			className: cells[0],
			registrationNo: cells[1],
			playerName: cells[2],
			branch: cells[3],
			motorNo: cells[4],
			motorSecondRate: cells[5],
			boatNo: cells[6],
			boatSecondRate: cells[7],
			preinspectionTime: cells[8],
			source: MIKUNI_SOURCE,
		});
	});

	return rows;
}

function parseMikuniMotorData(html) {
	const $ = load(html);
	const rows = [];
	const table = findTableByKeywords($, ["モーター番号", "2連対率", "優勝回数"]);

	if (!table) {
		return rows;
	}

	$(table).find("tr").each((_, tr) => {
		const cells = $(tr).children("th, td").toArray().map((cell) => readCellText($, cell));
		if (cells.length < 7 || !/^\d+$/.test(cells[0])) {
			return;
		}

		const link = $(tr).find("a[href*='motor_hist']").first().attr("href");
		const motorNo = cells[2];

		rows.push({
			rank: cells[0],
			previousRank: cells[1],
			motorNo,
			motorSecondRate: cells[3],
			motorWinRate: cells[4],
			finals: cells[5],
			championships: cells[6],
			detailUrl: link ? new URL(link, MIKUNI_MOTOR_DATA_URL).toString() : toMikuniMotorHistoryUrl(motorNo),
			source: MIKUNI_SOURCE,
		});
	});

	return rows;
}

function parseMikuniMotorHistory(html) {
	const $ = load(html);
	const rows = [];
	const table = findTableByKeywords($, ["開催期間", "使用選手", "節間成績"]);

	if (!table) {
		return rows;
	}

	$(table).find("tr").each((_, tr) => {
		const cells = $(tr).children("th, td").toArray().map((cell) => readCellText($, cell));
		if (cells.length < 4 || !/\d{4}\//.test(cells[0])) {
			return;
		}

		rows.push({
			dateRange: cells[0],
			title: cells[1],
			racerName: cells[2],
			results: cells[3],
			source: MIKUNI_SOURCE,
		});
	});

	return rows;
}

function parseMikuniCourseResults(html, race) {
	const $ = load(html);
	const table = findTableByKeywords($, ["進入率", "平均ST", "1着率"]);
	const rowsByFrame = new Map();
	let currentFrameNo = null;
	let currentPlayerName = "";

	if (!table) {
		return [];
	}

	$(table).find("tr").each((_, tr) => {
		const cells = $(tr).children("th, td").toArray().map((cell) => readCellText($, cell));
		if (cells.length < 9 || cells[0] === "枠") {
			return;
		}

		let courseOffset = 0;
		const frameNo = parseFrameNo(cells[0]);
		if (frameNo && cells.length >= 11) {
			currentFrameNo = frameNo;
			currentPlayerName = cells[1];
			courseOffset = 2;
		} else if (currentFrameNo) {
			courseOffset = 0;
		} else {
			return;
		}

		const courseNo = readRaceFrameNo(cells[courseOffset]);
		if (!currentFrameNo || !courseNo) {
			return;
		}

		const existing = rowsByFrame.get(currentFrameNo) ?? {
			frameNo: currentFrameNo,
			playerName: currentPlayerName,
			courseRows: [],
			source: MIKUNI_SOURCE,
		};

		existing.courseRows.push({
			courseNo,
			entryRate: cells[courseOffset + 1],
			averageStart: cells[courseOffset + 2],
			firstRate: cells[courseOffset + 3],
			secondRate: cells[courseOffset + 4],
			thirdRate: cells[courseOffset + 5],
			fourthRate: cells[courseOffset + 6],
			fifthRate: cells[courseOffset + 7],
			sixthRate: cells[courseOffset + 8],
		});

		rowsByFrame.set(currentFrameNo, existing);
	});

	const racerByFrame = new Map(getRaceRacerRows(race).map((racer) => [getRacerFrameNo(racer), racer]));

	return Array.from(rowsByFrame.values()).map((row) => {
		const racer = racerByFrame.get(row.frameNo);

		return {
			...row,
			className: readRaceString(racer?.class ?? racer?.grade ?? racer?.rank),
			registrationNo: getRacerRegistrationNo(racer),
			playerName: row.playerName || getRacerPlayerName(racer) || `枠${row.frameNo}`,
		};
	}).sort((left, right) => left.frameNo - right.frameNo);
}

function parseMikuniWaterSurfaceInfo(html) {
	const $ = load(html);
	const tables = $("table").toArray();
	const overviewText = tables[0] ? compactText($(tables[0]).text()) : "";
	const courseText = tables[1] ? compactText($(tables[1]).text()) : "";
	const entryText = tables[2] ? compactText($(tables[2]).text()) : "";

	if (!overviewText && !courseText && !entryText) {
		return null;
	}

	return {
		surfaceSummary: overviewText,
		featureSummary: courseText,
		courseSummary: entryText,
		source: MIKUNI_SOURCE,
	};
}

function parseMikuniOriginalPlayerCell(value) {
	const normalized = compactText(value);
	const match = normalized.match(/^(.*?)\s+([^\s/]+)\/(\d+)\s+([AB]\d)$/);

	if (!match) {
		return {
			playerName: normalized,
			branch: "",
			className: "",
		};
	}

	return {
		playerName: compactText(match[1]),
		branch: compactText(match[2]),
		className: compactText(match[4]),
	};
}

function parseMikuniOriginalExhibition(html, raceNo) {
	const $ = load(html);
	const table = findTableByKeywords($, ["半周", "まわり足", "直線", "選手名"]);
	const slitImageSrc = $("img[alt*='スタート展示']").first().attr("src");
	const slitImageUrl = slitImageSrc ? new URL(slitImageSrc, toMikuniksRaceUrl(raceNo)).toString() : "";

	if (!table) {
		return [];
	}

	const rows = [];

	$(table).find("tr").each((_, tr) => {
		const cells = $(tr).children("th, td").toArray().map((cell) => readCellText($, cell));
		const frameNo = parseFrameNo(cells[0]) ?? parseFrameNo(cells[1]);

		if (!frameNo || cells.length < 12) {
			return;
		}

		const player = parseMikuniOriginalPlayerCell(cells[2]);
		const registrationNo = cells[7];
		const motorNo = cells[11];
		const noteParts = ["三国オリジナルデータ", slitImageUrl ? "スリット画像あり" : ""].filter(Boolean);

		rows.push({
			frameNo,
			playerName: player.playerName,
			className: player.className,
			branch: player.branch,
			registrationNo,
			motorNo,
			halfLapTime: cells[3],
			turnTime: cells[4],
			straightTime: cells[5],
			weight: cells[6],
			note: noteParts.join(" / "),
			slitImageUrl,
			source: toMikuniksRaceUrl(raceNo),
		});
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function createMikuniOriginalExhibitionForRace(race, originalRows) {
	const racerByFrame = new Map(getRaceRacerRows(race).map((racer) => [getRacerFrameNo(racer), racer]));

	return originalRows.map((row) => {
		const racer = racerByFrame.get(row.frameNo);
		const motorNo = row.motorNo || readRaceString(racer?.motorNo ?? racer?.motorNumber);

		return {
			frameNo: row.frameNo,
			playerName: row.playerName || getRacerPlayerName(racer),
			className: row.className || readRaceString(racer?.class ?? racer?.grade ?? racer?.rank),
			registerNo: row.registrationNo || getRacerRegistrationNo(racer),
			weight: row.weight || "",
			motorNo,
			oneLapTime: row.halfLapTime || "",
			turnTime: row.turnTime || "",
			straightTime: row.straightTime || "",
			exhibitionEvaluation: "三国オリジナルデータ",
			memo: row.note || "",
			slitImageUrl: row.slitImageUrl || "",
			source: row.source || MIKUNIKS_SOURCE,
		};
	});
}

function createMikuniScoreRowsForRace(race, scoreRows) {
	return getRaceRacerRows(race)
		.map((racer) => {
			const frameNo = getRacerFrameNo(racer);
			if (!frameNo) {
				return null;
			}

			const score = findMikuniRowForRacer(scoreRows, racer);

			return {
				frameNo,
				registrationNo: getRacerRegistrationNo(racer),
				playerName: score?.playerName || getRacerPlayerName(racer),
				className: score?.className || readRaceString(racer?.class ?? racer?.grade ?? racer?.rank),
				branch: score?.branch || readRaceString(racer?.branch ?? racer?.hometown),
				averageStart: readRaceString(racer?.averageStart ?? racer?.averageSt ?? racer?.avgSt ?? racer?.st),
				winRate: readRaceString(racer?.winRate ?? racer?.winningRate),
				secondRate: readRaceString(racer?.secondRate ?? racer?.twoRate ?? racer?.quinellaRate),
				localWinRate: readRaceString(racer?.localWinRate),
				localSecondRate: readRaceString(racer?.localSecondRate),
				motorNo: readRaceString(racer?.motorNo ?? racer?.motorNumber),
				motorSecondRate: readRaceString(racer?.motorSecondRate ?? racer?.motorTwoRate ?? racer?.motorQuinellaRate),
				scoreRate: score?.scoreRate ?? "",
				score: score?.score ?? "",
				deduction: score?.deduction ?? "",
				starts: score?.starts ?? "",
				sectionResults: score?.sectionResults ?? "",
				remarks: score?.remarks ?? "",
				source: MIKUNI_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function createMikuniMotorSummaryForRace(race, timerankRows, motorRows, motorHistoryByNo) {
	return getRaceRacerRows(race)
		.map((racer) => {
			const frameNo = getRacerFrameNo(racer);
			const motorNo = readRaceString(racer?.motorNo ?? racer?.motorNumber);
			if (!frameNo || !motorNo) {
				return null;
			}

			const timerank = findMikuniRowForRacer(timerankRows, racer);
			const motor = motorRows.find((row) => row.motorNo === motorNo) ?? null;
			const historyEntries = motorHistoryByNo.get(motorNo) ?? [];
			const latest = historyEntries[0] ?? null;
			const motorSecondRate = motor?.motorSecondRate || timerank?.motorSecondRate || readRaceString(racer?.motorSecondRate ?? racer?.motorTwoRate);
			const motorWinRate = motor?.motorWinRate || "";
			const preinspectionTime = timerank?.preinspectionTime || "";

			return {
				frameNo,
				motorNo,
				playerName: getRacerPlayerName(racer),
				className: readRaceString(racer?.class ?? racer?.grade ?? racer?.rank),
				registerNo: getRacerRegistrationNo(racer),
				motorSecondRate,
				motorWinRate,
				boatNo: timerank?.boatNo || readRaceString(racer?.boatNo ?? racer?.boatMotorNo),
				boatSecondRate: timerank?.boatSecondRate || readRaceString(racer?.boatSecondRate ?? racer?.boatTwoRate),
				preinspectionTime,
				previousUser: latest?.racerName || "",
				recentResults: [
					motorSecondRate ? `2連率 ${motorSecondRate}` : "",
					motorWinRate ? `勝率 ${motorWinRate}` : "",
					preinspectionTime ? `前検 ${preinspectionTime}` : "",
					latest?.results ? `直近 ${latest.results}` : "",
				].filter(Boolean).join(" / "),
				motorGrade: motorSecondRate ? `2連率 ${motorSecondRate}` : "",
				comment: [
					motor?.rank ? `モーター順位 ${motor.rank}` : "",
					motor?.finals ? `優出 ${motor.finals}` : "",
					motor?.championships ? `優勝 ${motor.championships}` : "",
					latest?.title ? `前回 ${latest.title}` : "",
				].filter(Boolean).join(" / "),
				historyEntries,
				source: MIKUNI_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

async function createMikuniVenue(feed) {
	const mikuniVenue = findVenue(feed, MIKUNI_VENUE_NAME);

	if (!mikuniVenue) {
		console.log("[venue-extras] mikuni: not held today");
		return null;
	}

	try {
		const [scoreHtml, timerankHtml, motorHtml, waterHtml] = await Promise.all([
			fetchHtml(MIKUNI_SCORE_RATE_URL),
			fetchHtml(MIKUNI_TIMERANK_URL),
			fetchHtml(MIKUNI_MOTOR_DATA_URL),
			fetchHtml(MIKUNI_WATER_SURFACE_URL),
		]);
		const scoreRows = parseMikuniScoreRateGuide(scoreHtml);
		const timerankRows = parseMikuniTimerank(timerankHtml);
		const motorRows = parseMikuniMotorData(motorHtml);
		const waterSurfaceInfo = parseMikuniWaterSurfaceInfo(waterHtml);
		const motorNos = new Set(getRaceList(mikuniVenue).flatMap((race) =>
			getRaceRacerRows(race).map((racer) => readRaceString(racer?.motorNo ?? racer?.motorNumber)).filter(Boolean)
		));
		const motorTargets = Array.from(motorNos).map((motorNo) => {
			const motor = motorRows.find((row) => row.motorNo === motorNo);
			return {
				motorNo,
				url: motor?.detailUrl || toMikuniMotorHistoryUrl(motorNo),
			};
		});
		const motorHistorySettled = await Promise.allSettled(motorTargets.map((target) => fetchHtml(target.url)));
		const motorHistoryByNo = new Map();

		motorTargets.forEach((target, index) => {
			const html = motorHistorySettled[index]?.status === "fulfilled" ? motorHistorySettled[index].value : "";
			motorHistoryByNo.set(target.motorNo, html ? parseMikuniMotorHistory(html) : []);
		});

		const raceExtras = getRaceList(mikuniVenue).map((race) => {
			const officialBeforeInfo = buildOfficialBeforeInfoForRace(race);
			const weatherCondition = normalizeVenueWeatherCondition(officialBeforeInfo?.weatherCondition, {
				source: MIKUNI_SOURCE,
				sourceLabel: "Mikuni official weather",
			});
			const mikuniScoreRateGuide = createMikuniScoreRowsForRace(race, scoreRows);
			const motorSummary = createMikuniMotorSummaryForRace(race, timerankRows, motorRows, motorHistoryByNo);
			const mikuniCourseResults = parseMikuniCourseResults("", race);

			return {
				raceNo: race.raceNo,
				status: "available",
				source: MIKUNI_SOURCE,
				sourceType: "official-venue-score-course-motor-water",
				officialBeforeInfo: mikuniScoreRateGuide.length || officialBeforeInfo?.status === "available"
					? {
							...officialBeforeInfo,
							status: "available",
							source: MIKUNI_SOURCE,
							scoreQuickLook: mikuniScoreRateGuide,
							weatherActual: race?.weatherActual ?? null,
							weatherCondition,
						}
					: null,
				weatherCondition,
				beforeInfo: officialBeforeInfo?.exhibitionRows ?? [],
				startExhibition: officialBeforeInfo?.startExhibition ?? [],
				originalExhibition: [],
				mikuniScoreRateGuide,
				mikuniCourseResults,
				mikuniMotorHistory: motorSummary,
				motorSummary,
				waterSurfaceInfo,
			};
		});

		for (const race of raceExtras) {
			try {
				const raceSource = getRaceList(mikuniVenue).find((item) => item.raceNo === race.raceNo);
				const [courseHtml, originalHtml] = await Promise.all([
					fetchHtml(toMikuniRaceCourseUrl(race.raceNo)),
					fetchHtml(toMikuniksRaceUrl(race.raceNo)),
				]);
				race.mikuniCourseResults = parseMikuniCourseResults(courseHtml, getRaceList(mikuniVenue).find((item) => item.raceNo === race.raceNo));
				race.originalExhibition = createMikuniOriginalExhibitionForRace(raceSource, parseMikuniOriginalExhibition(originalHtml, race.raceNo));
				if (race.originalExhibition.length > 0) {
					race.sourceType = "official-venue-score-course-motor-water+original-exhibition";
				}
			} catch (error) {
				console.warn(`[venue-extras] mikuni ${race.raceNo}R extras failed: ${error.message}`);
			}
			await sleep(REQUEST_INTERVAL_MS);
		}

		const firstRace = raceExtras[0] ?? null;
		console.log(
			`[mikuni extras] before=${firstRace?.beforeInfo?.length ?? 0} start=${firstRace?.startExhibition?.length ?? 0} original=${firstRace?.originalExhibition?.length ?? 0} source=${firstRace?.originalExhibition?.[0]?.source ? "mikuniks" : "none"} motor=${firstRace?.motorSummary?.length ?? 0} scoreRate=${firstRace?.mikuniScoreRateGuide?.length ?? 0} course=${firstRace?.mikuniCourseResults?.length ?? 0} weather=${waterSurfaceInfo ? "ok" : "none"}`,
		);

		return {
			venueCode: String(mikuniVenue.venueCode ?? "10"),
			venueName: MIKUNI_VENUE_NAME,
			source: MIKUNI_SOURCE,
			isAvailable: raceExtras.some((race) =>
				race.mikuniScoreRateGuide.length > 0 ||
				race.mikuniCourseResults.length > 0 ||
				race.motorSummary.length > 0 ||
				Boolean(waterSurfaceInfo)
			),
			status: "available",
			note: "三国公式HPの得点率ランキング、進入コース別選手成績、モーター成績・履歴、水面特性と、公式導線の mikuniks オリジナル展示データを取得",
			waterSurfaceInfo,
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] mikuni failed: ${error.message}`);

		return {
			venueCode: String(mikuniVenue.venueCode ?? "10"),
			venueName: MIKUNI_VENUE_NAME,
			source: MIKUNI_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `三国公式HPの取得に失敗しました: ${error.message}`,
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
	const weatherCondition = normalizeVenueWeatherCondition(weatherActual, {
		source: WAKAMATSU_SOURCE,
		sourceLabel: "Wakamatsu official weather",
	});

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
				weatherCondition,
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
		weatherCondition,
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

function toHamanakoDay(date) {
	return String(date ?? "").replaceAll("-", "");
}

function toHamanakoRaceTabUrl({ date, raceNo, group, kind = 0 }) {
	const params = new URLSearchParams({
		day: toHamanakoDay(date),
		race: String(raceNo),
		kind: String(kind),
		if: "1",
	});
	return `${HAMANAKO_YOSOU_BASE_URL}${group}.php?${params.toString()}`;
}

function getDirectTableRows($, table) {
	const bodyRows = $(table).find("> tbody > tr").toArray();
	return bodyRows.length ? bodyRows : $(table).children("tr").toArray();
}

function splitHamanakoRateCell($, cell) {
	const values = $(cell)
		.find(".s_2rentan")
		.map((_, element) => readCellText($, element))
		.get()
		.filter(Boolean);
	if (values.length >= 2) {
		return values;
	}
	return readCellText($, cell).split(/\s+/).filter(Boolean);
}

function parseHamanakoIdentity($, cell) {
	const className = readCellText($, $(cell).find(".par-ico_kyubetu").first());
	const tobanText = readCellText($, $(cell).find(".com-toban").first());
	const registrationNo = compactText(tobanText.replace(className, "").replace("/", ""));
	const playerName = readCellText($, $(cell).find(".com-rname").first());
	const profile = readCellText($, $(cell).find(".com-subinfo").first());
	const profileParts = profile.split("/").map((part) => compactText(part));
	return {
		className,
		registrationNo,
		registerNo: registrationNo,
		playerName,
		racerName: playerName,
		branch: profileParts[0] ?? "",
		hometown: profileParts[1] ?? "",
		age: profileParts[2] ?? "",
	};
}

function readHamanakoNodeText(node) {
	if (!node) {
		return "";
	}
	if (node.type === "text") {
		return node.data ?? "";
	}
	return Array.isArray(node.children)
		? node.children.map((child) => readHamanakoNodeText(child)).join("")
		: "";
}

function isHamanakoFrameRow(cells, frameIndex = 0) {
	return Boolean(parseFrameNo(readHamanakoNodeText(cells[frameIndex])));
}

function parseHamanakoRacerResults(html) {
	const $ = load(html);
	const table = $("table").first();
	const rows = getDirectTableRows($, table);
	const results = [];

	for (const row of rows) {
		const cells = $(row).children("th,td").toArray();
		if (cells.length < 12 || !isHamanakoFrameRow(cells, 1)) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, cells[1]));
		const identity = parseHamanakoIdentity($, cells[2]);
		const nationalRates = splitHamanakoRateCell($, cells[5]);
		const localRates = splitHamanakoRateCell($, cells[6]);
		const motorRates = splitHamanakoRateCell($, cells[7]);
		const boatRates = splitHamanakoRateCell($, cells[8]);
		const comments = [];
		$(cells[9]).find(".comment-table01 tr").each((_, commentRow) => {
			const commentCells = $(commentRow).children("th,td").toArray();
			const label = readCellText($, commentCells[0]);
			const comment = readCellText($, commentCells[1]);
			if (comment) {
				comments.push(label ? `${label}: ${comment}` : comment);
			}
		});

		results.push({
			frameNo,
			...identity,
			fl: readCellText($, cells[3]),
			averageStart: readCellText($, cells[4]),
			winRate: nationalRates[0] ?? "",
			secondRate: nationalRates[1] ?? "",
			localWinRate: localRates[0] ?? "",
			localSecondRate: localRates[1] ?? "",
			motorNo: motorRates[0] ?? "",
			motorSecondRate: motorRates[1] ?? "",
			boatNo: boatRates[0] ?? "",
			boatSecondRate: boatRates[1] ?? "",
			comment: comments.join(" / "),
			motorEvaluation: [
				readCellText($, cells[10]),
				readCellText($, $(row).nextAll("tr").eq(2).children("td").first()),
				readCellText($, $(row).nextAll("tr").eq(3).children("td").first()),
			].filter(Boolean).join(" / "),
			quickRaceNo: readCellText($, cells[11]),
			source: HAMANAKO_SOURCE,
		});
	}

	return results;
}

function parseHamanakoBeforeInfo(html) {
	const $ = load(html);
	const rows = getDirectTableRows($, $("table").first());
	const beforeRows = [];

	for (let index = 0; index < rows.length; index += 1) {
		const cells = $(rows[index]).children("th,td").toArray();
		if (cells.length < 9 || !isHamanakoFrameRow(cells, 0)) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, cells[0]));
		const identity = parseHamanakoIdentity($, cells[1]);
		const adjustmentCells = $(rows[index + 1]).children("th,td").toArray();
		const weightAdjustment = adjustmentCells.length === 1 ? readCellText($, adjustmentCells[0]) : "";
		beforeRows.push({
			frameNo,
			...identity,
			exhibitionTime: readCellText($, cells[2]),
			weight: readCellText($, cells[3]),
			weightAdjustment,
			adjustment: weightAdjustment,
			tilt: readCellText($, cells[4]),
			previousRaceNo: readCellText($, cells[5]),
			previousRaceCourse: readCellText($, cells[6]),
			previousRaceStartTiming: readCellText($, cells[7]),
			previousRaceFinishOrder: readCellText($, cells[8]),
			partsExchange: readCellText($, cells[9]),
			memo: "",
			source: HAMANAKO_SOURCE,
		});
	}

	return beforeRows;
}

function parseHamanakoStartExhibition(html) {
	const $ = load(html);
	const table = $("table").first();
	const rows = getDirectTableRows($, table);
	const startVisualRows = table.find(".suimen_div").toArray();
	const startRows = [];

	for (const row of rows) {
		const cells = $(row).children("th,td").toArray();
		if (cells.length < 5 || !isHamanakoFrameRow(cells, 1)) {
			continue;
		}

		const course = parseFrameNo(readCellText($, cells[0]));
		const frameNo = parseFrameNo(readCellText($, cells[1]));
		const identity = parseHamanakoIdentity($, cells[2]);
		const visual = startVisualRows[course - 1];
		startRows.push({
			course,
			frameNo,
			...identity,
			currentAverageStart: readCellText($, cells[3]),
			startOrder: readCellText($, cells[4]),
			style: visual ? readCellText($, $(visual).find(".sd_area").first()) : "",
			startTiming: visual ? readCellText($, $(visual).find(".st_area").first()) : "",
			source: HAMANAKO_SOURCE,
		});
	}

	return startRows;
}

function parseHamanakoOriginalExhibition(html) {
	const $ = load(html);
	const rows = getDirectTableRows($, $("table").first());
	const exhibitionRows = [];

	for (const row of rows) {
		const cells = $(row).children("th,td").toArray();
		if (cells.length < 9 || !isHamanakoFrameRow(cells, 0)) {
			continue;
		}

		const identity = parseHamanakoIdentity($, cells[1]);
		exhibitionRows.push({
			frameNo: parseFrameNo(readCellText($, cells[0])),
			...identity,
			weight: readCellText($, cells[2]),
			weightAdjustment: readCellText($, cells[3]),
			adjustment: readCellText($, cells[3]),
			tilt: readCellText($, cells[4]),
			exhibitionTime: readCellText($, cells[5]),
			oneLapTime: readCellText($, cells[6]),
			turnTime: readCellText($, cells[7]),
			straightTime: readCellText($, cells[8]),
			exhibitionEvaluation: "",
			memo: "浜名湖公式オリジナル展示データ",
			source: HAMANAKO_SOURCE,
		});
	}

	return exhibitionRows;
}

function parseHamanakoSeriesResults(html) {
	const $ = load(html);
	const rows = getDirectTableRows($, $("table").first());
	const results = [];

	for (let index = 0; index < rows.length; index += 4) {
		const raceCells = $(rows[index]).children("th,td").toArray();
		if (raceCells.length < 4 || !isHamanakoFrameRow(raceCells, 0)) {
			continue;
		}
		const courseCells = $(rows[index + 1]).children("th,td").toArray();
		const startCells = $(rows[index + 2]).children("th,td").toArray();
		const finishCells = $(rows[index + 3]).children("th,td").toArray();
		results.push({
			frameNo: parseFrameNo(readCellText($, raceCells[0])),
			...parseHamanakoIdentity($, raceCells[1]),
			raceNumbers: raceCells.slice(3, 15).map((cell) => readCellText($, cell)),
			courses: courseCells.slice(1, 13).map((cell) => readCellText($, cell)),
			startTimings: startCells.slice(1, 13).map((cell) => readCellText($, cell)),
			finishOrders: finishCells.slice(1, 13).map((cell) => readCellText($, cell)),
			source: HAMANAKO_SOURCE,
		});
	}

	return results;
}

function parseHamanakoRecent3(html, { local = false } = {}) {
	const $ = load(html);
	const rows = getDirectTableRows($, $("table").first());
	const results = [];

	for (let index = 0; index < rows.length; index += 2) {
		const infoCells = $(rows[index]).children("th,td").toArray();
		if (infoCells.length < 5 || !isHamanakoFrameRow(infoCells, 0)) {
			continue;
		}
		const resultCells = $(rows[index + 1]).children("th,td").toArray();
		const histories = [0, 1, 2].map((historyIndex) => {
			const raw = readCellText($, infoCells[historyIndex + 2]);
			const result = readCellText($, resultCells[historyIndex]);
			return raw || result
				? {
						venueName: local ? HAMANAKO_VENUE_NAME : "",
						grade: raw.match(/^(SG|ＧⅠ|ＧⅡ|ＧⅢ|一般)/)?.[1] ?? "",
						dateRange: raw.match(/\d{2}\/\d{2}\/\d{2}～\d{2}\/\d{2}\/\d{2}/)?.[0] ?? "",
						results: result,
						raw,
					}
				: null;
		}).filter(Boolean);

		results.push({
			frameNo: parseFrameNo(readCellText($, infoCells[0])),
			...parseHamanakoIdentity($, infoCells[1]),
			histories,
			source: HAMANAKO_SOURCE,
		});
	}

	return results;
}

function parseHamanakoNationalRecent3(html) {
	return parseHamanakoRecent3(html, { local: false });
}

function parseHamanakoLocalRecent3(html) {
	return parseHamanakoRecent3(html, { local: true });
}

function parseHamanakoFramePast10(html) {
	const $ = load(html);
	const rows = getDirectTableRows($, $("table").first());
	const results = [];

	for (let index = 0; index < rows.length; index += 2) {
		const courseCells = $(rows[index]).children("th,td").toArray();
		if (courseCells.length < 16 || !isHamanakoFrameRow(courseCells, 0)) {
			continue;
		}
		const finishCells = $(rows[index + 1]).children("th,td").toArray();
		results.push({
			frameNo: parseFrameNo(readCellText($, courseCells[0])),
			...parseHamanakoIdentity($, courseCells[1]),
			courseHistory: courseCells.slice(3, 13).map((cell) => readCellText($, cell)),
			finishHistory: finishCells.slice(1, 11).map((cell) => readCellText($, cell)),
			startTimingHistory: [],
			frameWinRate: readCellText($, courseCells[13]),
			frameAverageStart: readCellText($, courseCells[14]),
			frameStartOrder: readCellText($, courseCells[15]),
			source: HAMANAKO_SOURCE,
		});
	}

	return results;
}

function parseHamanakoScoreRateGuide(html, racerResults = []) {
	const $ = load(html);
	const rows = getDirectTableRows($, $("table").first());
	const resultByFrame = new Map(racerResults.map((row) => [row.frameNo, row]));
	const scoreRows = [];

	for (const row of rows) {
		const cells = $(row).children("th,td").toArray();
		if (cells.length < 11 || !isHamanakoFrameRow(cells, 0)) {
			continue;
		}
		const frameNo = parseFrameNo(readCellText($, cells[0]));
		const entry = resultByFrame.get(frameNo) ?? {};
		scoreRows.push({
			frameNo,
			...parseHamanakoIdentity($, cells[1]),
			averageStart: entry.averageStart ?? "",
			winRate: entry.winRate ?? "",
			secondRate: entry.secondRate ?? "",
			localWinRate: entry.localWinRate ?? "",
			localSecondRate: entry.localSecondRate ?? "",
			motorNo: entry.motorNo ?? "",
			motorSecondRate: entry.motorSecondRate ?? "",
			scoreRate: readCellText($, cells[2]),
			rank: readCellText($, cells[3]),
			firstPlaceScoreRate: readCellText($, cells[4]),
			secondPlaceScoreRate: readCellText($, cells[5]),
			thirdPlaceScoreRate: readCellText($, cells[6]),
			fourthPlaceScoreRate: readCellText($, cells[7]),
			fifthPlaceScoreRate: readCellText($, cells[8]),
			sixthPlaceScoreRate: readCellText($, cells[9]),
			quickRaceNo: readCellText($, cells[10]),
			source: HAMANAKO_SOURCE,
		});
	}

	return scoreRows;
}

function parseHamanakoMotorHistory(html) {
	const $ = load(html);
	const rows = getDirectTableRows($, $("table").first());
	const motorRows = [];

	for (let index = 0; index < rows.length; index += 3) {
		const cells = $(rows[index]).children("th,td").toArray();
		if (cells.length < 10 || !isHamanakoFrameRow(cells, 0)) {
			continue;
		}
		const historyEntries = [];
		const firstHistory = cells.slice(5, 10).map((cell) => readCellText($, cell));
		if (firstHistory.some(Boolean)) {
			historyEntries.push({
				label: firstHistory[0],
				motorGrade: firstHistory[1],
				playerName: firstHistory[2],
				results: firstHistory[3],
				comment: firstHistory[4],
			});
		}
		for (const offset of [1, 2]) {
			const historyCells = $(rows[index + offset]).children("th,td").toArray();
			const values = historyCells.map((cell) => readCellText($, cell));
			if (values.some(Boolean)) {
				historyEntries.push({
					label: values[0] ?? "",
					motorGrade: values[1] ?? "",
					playerName: values[2] ?? "",
					results: values[3] ?? "",
					comment: values[4] ?? "",
				});
			}
		}

		const motorNoAndRate = readCellText($, cells[3]);
		motorRows.push({
			frameNo: parseFrameNo(readCellText($, cells[0])),
			...parseHamanakoIdentity($, cells[1]),
			motorGrade: readCellText($, cells[2]),
			motorNo: motorNoAndRate.slice(0, -4) || motorNoAndRate,
			motorSecondRate: motorNoAndRate.slice(-4),
			comment: historyEntries[0]?.comment ?? "",
			historyEntries,
			source: HAMANAKO_SOURCE,
		});
	}

	return motorRows;
}

function parseHamanakoWaterSurfaceInfo(html) {
	const $ = load(html);
	const text = compactText($("main, body").text());
	return text
		? {
				source: HAMANAKO_SOURCE,
				surfaceFeature: text.slice(0, 600),
			}
		: null;
}

function parseHamanakoWeatherCondition(html) {
	const $ = load(html);
	const table = $("table").eq(1);
	const cells = table.find("tr").last().children("th,td").toArray().map((cell) => readCellText($, cell));
	return cells.some(Boolean)
		? {
				weather: cells[0] ?? "",
				windDirection: cells[1] ?? "",
				windSpeed: cells[2] ?? "",
				waveHeight: cells[3] ?? "",
				temperature: cells[4] ?? "",
				waterTemperature: cells[5] ?? "",
				source: HAMANAKO_SOURCE,
			}
		: null;
}

async function fetchHamanakoVenueExtras({ date, raceNo }) {
	const settled = await Promise.allSettled([
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-syussou", kind: 0 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-syussou", kind: 1 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-syussou", kind: 2 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-syussou", kind: 3 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-syussou", kind: 4 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-syussou", kind: 5 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-cyokuzen", kind: 0 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-cyokuzen", kind: 1 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-cyokuzen", kind: 2 })),
		fetchHamanakoHtml(toHamanakoRaceTabUrl({ date, raceNo, group: "group-yosou", kind: 3 })),
	]);

	const [
		racerHtml,
		seriesHtml,
		nationalHtml,
		localHtml,
		frame10Html,
		scoreHtml,
		beforeHtml,
		startHtml,
		originalHtml,
		motorHtml,
	] = settled.map((result) => result.status === "fulfilled" ? result.value : "");

	const hamanakoRacerResults = parseHamanakoRacerResults(racerHtml);
	const hamanakoSeriesResults = parseHamanakoSeriesResults(seriesHtml);
	const hamanakoNationalRecent3 = parseHamanakoNationalRecent3(nationalHtml);
	const hamanakoLocalRecent3 = parseHamanakoLocalRecent3(localHtml);
	const hamanakoFramePast10 = parseHamanakoFramePast10(frame10Html);
	const hamanakoScoreRateGuide = parseHamanakoScoreRateGuide(scoreHtml, hamanakoRacerResults);
	const hamanakoBeforeInfo = parseHamanakoBeforeInfo(beforeHtml).map((row) => {
		const entry = hamanakoRacerResults.find((item) => item.frameNo === row.frameNo) ?? {};
		return {
			...row,
			motorNo: entry.motorNo ?? "",
			motorSecondRate: entry.motorSecondRate ?? "",
			boatNo: entry.boatNo ?? "",
			boatSecondRate: entry.boatSecondRate ?? "",
		};
	});
	const startExhibition = parseHamanakoStartExhibition(startHtml);
	const originalExhibition = parseHamanakoOriginalExhibition(originalHtml).map((row) => {
		const entry = hamanakoRacerResults.find((item) => item.frameNo === row.frameNo) ?? {};
		return {
			...row,
			motorNo: entry.motorNo ?? "",
			motorSecondRate: entry.motorSecondRate ?? "",
			boatNo: entry.boatNo ?? "",
			boatSecondRate: entry.boatSecondRate ?? "",
		};
	});
	const hamanakoMotorHistory = parseHamanakoMotorHistory(motorHtml);
	const weatherCondition = parseHamanakoWeatherCondition(startHtml);
	const racerComments = hamanakoRacerResults
		.filter((row) => row.comment)
		.map((row) => ({ frameNo: row.frameNo, comment: row.comment, source: HAMANAKO_SOURCE }));
	const motorSummary = hamanakoMotorHistory.length
		? hamanakoMotorHistory
		: hamanakoRacerResults
			.filter((row) => row.motorNo)
			.map((row) => ({
				frameNo: row.frameNo,
				motorNo: row.motorNo,
				motorGrade: row.motorEvaluation,
				comment: row.comment,
				source: HAMANAKO_SOURCE,
			}));
	const officialBeforeInfo = hamanakoBeforeInfo.length || startExhibition.length || hamanakoScoreRateGuide.length
		? {
				status: "available",
				source: HAMANAKO_SOURCE,
				exhibitionRows: hamanakoBeforeInfo,
				startExhibition,
				scoreQuickLook: hamanakoScoreRateGuide,
			}
		: null;
	const hasAny = [
		hamanakoRacerResults,
		hamanakoSeriesResults,
		hamanakoNationalRecent3,
		hamanakoLocalRecent3,
		hamanakoFramePast10,
		hamanakoScoreRateGuide,
		hamanakoBeforeInfo,
		startExhibition,
		originalExhibition,
		hamanakoMotorHistory,
	].some((rows) => rows.length > 0);

	console.log(
		`[venue-extras] hamanako ${raceNo}R: racer ${hamanakoRacerResults.length} / series ${hamanakoSeriesResults.length} / national3 ${hamanakoNationalRecent3.length} / local3 ${hamanakoLocalRecent3.length} / frame10 ${hamanakoFramePast10.length} / score ${hamanakoScoreRateGuide.length} / before ${hamanakoBeforeInfo.length} / start ${startExhibition.length} / exhibition ${originalExhibition.length} / motor ${motorSummary.length}`,
	);

	return {
		raceNo,
		status: hasAny ? "available" : "waiting",
		source: HAMANAKO_SOURCE,
		sourceType: "hamanako-official-extras",
		officialBeforeInfo,
		weatherCondition,
		beforeInfo: hamanakoBeforeInfo,
		hamanakoBeforeInfo,
		startExhibition,
		originalExhibition,
		hamanakoRacerResults,
		racerComments,
		motorSummary,
		hamanakoMotorHistory,
		hamanakoSeriesResults,
		sectionResults: hamanakoSeriesResults,
		hamanakoNationalRecent3,
		nationalRecent3: hamanakoNationalRecent3,
		hamanakoLocalRecent3,
		localRecent3: hamanakoLocalRecent3,
		hamanakoFramePast10,
		frameLast10: hamanakoFramePast10,
		hamanakoScoreRateGuide,
		scoreRateGuide: hamanakoScoreRateGuide,
	};
}

async function buildHamanakoVenueExtras(feed, date) {
	const hamanakoVenue = findVenue(feed, HAMANAKO_VENUE_NAME);

	if (!hamanakoVenue) {
		console.log("[venue-extras] hamanako: not held today");
		return null;
	}

	try {
		const races = getRaceList(hamanakoVenue);
		const waterSurfaceInfo = await fetchHamanakoHtml(HAMANAKO_WATER_SURFACE_URL)
			.then(parseHamanakoWaterSurfaceInfo)
			.catch((error) => {
				console.warn(`[venue-extras] hamanako water surface failed: ${error.message}`);
				return null;
			});
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(await fetchHamanakoVenueExtras({ date, raceNo: race.raceNo }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;
		return {
			venueCode: String(hamanakoVenue.venueCode ?? "06"),
			venueName: HAMANAKO_VENUE_NAME,
			source: HAMANAKO_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-hamanako-data",
			waterSurfaceInfo,
			note: "浜名湖公式の出走表、直前情報、スタート展示、オリジナル展示、節間成績、過去3節、枠番別10走、得点率早見、モーター評価を取得。",
			races: raceExtras.map((race) => ({
				...race,
				waterSurfaceInfo,
			})),
		};
	} catch (error) {
		console.warn(`[venue-extras] hamanako failed: ${error.message}`);
		return {
			venueCode: String(hamanakoVenue.venueCode ?? "06"),
			venueName: HAMANAKO_VENUE_NAME,
			source: HAMANAKO_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `浜名湖公式データの取得に失敗しました: ${error.message}`,
			races: [],
		};
	}
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
		const [tideHtml, waterSurfaceHtml] = await Promise.all([
			fetchHtml(WAKAMATSU_TIDE_URL).catch(() => ""),
			fetchHtml(WAKAMATSU_WATER_SURFACE_URL).catch(() => ""),
		]);
		const tideInfo = tideHtml ? parseWakamatsuTideInfo(tideHtml, date) : null;
		const waterSurfaceInfo = waterSurfaceHtml ? parseWakamatsuWaterSurfaceInfo(waterSurfaceHtml) : null;
		const raceExtras = [];

		for (const race of races) {
			raceExtras.push(await fetchWakamatsuRaceExtra({ date, raceNo: race.raceNo }));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const availableRaceCount = raceExtras.filter((race) => race.status === "available").length;
		console.log(
			`[venue-extras] wakamatsu: ${availableRaceCount}/${raceExtras.length} races${tideInfo ? " + tide" : ""}${waterSurfaceInfo ? " + water surface" : ""}`,
		);

		return {
			venueCode: String(wakamatsuVenue.venueCode ?? "20"),
			venueName: WAKAMATSU_VENUE_NAME,
			source: WAKAMATSU_SOURCE,
			isAvailable: availableRaceCount > 0,
			status: availableRaceCount > 0 ? "available" : "waiting-wakamatsu-data",
			note: "若松公式HPの出走表・直前情報・展示情報・近況成績・モーター履歴を取得",
			tideInfo,
			waterSurfaceInfo,
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

	return rows
		.filter((row) => row.frameNo >= 1 && row.frameNo <= 6)
		.slice(0, 6)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function readMarugameYosoLines(html) {
	const $ = load(html);

	return readCleanLines($("body"))
		.map((line) => compactText(line))
		.filter(Boolean);
}

function isMarugameFrameLine(line) {
	return /^[1-6]$/.test(String(line ?? "").trim());
}

function parseMarugameProfileCell(value) {
	const text = compactText(value);
	const match = text.match(/^([AB]\d)(\d{4})\s+(.+?)\s+(\d+\/.+\/\d+)$/);

	if (!match) {
		return null;
	}

	return {
		className: match[1],
		registerNo: match[2],
		playerName: compactText(match[3]),
		profile: match[4],
	};
}

function parseMarugameYosoBeforeInfo(html) {
	const $ = load(html);
	const rows = [];
	const seenFrames = new Set();

	$("tr").each((_, row) => {
		const cells = $(row)
			.find("th, td")
			.map((__, cell) => compactText($(cell).text()))
			.get()
			.filter(Boolean);
		const frameNo = Number.parseInt(cells[0], 10);
		const profile = parseMarugameProfileCell(cells[1]);

		if (
			!isMarugameFrameLine(cells[0]) ||
			!profile ||
			seenFrames.has(frameNo) ||
			cells.length < 5 ||
			!isMarugameDecimal(cells[2]) ||
			!isMarugameDecimal(cells[3]) ||
			!isMarugameTiltValue(cells[4])
		) {
			return;
		}

		rows.push({
			frameNo,
			playerName: profile.playerName,
			className: profile.className,
			registerNo: profile.registerNo,
			profile: profile.profile,
			exhibitionTime: cells[2],
			weight: cells[3],
			weightAdjustment: "",
			tilt: cells[4],
			partsExchange: "",
			memo: "丸亀公式HP 直前情報から取得",
			source: MARUGAME_SOURCE,
		});
		seenFrames.add(frameNo);

		if (seenFrames.size >= 6) {
			return false;
		}
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseMarugameYosoStartExhibition(html) {
	const $ = load(html);
	const rows = [];

	$("tr").each((_, row) => {
		const cells = $(row)
			.find("th, td")
			.map((__, cell) => compactText($(cell).text()))
			.get()
			.filter(Boolean);
		const course = Number.parseInt(cells[0], 10);
		const frameNo = Number.parseInt(cells[1], 10);
		const profile = parseMarugameProfileCell(cells[2]);

		if (
			course >= 1 &&
			course <= 6 &&
			frameNo >= 1 &&
			frameNo <= 6 &&
			profile &&
			/^\.[0-9]{2}$/.test(cells[3] ?? "") &&
			isMarugameDecimal(cells[4] ?? "")
		) {
			rows.push({
				course,
				frameNo,
				playerName: profile.playerName,
				className: profile.className,
				registerNo: profile.registerNo,
				profile: profile.profile,
				currentAverageStart: cells[3],
				startOrder: cells[4],
				source: MARUGAME_SOURCE,
			});
		}
	});

	const slitText = $("tr")
		.map((_, row) => compactText($(row).text()))
		.get()
		.find((text) => text.includes("スタート展示スリット") && text.includes("ST")) ?? "";
	const timings = slitText.match(/F?\.[0-9]{2}/g) ?? [];
	for (const [timingIndex, timing] of timings.slice(0, 6).entries()) {
		if (rows[timingIndex]) {
			rows[timingIndex].startTiming = timing;
			rows[timingIndex].exhibitionStartTiming = timing;
		}
	}

	return rows.sort((left, right) => left.course - right.course);
}

function parseMarugameRacerComments(html) {
	const $ = load(html);
	const comments = [];

	$("tr").each((_, row) => {
		const cells = $(row)
			.find("th, td")
			.map((__, cell) => compactText($(cell).text()))
			.get()
			.filter(Boolean);
		const frameNo = Number.parseInt(cells[0], 10);
		const profile = parseMarugameProfileCell(cells[1]);
		const comment = cells[2] ?? "";

		if (frameNo >= 1 && frameNo <= 6 && profile && comment && !comment.includes("選手コメント")) {
			comments.push({
				frameNo,
				playerName: profile.playerName,
				className: profile.className,
				registerNo: profile.registerNo,
				profile: profile.profile,
				comment: comment.replace(/\s*(当日|前日)/g, " / $1").replace(/^ \/ /, ""),
				source: MARUGAME_SOURCE,
			});
		}
	});

	return Array.from(new Map(comments.map((row) => [row.frameNo, row])).values())
		.sort((left, right) => left.frameNo - right.frameNo)
		.slice(0, 6);
}

function parseMarugameScoreRateGuide(html) {
	const $ = load(html);
	const rows = [];

	$("tr").each((_, row) => {
		const cells = $(row)
			.find("th, td")
			.map((__, cell) => compactText($(cell).text()))
			.get()
			.filter(Boolean);

		if (cells.length < 8 || !/^\d+$/.test(cells[0]) || !/^\d{4}/.test(cells[1] ?? "")) {
			return;
		}

		const playerMatch = cells[1].match(/^(\d{4})(.+?)\s+([^\s]+)$/);
		if (!playerMatch) {
			return;
		}

		rows.push({
			rank: cells[0],
			registrationNo: playerMatch[1],
			playerName: compactText(playerMatch[2]),
			branch: playerMatch[3],
			className: cells[2] ?? "",
			scoreRate: cells[3] ?? "",
			score: cells[4] ?? "",
			pointTotal: cells[5] ?? "",
			startCount: cells[6] ?? "",
			sectionResults: cells[7] ?? "",
			todayRaces: cells[8] ?? "",
			source: MARUGAME_SOURCE,
		});
	});

	return rows;
}

function parseMarugameWeatherCondition(html) {
	const $ = load(html);
	const rows = $("tr")
		.toArray()
		.map((row) => $(row)
			.find("th, td")
			.map((__, cell) => compactText($(cell).text()))
			.get()
			.filter(Boolean))
		.filter((row) => Array.isArray(row) && row.length > 0);

	const aliases = {
		weather: ["天候"],
		windDirection: ["風向"],
		windSpeed: ["風速"],
		waveHeight: ["波高"],
		pressure: ["気圧"],
		temperature: ["気温"],
		waterTemperature: ["水温"],
		humidity: ["湿度"],
		rainfall: ["雨量"],
		observedAt: ["現在", "更新", "時点"],
	};
	const condition = {};

	for (let index = 0; index < rows.length - 1; index += 1) {
		const headers = rows[index];
		const values = rows[index + 1];
		const hasWeatherHeader = Object.values(aliases).some((labels) =>
			headers.some((cell) => labels.some((label) => cell.includes(label))),
		);

		if (!hasWeatherHeader) {
			continue;
		}

		for (const [field, labels] of Object.entries(aliases)) {
			const headerIndex = headers.findIndex((cell) => labels.some((label) => cell.includes(label)));
			if (headerIndex >= 0 && values[headerIndex]) {
				condition[field] = values[headerIndex];
			}
		}
	}

	const lines = readCleanLines($("body")).map((line) => compactText(line));
	const observedLine = lines.find((line) => /(現在|更新|時点)/.test(line) && line.length <= 40);
	if (!condition.observedAt && observedLine) {
		condition.observedAt = observedLine;
	}

	return normalizeVenueWeatherCondition(condition, {
		source: MARUGAME_SOURCE,
		sourceUrl: MARUGAME_SCORE_RATE_URL,
		sourceLabel: "Marugame official weather",
	});
}

function parseMarugamePrecheckData(html) {
	const $ = load(html);
	const rows = [];

	$("tr").each((_, row) => {
		const cells = $(row)
			.find("th, td")
			.map((__, cell) => compactText($(cell).text()))
			.get()
			.filter(Boolean);

		if (cells.length < 9 || !/^\d+$/.test(cells[0]) || !/^\d{4}$/.test(cells[1])) {
			return;
		}

		rows.push({
			rank: cells[0],
			registrationNo: cells[1],
			playerName: cells[2] ?? "",
			branch: cells[3] ?? "",
			className: cells[4] ?? "",
			motorNo: normalizeMarugameMotorNo(cells[5]),
			motorSecondRate: cells[6] ?? "",
			boatNo: normalizeMarugameMotorNo(cells[7]),
			boatSecondRate: cells[8] ?? "",
			preinspectionTime: cells[9] ?? "",
			source: MARUGAME_SOURCE,
		});
	});

	return rows;
}

async function fetchMarugameRaceExtra({ date, raceNo }) {
	const url = toMarugameYosoUrl(date, raceNo);

	try {
		const html = await fetchHtml(url);
		const beforeInfo = parseMarugameYosoBeforeInfo(html);
		const startExhibition = parseMarugameYosoStartExhibition(html);
		const originalExhibition = parseMarugameOriginalExhibition(html);
		const racerComments = parseMarugameRacerComments(html);

		if (!beforeInfo.length && !startExhibition.length && !originalExhibition.length && !racerComments.length) {
			console.log(`[venue-extras] marugame ${raceNo}R: no yoso rows yet`);
			return {
				raceNo,
				beforeInfo: [],
				startExhibition: [],
				originalExhibition: [],
				racerComments: [],
			};
		}

		console.log(
			`[venue-extras] marugame ${raceNo}R: before ${beforeInfo.length} / start ${startExhibition.length} / original ${originalExhibition.length} / comments ${racerComments.length}`,
		);

		return {
			raceNo,
			beforeInfo,
			startExhibition,
			officialBeforeInfo: {
				status: beforeInfo.length || startExhibition.length ? "available" : "waiting",
				source: MARUGAME_SOURCE,
				exhibitionRows: beforeInfo,
				startExhibition,
				scoreQuickLook: [],
			},
			originalExhibition,
			racerComments,
		};
	} catch (error) {
		console.warn(`[venue-extras] marugame ${raceNo}R yoso failed: ${error.message}`);

		return {
			raceNo,
			beforeInfo: [],
			startExhibition: [],
			originalExhibition: [],
			racerComments: [],
		};
	}
}

function createMarugameRaceMotorSummary(race, motorData, precheckData = []) {
	const racers = Array.isArray(race?.racers) ? race.racers : [];

	return racers
		.map((racer) => {
			const frameNo = Number(racer?.frameNo ?? racer?.frame ?? racer?.boatNumber);
			const registrationNo = String(racer?.registrationNo ?? racer?.racerId ?? "").trim();
			const motorNo = normalizeMarugameMotorNo(racer?.motorNo ?? racer?.motorNumber);
			const motor = motorData.find((item) => item.motorNo === motorNo);
			const precheck = precheckData.find((item) => item.registrationNo === registrationNo || item.motorNo === motorNo);

			if (!frameNo || !motorNo || !motor) {
				return null;
			}

			return {
				frameNo,
				motorNo,
				boatNo: precheck?.boatNo || normalizeMarugameMotorNo(racer?.boatNo ?? racer?.boatEquipmentNo),
				motorSecondRate: motor.twoRate,
				motorWinRate: motor.winRate,
				boatSecondRate: precheck?.boatSecondRate || String(racer?.boatSecondRate ?? racer?.boatTwoRate ?? ""),
				preinspectionTime: precheck?.preinspectionTime || "",
				previousUser: precheck?.playerName ? `${precheck.playerName}（前検）` : `モーター${motor.motorNo}`,
				recentResults: `2連率 ${motor.twoRate}% / 勝率 ${motor.winRate}`,
				motorGrade: normalizeMarugameMotorGrade(motor.twoRate),
				comment: [
					`丸亀公式モーターデータ：1着${motor.firstCount} / 2着${motor.secondCount} / 3着${motor.thirdCount} / 出走${motor.starts} / 優出${motor.finals} / 優勝${motor.championships} / 最高${motor.bestTime}`,
					precheck?.boatNo ? `ボート${precheck.boatNo} 2連率${precheck.boatSecondRate}%` : "",
					precheck?.preinspectionTime ? `前検${precheck.preinspectionTime}` : "",
				].filter(Boolean).join(" / "),
				source: MARUGAME_SOURCE,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function createMarugameRaceScoreRateGuide(race, scoreRateRows) {
	const racers = Array.isArray(race?.racers) ? race.racers : [];

	return racers
		.map((racer) => {
			const frameNo = Number(racer?.frameNo ?? racer?.frame ?? racer?.boatNumber);
			const registrationNo = String(racer?.registrationNo ?? racer?.racerId ?? "").trim();
			const score = scoreRateRows.find((item) => item.registrationNo === registrationNo);

			if (!frameNo || !score) {
				return null;
			}

			return {
				frameNo,
				...score,
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
		const [motorHtml, tideHtml, waterSurfaceHtml, scoreRateHtml, precheckHtml] = await Promise.all([
			fetchHtml(MARUGAME_MOTOR_DATA_URL),
			fetchHtml(MARUGAME_TIDE_URL),
			fetchHtml(MARUGAME_WATER_SURFACE_URL),
			fetchHtml(MARUGAME_SCORE_RATE_URL),
			fetchHtml(MARUGAME_PRECHECK_URL),
		]);

		const motorData = parseMarugameMotorData(motorHtml);
		const scoreRateRows = parseMarugameScoreRateGuide(scoreRateHtml);
		const venueWeatherCondition = parseMarugameWeatherCondition(scoreRateHtml);
		const precheckData = parseMarugamePrecheckData(precheckHtml);
		const tideInfo = parseMarugameTideInfo(tideHtml, date);
		const waterSurfaceInfo = parseMarugameWaterSurfaceInfo(waterSurfaceHtml);
		const races = getRaceList(marugameVenue);
		const raceExtras = [];

		for (const race of races) {
			const motorSummary = createMarugameRaceMotorSummary(race, motorData, precheckData);
			const marugameScoreRateGuide = createMarugameRaceScoreRateGuide(race, scoreRateRows);
			const raceOfficialExtra = await fetchMarugameRaceExtra({
				date,
				raceNo: race.raceNo,
			});

			const beforeInfo = raceOfficialExtra?.beforeInfo ?? [];
			const startExhibition = raceOfficialExtra?.startExhibition ?? [];
			const originalExhibition = (raceOfficialExtra?.originalExhibition ?? []).map((row) => ({
				...row,
				motorNo: motorSummary.find((item) => item.frameNo === row.frameNo)?.motorNo ?? row.motorNo ?? "",
			}));
			const racerComments = raceOfficialExtra?.racerComments ?? [];
			const weatherCondition = mergeVenueWeatherCondition(
				raceOfficialExtra?.officialBeforeInfo?.weatherCondition ?? raceOfficialExtra?.officialBeforeInfo?.weatherActual,
				venueWeatherCondition,
			);
			const scoreQuickLook = marugameScoreRateGuide.map((row) => ({
				frameNo: row.frameNo,
				registrationNo: row.registrationNo,
				playerName: row.playerName,
				className: row.className,
				scoreRate: row.scoreRate,
				score: row.score,
				sectionResults: row.sectionResults,
				source: MARUGAME_SOURCE,
			}));
			const officialBeforeInfo = raceOfficialExtra?.officialBeforeInfo
				? {
					...raceOfficialExtra.officialBeforeInfo,
					scoreQuickLook,
					weatherCondition,
				}
				: null;

			if (
				!beforeInfo.length &&
				!startExhibition.length &&
				!motorSummary.length &&
				!originalExhibition.length &&
				!marugameScoreRateGuide.length &&
				!racerComments.length &&
				!waterSurfaceInfo &&
				!tideInfo
			) {
				continue;
			}

			raceExtras.push({
				raceNo: race.raceNo,
				status: "available",
				source: MARUGAME_SOURCE,
				sourceType: "official-venue-before-start-motor-tide-original-exhibition-score",
				beforeInfo,
				startExhibition,
				officialBeforeInfo,
				weatherCondition,
				originalExhibition,
				motorSummary,
				marugameMotorBoatData: motorSummary,
				scoreRateGuide: marugameScoreRateGuide,
				marugameScoreRateGuide,
				racerComments,
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
			`[marugame extras] before=${raceExtras[0]?.beforeInfo?.length ?? 0} start=${raceExtras[0]?.startExhibition?.length ?? 0} original=${raceExtras[0]?.originalExhibition?.length ?? 0} motor=${raceExtras[0]?.motorSummary?.length ?? 0} scoreRate=${raceExtras[0]?.marugameScoreRateGuide?.length ?? 0} weather=${raceExtras[0]?.weatherCondition ? "ok" : "feed"} tide=${tideInfo ? "ok" : "none"}`,
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
	const bodyText = normalizeNarutoCell($("body").text()).replace(/\s+/g, " ");

	const targetDate = String(date ?? "")
		.replace(/^\d{4}-/, "")
		.replace("-", "/")
		.replace(/^0/, "")
		.replace("/0", "/");

	const targetDateWithZero = String(date ?? "")
		.replace(/^\d{4}-/, "")
		.replace("-", "/");

	const tideTableStart = bodyText.indexOf("日付 潮 干潮 満潮");
	const searchableText = tideTableStart >= 0 ? bodyText.slice(tideTableStart) : bodyText;
	const tideRows = Array.from(searchableText.matchAll(/(\d{1,2}\/\d{1,2})([月火水木金土日])([若中小長大]潮)(\d{1,2}:\d{2})(\d{1,2}:\d{2})/g));
	const bodyMatch = tideRows.find((match) => match[1] === targetDate || match[1] === targetDateWithZero);

	if (bodyMatch) {
		return {
			date: bodyMatch[1],
			dayLabel: bodyMatch[2],
			tideType: bodyMatch[3],
			lowTideTime: bodyMatch[4],
			highTideTime: bodyMatch[5],
			source: NARUTO_SOURCE,
		};
	}

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

function parseNarutoScoreRateGuide(html) {
	const $ = load(html);
	const table = $("table.par-table01").first().get(0) ?? findTableByKeywords($, ["得点率", "順位", "1着", "6着"]);

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

			const frameNo = parseFrameNo(normalizeNarutoCell($(cells[0]).text()));
			if (!frameNo) {
				return;
			}

			const identity = parseNarutoRacerIdentity($, cells[1]);
			rows.push({
				frameNo,
				registrationNo: identity.registerNo,
				playerName: identity.playerName,
				className: identity.className,
				averageStart: "",
				winRate: "",
				secondRate: "",
				localWinRate: "",
				localSecondRate: "",
				motorNo: "",
				motorSecondRate: "",
				scoreRate: normalizeNarutoCell($(cells[2]).text()),
				scoreRank: normalizeNarutoCell($(cells[3]).text()),
				scoreAfterFirst: normalizeNarutoCell($(cells[4]).text()),
				scoreAfterSecond: normalizeNarutoCell($(cells[5]).text()),
				scoreAfterThird: normalizeNarutoCell($(cells[6]).text()),
				scoreAfterFourth: normalizeNarutoCell($(cells[7]).text()),
				scoreAfterFifth: normalizeNarutoCell($(cells[8]).text()),
				scoreAfterSixth: normalizeNarutoCell($(cells[9]).text()),
				scoreBorderMemo: normalizeNarutoCell($(cells[10]).text()),
				source: NARUTO_SOURCE,
			});
		});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseNarutoSectionResults(html) {
	const $ = load(html);
	const table = $("table.par-table01.table1.group").first().get(0) ?? findTableByKeywords($, ["節間成績", "ST", "着"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tbody tr").toArray();

	for (let rowIndex = 0; rowIndex + 3 < trList.length; rowIndex += 4) {
		const firstCells = $(trList[rowIndex]).children("td,th").toArray();
		const secondCells = $(trList[rowIndex + 1]).children("td,th").toArray();
		const thirdCells = $(trList[rowIndex + 2]).children("td,th").toArray();
		const fourthCells = $(trList[rowIndex + 3]).children("td,th").toArray();
		const frameNo = parseFrameNo(normalizeNarutoCell($(firstCells[0]).text()));

		if (!frameNo) {
			continue;
		}

		const raceNumbers = firstCells.slice(3).map((cell) => normalizeNarutoCell($(cell).text())).slice(0, 12);
		const courses = secondCells.slice(1).map((cell) => normalizeNarutoCell($(cell).text())).slice(0, 12);
		const startTimings = thirdCells.slice(1).map((cell) => normalizeNarutoCell($(cell).text())).slice(0, 12);
		const finishOrders = fourthCells.slice(1).map((cell) => normalizeNarutoCell($(cell).text())).slice(0, 12);
		const sectionResults = raceNumbers
			.map((raceNo, index) => ({
				raceNo,
				course: courses[index] ?? "",
				startTiming: startTimings[index] ?? "",
				finishOrder: finishOrders[index] ?? "",
			}))
			.filter((item) => item.raceNo && item.raceNo !== "-")
			.map((item) => `${item.raceNo}R ${item.course && item.course !== "-" ? `${item.course}コース` : ""} ${item.startTiming && item.startTiming !== "-" ? `ST${item.startTiming}` : ""} ${item.finishOrder && item.finishOrder !== "-" ? `${item.finishOrder}着` : ""}`.replace(/\s+/g, " ").trim())
			.join(" / ");

		rows.push({
			frameNo,
			sectionResults,
			source: NARUTO_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseNarutoAbilityIndex(html) {
	const $ = load(html);
	const table = $("table.par-table01.nouryoku").first().get(0) ?? findTableByKeywords($, ["能力指数", "能力値", "枠番相性", "スタート力"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tbody tr").toArray();

	for (let rowIndex = 0; rowIndex + 1 < trList.length; rowIndex += 2) {
		const firstCells = $(trList[rowIndex]).children("td,th").toArray();
		if (firstCells.length < 5) {
			continue;
		}

		const frameNo = parseFrameNo(normalizeNarutoCell($(firstCells[0]).text()));
		if (!frameNo) {
			continue;
		}

		rows.push({
			frameNo,
			abilityValue: normalizeNarutoCell($(firstCells[2]).text()),
			frameCompatibility: normalizeNarutoCell($(firstCells[3]).text()),
			startPower: normalizeNarutoCell($(firstCells[4]).text()),
			source: NARUTO_SOURCE,
		});
	}

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
	const scoreUrl = toNarutoYosouUrl({
		day,
		raceNo,
		type: "tokuhayami",
	});
	const sectionUrl = toNarutoYosouUrlWithKind({
		day,
		raceNo,
		type: "group-syussou",
		kind: 1,
	});
	const abilityUrl = toNarutoYosouUrlWithKind({
		day,
		raceNo,
		type: "group-syussou",
		kind: 3,
	});

	try {
		const settled = await Promise.allSettled([
			fetchHtml(cyokuzenUrl),
			fetchHtml(originalDataUrl),
			fetchNarutoRacerPerformance({ day, raceNo }),
			fetchHtml(scoreUrl),
			fetchHtml(sectionUrl),
			fetchHtml(abilityUrl),
		]);
		const cyokuzenHtml = settled[0]?.status === "fulfilled" ? settled[0].value : "";
		const originalDataHtml = settled[1]?.status === "fulfilled" ? settled[1].value : "";
		const narutoRacerPerformance = settled[2]?.status === "fulfilled"
			? settled[2].value
			: null;
		const scoreHtml = settled[3]?.status === "fulfilled" ? settled[3].value : "";
		const sectionHtml = settled[4]?.status === "fulfilled" ? settled[4].value : "";
		const abilityHtml = settled[5]?.status === "fulfilled" ? settled[5].value : "";

		const originalExhibition = mergeNarutoOriginalExhibitionRows(
			cyokuzenHtml ? parseNarutoOriginalExhibitionBase(cyokuzenHtml) : [],
			originalDataHtml ? parseNarutoOriginalExhibitionTimes(originalDataHtml) : [],
		);
		const abilityIndex = abilityHtml ? parseNarutoAbilityIndex(abilityHtml) : [];
		const sectionResultsByFrame = new Map(
			(sectionHtml ? parseNarutoSectionResults(sectionHtml) : []).map((row) => [row.frameNo, row.sectionResults]),
		);
		const scoreQuickLook = scoreHtml
			? parseNarutoScoreRateGuide(scoreHtml).map((row) => ({
				...row,
				sectionResults: sectionResultsByFrame.get(row.frameNo) ?? "",
			}))
			: [];
		const officialBeforeInfo = scoreQuickLook.length > 0
			? {
				status: "available",
				source: NARUTO_SOURCE,
				scoreQuickLook,
			}
			: null;

		if (!originalExhibition.length && !narutoRacerPerformance && !officialBeforeInfo && !abilityIndex.length) {
			console.log(`[venue-extras] naruto ${raceNo}R: no official rows yet`);
			return {
				raceNo,
				originalExhibition: [],
				narutoRacerPerformance: null,
				officialBeforeInfo: null,
				abilityIndex: [],
			};
		}

		console.log(
			`[venue-extras] naruto ${raceNo}R: ${originalExhibition.length} original rows${narutoRacerPerformance ? " + racer performance" : ""}${officialBeforeInfo ? ` + score ${scoreQuickLook.length}` : ""}${abilityIndex.length ? ` + ability ${abilityIndex.length}` : ""}`,
		);

		return {
			raceNo,
			originalExhibition,
			narutoRacerPerformance,
			officialBeforeInfo,
			abilityIndex,
		};
	} catch (error) {
		console.warn(`[venue-extras] naruto ${raceNo}R official extras failed: ${error.message}`);

		return {
			raceNo,
			originalExhibition: [],
			narutoRacerPerformance: null,
			officialBeforeInfo: null,
			abilityIndex: [],
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
			const officialBeforeInfo = raceOfficialExtra?.officialBeforeInfo ?? null;
			const abilityIndex = raceOfficialExtra?.abilityIndex ?? [];

			if (!motorSummary.length && !originalExhibition.length && !narutoRacerPerformance && !officialBeforeInfo && !abilityIndex.length && !tideInfo && !waterSurfaceInfo) {
				continue;
			}

			raceExtras.push({
				raceNo: race.raceNo,
				status: "available",
				source: NARUTO_SOURCE,
				sourceType: "official-venue-motor-tide-water-cyokuzen",
				officialBeforeInfo,
				abilityIndex,
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

function normalizeTokonameCell(value) {
	return compactText(value).replace(/\s+/g, " ");
}

function readTokonameTableRows(html, tableIndex = 0) {
	if (!html) {
		return [];
	}

	const $ = load(html);
	const table = $("table").eq(tableIndex);
	if (!table.length) {
		return [];
	}

	const rows = [];
	table.find("> tbody > tr, > tr").each((_, row) => {
		const cells = $(row)
			.children("th,td")
			.map((__, cell) => normalizeTokonameCell($(cell).text()))
			.get();
		if (cells.length && cells.some(Boolean)) {
			rows.push(cells);
		}
	});

	return rows;
}

function parseTokonameScoreRateGuide(html) {
	return readTokonameTableRows(html).flatMap((cells) => {
		if (cells.length < 10 || !/^\d+$/.test(cells[2] ?? "")) {
			return [];
		}

		return [{
			scoreRank: cells[0] ?? "",
			className: cells[1] ?? "",
			registrationNo: cells[2] ?? "",
			playerName: cells[3] ?? "",
			branch: cells[4] ?? "",
			scoreRate: cells[5] ?? "",
			score: cells[6] ?? "",
			deduction: cells[7] ?? "",
			starts: cells[8] ?? "",
			sectionResults: cells[9] ?? "",
			raceSchedule: [cells[10], cells[11]].filter(Boolean).join(" / "),
			note: cells[12] ?? "",
			source: TOKONAME_SOURCE,
		}];
	});
}

function parseTokonameTimerank(html) {
	return readTokonameTableRows(html).flatMap((cells) => {
		if (cells.length < 10 || !/^\d+$/.test(cells[1] ?? "")) {
			return [];
		}

		return [{
			rank: cells[0] ?? "",
			registrationNo: cells[1] ?? "",
			playerName: cells[2] ?? "",
			className: cells[3] ?? "",
			branch: cells[4] ?? "",
			motorNo: cells[5] ?? "",
			motorSecondRate: cells[6] ?? "",
			boatNo: cells[7] ?? "",
			boatSecondRate: cells[8] ?? "",
			preinspectionTime: cells[9] ?? "",
			source: TOKONAME_SOURCE,
		}];
	});
}

function parseTokonameMotorData(html) {
	return readTokonameTableRows(html).flatMap((cells) => {
		if (cells.length < 7 || !/^\d+$/.test(cells[2] ?? "")) {
			return [];
		}

		return [{
			rank: cells[0] ?? "",
			previousRank: cells[1] ?? "",
			motorNo: cells[2] ?? "",
			motorSecondRate: cells[3] ?? "",
			motorWinRate: cells[4] ?? "",
			finals: cells[5] ?? "",
			championships: cells[6] ?? "",
			source: TOKONAME_SOURCE,
		}];
	});
}

function parseTokonameBoatData(html) {
	return readTokonameTableRows(html).flatMap((cells) => {
		if (cells.length < 11 || !/^\d+$/.test(cells[0] ?? "")) {
			return [];
		}

		return [{
			boatNo: cells[0] ?? "",
			sets: cells[1] ?? "",
			boatSecondRate: cells[2] ?? "",
			boatWinRate: cells[3] ?? "",
			accidentRate: cells[4] ?? "",
			firstCount: cells[5] ?? "",
			secondCount: cells[6] ?? "",
			thirdCount: cells[7] ?? "",
			starts: cells[8] ?? "",
			finals: cells[9] ?? "",
			championships: cells[10] ?? "",
			source: TOKONAME_SOURCE,
		}];
	});
}

function parseTokonameCourseResults(html) {
	const rows = readTokonameTableRows(html);
	const results = [];
	let currentFrameNo = null;
	let currentPlayerName = "";

	for (const cells of rows) {
		if (cells.length >= 11) {
			const maybeFrameNo = parseFrameNo(cells[0]);
			if (maybeFrameNo && cells[1] && /^\d+$/.test(cells[2] ?? "")) {
				currentFrameNo = maybeFrameNo;
				currentPlayerName = cells[1];
				results.push({
					frameNo: currentFrameNo,
					playerName: currentPlayerName,
					course: cells[2] ?? "",
					entryRate: cells[3] ?? "",
					averageStart: cells[4] ?? "",
					firstRate: cells[5] ?? "",
					secondRate: cells[6] ?? "",
					thirdRate: cells[7] ?? "",
					fourthRate: cells[8] ?? "",
					fifthRate: cells[9] ?? "",
					sixthRate: cells[10] ?? "",
					source: TOKONAME_SOURCE,
				});
				continue;
			}
		}

		if (currentFrameNo && cells.length >= 9 && /^\d+$/.test(cells[0] ?? "")) {
			results.push({
				frameNo: currentFrameNo,
				playerName: currentPlayerName,
				course: cells[0] ?? "",
				entryRate: cells[1] ?? "",
				averageStart: cells[2] ?? "",
				firstRate: cells[3] ?? "",
				secondRate: cells[4] ?? "",
				thirdRate: cells[5] ?? "",
				fourthRate: cells[6] ?? "",
				fifthRate: cells[7] ?? "",
				sixthRate: cells[8] ?? "",
				source: TOKONAME_SOURCE,
			});
		}
	}

	return results;
}

function parseTokonameSectionResults(html) {
	const rows = readTokonameTableRows(html);
	return rows.flatMap((cells) => {
		const frameNo = parseFrameNo(cells[0]);
		if (!frameNo || cells.length < 3) {
			return [];
		}

		return [{
			frameNo,
			playerName: cells[1] ?? "",
			results: cells.slice(2).filter(Boolean),
			sectionResults: cells.slice(2).filter(Boolean).join(" / "),
			source: TOKONAME_SOURCE,
		}];
	});
}

function parseTokonameCurrentYosouContext(html, fallbackDate) {
	const feedDay = compactText(fallbackDate).replaceAll("-", "");
	const topDay = compactText(html?.match(/init_day\s*=\s*["'](\d{8})["']/)?.[1] ?? "");
	const day = feedDay || topDay;
	const hasCyokuzenFrame = String(html ?? "").includes("group-cyokuzen");

	return {
		day,
		hasCyokuzenFrame,
	};
}

function toTokonameOriginalExhibitionUrl(day, raceNo) {
	const params = new URLSearchParams({
		day,
		race: String(Number(raceNo)),
		kind: "2",
		if: "1",
	});
	return `${TOKONAME_YOSOU_BASE_URL}?${params.toString()}`;
}

function parseTokonamePlayerCell($, cell) {
	const classAndRegistration = normalizeTokonameCell($(cell).find(".com-toban").text());
	const [className = "", registrationNo = ""] = classAndRegistration.split("/").map((part) => normalizeTokonameCell(part));
	const playerName = normalizeTokonameCell($(cell).find(".com-rname").text());
	const profileParts = normalizeTokonameCell($(cell).find(".com-subinfo").text()).split("/").map((part) => normalizeTokonameCell(part));

	return {
		className,
		registrationNo,
		playerName,
		branch: profileParts[0] ?? "",
		hometown: profileParts[1] ?? "",
		age: profileParts[2] ?? "",
	};
}

function parseTokonameOriginalExhibition(html, sourceUrl) {
	if (!html) {
		return [];
	}

	const $ = load(html);
	const table = findTableByKeywords($, ["\u30aa\u30ea\u30b8\u30ca\u30eb\u5c55\u793a\u30c7\u30fc\u30bf", "\u4e00\u5468", "\u307e\u308f\u308a\u8db3", "\u76f4\u7dda"])
		?? findTableByKeywords($, ["\u4e00\u5468", "\u307e\u308f\u308a\u8db3", "\u76f4\u7dda"])
		?? $("table").toArray().find((candidate) =>
			$(candidate).find(".col6").length > 0 &&
			$(candidate).find(".col7").length > 0 &&
			$(candidate).find(".col8").length > 0
		);

	if (!table) {
		return [];
	}

	const rows = [];
	$(table).find("tbody tr, tr").each((_, row) => {
		const frameNo = parseFrameNo($(row).children("td.col1, th.col1").first().text());
		if (!frameNo) {
			return;
		}

		const player = parseTokonamePlayerCell($, $(row).children(".col2").first());
		const adjustmentRow = $(row).next("tr");
		const weight = normalizeTokonameCell($(row).children(".col3").first().text());
		const adjustment = normalizeTokonameCell(adjustmentRow.children(".col3").first().text());
		const tilt = normalizeTokonameCell($(row).children(".col4").first().text());
		const exhibitionTime = normalizeTokonameCell($(row).children(".col5").first().text());
		const oneLapTime = normalizeTokonameCell($(row).children(".col6").first().text());
		const turnTime = normalizeTokonameCell($(row).children(".col7").first().text());
		const straightTime = normalizeTokonameCell($(row).children(".col8").first().text());

		rows.push({
			frameNo,
			className: player.className,
			registrationNo: player.registrationNo,
			registerNo: player.registrationNo,
			playerName: player.playerName,
			racerName: player.playerName,
			branch: player.branch,
			hometown: player.hometown,
			age: player.age,
			weight,
			weightAdjustment: adjustment,
			adjustment,
			tilt,
			exhibitionTime,
			oneLapTime,
			lapTime: oneLapTime,
			turnTime,
			straightTime,
			exhibitionEvaluation: "",
			memo: "\u5e38\u6ed1\u516c\u5f0f\u30aa\u30ea\u30b8\u30ca\u30eb\u5c55\u793a\u30c7\u30fc\u30bf",
			note: "\u5e38\u6ed1\u516c\u5f0f\u30aa\u30ea\u30b8\u30ca\u30eb\u5c55\u793a\u30c7\u30fc\u30bf",
			source: sourceUrl,
		});
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseTokonameWaterSurfaceInfo(html) {
	if (!html) {
		return null;
	}

	const $ = load(html);
	const firstTable = readTokonameTableRows(html, 0);
	const courseArrivalRows = readTokonameTableRows(html, 1).flatMap((cells) => {
		if (cells.length < 12 || !/^\d+$/.test(cells[0] ?? "")) {
			return [];
		}

		return [{
			course: cells[0] ?? "",
			firstRate: cells[1] ?? "",
			secondRate: cells[2] ?? "",
			thirdRate: cells[3] ?? "",
			fourthRate: cells[4] ?? "",
			fifthRate: cells[5] ?? "",
			sixthRate: cells[6] ?? "",
			escape: cells[7] ?? "",
			turn: cells[8] ?? "",
			difference: cells[9] ?? "",
			turnDifference: cells[10] ?? "",
			comeFromBehind: cells[11] ?? "",
			benefit: cells[12] ?? "",
		}];
	});
	const frameCourseRows = readTokonameTableRows(html, 2).flatMap((cells) => {
		if (cells.length < 7 || !/^\d+$/.test(cells[0] ?? "")) {
			return [];
		}

		return [{
			frameNo: Number.parseInt(cells[0], 10),
			course1: cells[1] ?? "",
			course2: cells[2] ?? "",
			course3: cells[3] ?? "",
			course4: cells[4] ?? "",
			course5: cells[5] ?? "",
			course6: cells[6] ?? "",
		}];
	});
	const waterQuality = firstTable[1]?.[0] ?? "";
	const waterLevel = firstTable[1]?.[1] ?? "";
	const tiltTrend = firstTable[3]?.[0] ?? "";
	const featureSummary = firstTable[3]?.[1] ?? "";
	const bodyText = normalizeTokonameCell($("body").text());
	const surfaceSummary = [
		waterQuality ? `\u6c34\u8cea: ${waterQuality}` : "",
		waterLevel ? `\u6d41\u308c/\u6c34\u4f4d: ${waterLevel}` : "",
		tiltTrend ? `\u30c1\u30eb\u30c8: ${tiltTrend}` : "",
	].filter(Boolean).join(" / ");
	const courseSummary = [
		courseArrivalRows.length ? "\u30b3\u30fc\u30b9\u5225\u5165\u7740\u7387/\u6c7a\u307e\u308a\u624b\u3042\u308a" : "",
		frameCourseRows.length ? "\u67a0\u756a\u5225\u30b3\u30fc\u30b9\u53d6\u5f97\u7387\u3042\u308a" : "",
		bodyText.includes("\u5b63\u7bc0\u5225\u30b3\u30fc\u30b9\u30c7\u30fc\u30bf") ? "\u5b63\u7bc0\u5225\u30b3\u30fc\u30b9\u30c7\u30fc\u30bf\u3042\u308a" : "",
	].filter(Boolean).join(" / ");

	return {
		surfaceSummary,
		featureSummary,
		courseSummary,
		waterQuality,
		waterLevelChange: waterLevel,
		tiltTrend,
		courseArrivalRates: courseArrivalRows,
		frameCourseRates: frameCourseRows,
		source: TOKONAME_SOURCE,
		sourceUrl: TOKONAME_WATER_SURFACE_URL,
	};
}

function toAshiyaRaceIndexUrl(date) {
	const day = compactText(date).replaceAll("-", "");
	return day ? `${ASHIYA_RACE_INDEX_URL}&targetday=${day}` : ASHIYA_RACE_INDEX_URL;
}

function toAshiyaCourseUrl(raceNo) {
	return `${ASHIYA_COURSE_URL}&race=${Number(raceNo)}`;
}

function toAshiyaMotorHistoryUrl(motorNo) {
	const params = new URLSearchParams({
		page: "index_motor_histdtl",
		motor_no: compactText(motorNo),
		select: "4",
	});
	return `https://www.boatrace-ashiya.com/modules/datafile/?${params.toString()}`;
}

function normalizeAshiyaName(value) {
	return compactText(value).replace(/\s+/g, "");
}

function parseAshiyaRaceIndex(html) {
	const rowsByRaceNo = new Map();
	for (const cells of readTokonameTableRows(html)) {
		const raceNo = Number.parseInt(String(cells[0] ?? "").replace(/[^\d]/g, ""), 10);
		if (!Number.isFinite(raceNo) || raceNo < 1 || raceNo > 12 || cells.length < 7) {
			continue;
		}

		rowsByRaceNo.set(raceNo, cells.slice(1, 7).map((playerName, index) => ({
			frameNo: index + 1,
			playerName: compactText(playerName),
			source: ASHIYA_SOURCE,
		})));
	}

	return rowsByRaceNo;
}

function parseAshiyaTimerank(html) {
	return readTokonameTableRows(html).flatMap((cells) => {
		if (cells.length < 9 || !/^\d+$/.test(cells[1] ?? "")) {
			return [];
		}

		return [{
			rank: cells[0] ?? "",
			registrationNo: cells[1] ?? "",
			playerName: cells[2] ?? "",
			className: cells[3] ?? "",
			motorNo: cells[4] ?? "",
			motorSecondRate: cells[5] ?? "",
			boatNo: cells[6] ?? "",
			boatSecondRate: cells[7] ?? "",
			preinspectionTime: cells[8] ?? "",
			source: ASHIYA_SOURCE,
		}];
	});
}

function parseAshiyaScoreRateGuide(html) {
	return readTokonameTableRows(html).flatMap((cells) => {
		if (cells.length < 9 || !/^\d+$/.test(cells[1] ?? "")) {
			return [];
		}

		return [{
			scoreRank: cells[0] ?? "",
			registrationNo: cells[1] ?? "",
			playerName: cells[2] ?? "",
			className: cells[3] ?? "",
			scoreRate: cells[4] ?? "",
			score: cells[5] ?? "",
			deduction: cells[6] ?? "",
			starts: cells[7] ?? "",
			sectionResults: cells[8] ?? "",
			remarks: cells[9] ?? "",
			source: ASHIYA_SOURCE,
		}];
	});
}

function parseAshiyaRacerComments(html) {
	return readTokonameTableRows(html).flatMap((cells) => {
		if (cells.length < 4 || !/^\d+$/.test(cells[0] ?? "")) {
			return [];
		}

		return [{
			registrationNo: cells[0] ?? "",
			playerName: cells[1] ?? "",
			className: cells[2] ?? "",
			comment: cells[3] ?? "",
			source: ASHIYA_SOURCE,
		}];
	});
}

function parseAshiyaMotorData(html) {
	return readTokonameTableRows(html, 0).flatMap((cells) => {
		if (cells.length < 7 || !/^\d+$/.test(cells[2] ?? "")) {
			return [];
		}

		return [{
			rank: cells[0] ?? "",
			previousRank: cells[1] ?? "",
			motorNo: cells[2] ?? "",
			motorSecondRate: cells[3] ?? "",
			motorWinRate: cells[4] ?? "",
			finals: cells[5] ?? "",
			championships: cells[6] ?? "",
			source: ASHIYA_SOURCE,
		}];
	});
}

function parseAshiyaBoatData(html) {
	return readTokonameTableRows(html).flatMap((cells) => {
		if (cells.length < 12 || !/^\d+$/.test(cells[0] ?? "")) {
			return [];
		}

		return [{
			boatNo: cells[0] ?? "",
			boatSecondRate: cells[1] ?? "",
			boatWinRate: cells[2] ?? "",
			sets: cells[3] ?? "",
			accidentRate: cells[4] ?? "",
			calculationPeriod: cells[5] ?? "",
			firstCount: cells[6] ?? "",
			secondCount: cells[7] ?? "",
			thirdCount: cells[8] ?? "",
			starts: cells[9] ?? "",
			finals: cells[10] ?? "",
			championships: cells[11] ?? "",
			source: ASHIYA_SOURCE,
		}];
	});
}

function parseAshiyaCourseResults(html) {
	const results = [];
	let current = null;

	for (const cells of readTokonameTableRows(html)) {
		if (cells.length >= 11) {
			const frameNo = parseFrameNo(cells[0]);
			if (frameNo && cells[1] && /^\d+$/.test(cells[2] ?? "")) {
				current = {
					frameNo,
					playerName: cells[1] ?? "",
					courseRows: [],
					source: ASHIYA_SOURCE,
				};
				results.push(current);
				current.courseRows.push({
					courseNo: Number.parseInt(cells[2], 10),
					entryRate: cells[3] ?? "",
					averageStart: cells[4] ?? "",
					firstRate: cells[5] ?? "",
					secondRate: cells[6] ?? "",
					thirdRate: cells[7] ?? "",
					fourthRate: cells[8] ?? "",
					fifthRate: cells[9] ?? "",
					sixthRate: cells[10] ?? "",
				});
				continue;
			}
		}

		if (current && cells.length >= 9 && /^\d+$/.test(cells[0] ?? "")) {
			current.courseRows.push({
				courseNo: Number.parseInt(cells[0], 10),
				entryRate: cells[1] ?? "",
				averageStart: cells[2] ?? "",
				firstRate: cells[3] ?? "",
				secondRate: cells[4] ?? "",
				thirdRate: cells[5] ?? "",
				fourthRate: cells[6] ?? "",
				fifthRate: cells[7] ?? "",
				sixthRate: cells[8] ?? "",
			});
		}
	}

	return results;
}

function parseAshiyaMotorHistory(html, motorNo) {
	const rows = [];
	let currentDateLabel = "";
	for (const cells of readTokonameTableRows(html, 0)) {
		const first = cells[0] ?? "";
		const second = cells[1] ?? "";
		const firstIsRace = /\d+R/.test(first);
		const secondIsRace = /\d+R/.test(second);
		if (cells.length < 7 || (!firstIsRace && !secondIsRace)) {
			continue;
		}

		if (!firstIsRace && first && first !== "-") {
			currentDateLabel = first;
		}

		if (first === "-" && second === "-") {
			continue;
		}

		const offset = secondIsRace ? 1 : 0;

		rows.push({
			dateLabel: offset ? currentDateLabel : "",
			raceName: cells[offset] ?? "",
			course: cells[offset + 1] ?? "",
			startTiming: cells[offset + 2] ?? "",
			finishOrder: cells[offset + 3] ?? "",
			windDirection: cells[offset + 4] ?? "",
			windSpeed: cells[offset + 5] ?? "",
			exhibitionTime: cells[offset + 6] ?? "",
			partsExchange: cells[offset + 7] ?? "",
			comment: cells[offset + 8] ?? "",
			motorNo: compactText(motorNo),
			source: ASHIYA_SOURCE,
		});
	}

	return rows.slice(0, 8);
}

function parseAshiyaWaterSurfaceInfo(html) {
	if (!html) {
		return null;
	}

	const firstTable = readTokonameTableRows(html, 0);
	const courseArrivalRows = readTokonameTableRows(html, 1).flatMap((cells) => {
		if (cells.length < 12 || !/^\d+/.test(cells[0] ?? "")) {
			return [];
		}

		return [{
			course: cells[0] ?? "",
			firstRate: cells[1] ?? "",
			secondRate: cells[2] ?? "",
			thirdRate: cells[3] ?? "",
			fourthRate: cells[4] ?? "",
			fifthRate: cells[5] ?? "",
			sixthRate: cells[6] ?? "",
			escape: cells[7] ?? "",
			turn: cells[8] ?? "",
			difference: cells[9] ?? "",
			turnDifference: cells[10] ?? "",
			comeFromBehind: cells[11] ?? "",
			benefit: cells[12] ?? "",
		}];
	});
	const frameCourseRows = readTokonameTableRows(html, 2).flatMap((cells) => {
		if (cells.length < 7 || !/^\d+/.test(cells[0] ?? "")) {
			return [];
		}

		return [{
			frameNo: Number.parseInt(cells[0], 10),
			course1: cells[1] ?? "",
			course2: cells[2] ?? "",
			course3: cells[3] ?? "",
			course4: cells[4] ?? "",
			course5: cells[5] ?? "",
			course6: cells[6] ?? "",
		}];
	});
	const waterQuality = firstTable[0]?.[1] ?? "";
	const waterLevel = firstTable[1]?.[1] ?? "";
	const tiltTrend = firstTable[2]?.[1] ?? "";
	const featureSummary = firstTable[3]?.[1] ?? "";
	const raceFeature = firstTable[4]?.[1] ?? "";
	const surfaceSummary = [
		waterQuality ? `水質: ${waterQuality}` : "",
		waterLevel ? `流れ/水位: ${waterLevel}` : "",
		tiltTrend ? `チルト: ${tiltTrend}` : "",
	].filter(Boolean).join(" / ");
	const courseSummary = [
		courseArrivalRows.length ? "コース別入着率/決まり手あり" : "",
		frameCourseRows.length ? "枠番別コース取得率あり" : "",
	].filter(Boolean).join(" / ");

	return {
		surfaceSummary,
		featureSummary: [featureSummary, raceFeature].filter(Boolean).join(" / "),
		courseSummary,
		waterQuality,
		waterLevelChange: waterLevel,
		tiltTrend,
		courseArrivalRates: courseArrivalRows,
		frameCourseRates: frameCourseRows,
		source: ASHIYA_SOURCE,
		sourceUrl: ASHIYA_WATER_SURFACE_URL,
	};
}

function parseAshiyaCyokuzenBeforeInfo(html, entries) {
	const $ = load(html);
	const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	const table = $(".category-cyokuzen.cyokuzen table").first().get(0) ?? findTableByKeywords($, ["展示タイム", "体重", "チルト", "調整"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tr").toArray();
	for (let index = 0; index < trList.length; index += 1) {
		const cells = $(trList[index]).children("td,th").toArray();
		if (cells.length < 6) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, cells[0]));
		if (!frameNo) {
			continue;
		}

		const entry = entryByFrame.get(frameNo) ?? {};
		const adjustmentCells = $(trList[index + 1] ?? []).children ? $(trList[index + 1]).children("td,th").toArray() : [];
		const adjustment = adjustmentCells.length === 1 ? readCellText($, adjustmentCells[0]) : "";
		rows.push({
			frameNo,
			registrationNo: entry.registrationNo || "",
			playerName: entry.playerName || `枠${frameNo}`,
			className: entry.className || readCellText($, cells[1]),
			exhibitionTime: readCellText($, cells[3]),
			weight: readCellText($, cells[4]),
			tilt: readCellText($, cells[5]),
			weightAdjustment: adjustment,
			adjustment,
			source: ASHIYA_SOURCE,
		});

		if (adjustment) {
			index += 1;
		}
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseAshiyaCyokuzenPreviousRace(html) {
	const $ = load(html);
	const table = $(".category-cyokuzen.zenso table").first().get(0) ?? findTableByKeywords($, ["前走成績", "部品交換"]);

	if (!table) {
		return [];
	}

	const rows = [];
	let pendingFrameNo = null;
	let pendingPartsExchange = "";

	$(table).find("tbody tr").each((_, rowElement) => {
		const cells = $(rowElement).children("td,th").toArray();
		if (!cells.length) {
			return;
		}

		const frameNo = parseFrameNo(readCellText($, cells[0]));
		if (frameNo) {
			pendingFrameNo = frameNo;
			pendingPartsExchange = readCellText($, cells[2]);
			return;
		}

		if (!pendingFrameNo || cells.length < 4) {
			return;
		}

		rows.push({
			frameNo: pendingFrameNo,
			partsExchange: pendingPartsExchange,
			previousRaceNo: readCellText($, cells[0]),
			previousRaceCourse: readCellText($, cells[1]),
			previousRaceStartTiming: readCellText($, cells[2]),
			previousRaceFinishOrder: readCellText($, cells[3]),
			source: ASHIYA_SOURCE,
		});

		pendingFrameNo = null;
		pendingPartsExchange = "";
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseAshiyaCyokuzenStartExhibition(html, entries) {
	const $ = load(html);
	const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	const table = $("table.par-table01.tenji").first().get(0) ?? $(".category-cyokuzen.tenji_content table").first().get(0) ?? findTableByKeywords($, ["今節平均ST", "スタート展示", "スタート順"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const startTimings = $(table).find(".st_area").toArray().map((element) => compactText($(element).text()));
	const trList = $(table).find("tbody tr").toArray();
	for (let index = 0; index < trList.length; index += 2) {
		const mainCells = $(trList[index]).children("td,th").toArray();
		const subCells = $(trList[index + 1]).children("td,th").toArray();
		if (mainCells.length < 3) {
			continue;
		}

		const course = parseFrameNo(readCellText($, mainCells[0]));
		const frameNo = parseFrameNo(readCellText($, mainCells[1]));
		if (!course || !frameNo) {
			continue;
		}

		const entry = entryByFrame.get(frameNo) ?? {};
		rows.push({
			course,
			frameNo,
			playerName: entry.playerName || `枠${frameNo}`,
			className: entry.className || "",
			registerNo: entry.registrationNo || "",
			currentAverageStart: readCellText($, mainCells[2]),
			startTiming: startTimings[course - 1] || "",
			startOrder: subCells.length ? readCellText($, subCells[subCells.length - 1]) : "",
			source: ASHIYA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.course - right.course);
}

function parseAshiyaCyokuzenWeather(html) {
	const $ = load(html);
	const table = $(".category-cyokuzen.tenji_content table").eq(1).get(0) ?? findTableByKeywords($, ["天候", "風向", "風速", "波高", "気温", "水温"]);

	if (!table) {
		return null;
	}

	const cells = $(table).find("tbody tr").first().children("td,th").toArray();
	if (cells.length < 6) {
		return null;
	}

	return normalizeVenueWeatherCondition({
		weather: readCellText($, cells[0]),
		windDirection: readCellText($, cells[1]),
		windDirectionText: readCellText($, cells[1]),
		windSpeed: readCellText($, cells[2]),
		waveHeight: readCellText($, cells[3]),
		temperature: readCellText($, cells[4]),
		airTemperature: readCellText($, cells[4]),
		waterTemperature: readCellText($, cells[5]),
		source: ASHIYA_SOURCE,
		sourceLabel: "芦屋公式 水面気象",
	});
}

function parseAshiyaCyokuzenOriginalExhibition(html, entries) {
	const $ = load(html);
	const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	const table = $(".category-cyokuzen.oriten table").first().get(0) ?? findTableByKeywords($, ["一周", "まわり足", "直線", "調整"]);

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tr").toArray();
	for (let index = 0; index < trList.length; index += 1) {
		const cells = $(trList[index]).children("td,th").toArray();
		if (cells.length < 7) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, cells[0]));
		if (!frameNo) {
			continue;
		}

		const entry = entryByFrame.get(frameNo) ?? {};
		const adjustmentCells = $(trList[index + 1] ?? []).children ? $(trList[index + 1]).children("td,th").toArray() : [];
		const adjustment = adjustmentCells.length === 1 ? readCellText($, adjustmentCells[0]) : "";
		rows.push({
			frameNo,
			registrationNo: entry.registrationNo || "",
			registerNo: entry.registrationNo || "",
			playerName: entry.playerName || `枠${frameNo}`,
			racerName: entry.playerName || `枠${frameNo}`,
			className: entry.className || "",
			weight: readCellText($, cells[1]),
			tilt: readCellText($, cells[2]),
			exhibitionTime: readCellText($, cells[3]),
			oneLapTime: readCellText($, cells[4]),
			lapTime: readCellText($, cells[4]),
			turnTime: readCellText($, cells[5]),
			straightTime: readCellText($, cells[6]),
			weightAdjustment: adjustment,
			adjustment,
			motorNo: entry.motorNo || "",
			exhibitionEvaluation: "",
			memo: "芦屋公式 オリジナル展示データから取得",
			source: ASHIYA_SOURCE,
		});

		if (adjustment) {
			index += 1;
		}
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseAshiyaFrameLast10(html, entries) {
	const $ = load(html);
	const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	const table = $(".category-waku10 table").first().get(0) ?? findTableByKeywords($, ["枠番別データ", "平均ST", "スタート順"]);

	if (!table) {
		return [];
	}

	const rows = [];
	for (const tbody of $(table).find("tbody").toArray()) {
		const trList = $(tbody).find("tr").toArray();
		if (trList.length < 2) {
			continue;
		}

		const firstCells = $(trList[0]).children("td,th").toArray();
		const secondCells = $(trList[1]).children("td,th").toArray();
		if (firstCells.length < 4 || secondCells.length < 10) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, firstCells[0]));
		if (!frameNo) {
			continue;
		}

		const entry = entryByFrame.get(frameNo) ?? {};
		rows.push({
			frameNo,
			registerNo: entry.registrationNo || "",
			registrationNo: entry.registrationNo || "",
			playerName: entry.playerName || `枠${frameNo}`,
			className: entry.className || "",
			profile: "",
			courseHistory: Array.from({ length: 10 }, () => ""),
			finishHistory: secondCells.slice(0, 10).map((cell) => readCellText($, cell)),
			startTimingHistory: Array.from({ length: 10 }, () => ""),
			frameWinRate: readCellText($, firstCells[firstCells.length - 3]),
			frameAverageStart: readCellText($, firstCells[firstCells.length - 2]),
			frameStartOrder: readCellText($, firstCells[firstCells.length - 1]),
			source: ASHIYA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseAshiyaSyussouRacerComments(html, entries) {
	const $ = load(html);
	const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	const table = $("table").toArray().find((element) => {
		const text = compactText($(element).text());
		return text.includes("選手コメント") && text.includes("モーター") && !text.includes("フォーカス");
	});

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tr").toArray();
	for (let index = 0; index < trList.length; index += 1) {
		const cells = $(trList[index]).children("td,th").toArray();
		if (cells.length < 5) {
			continue;
		}

		const frameNo = parseFrameNo(readCellText($, cells[0]));
		if (!frameNo) {
			continue;
		}

		const entry = entryByFrame.get(frameNo) ?? {};
		const secondRowCells = $(trList[index + 1] ?? []).children("td,th").toArray();
		const motorSecondRate = secondRowCells.length === 1 ? readCellText($, secondRowCells[0]) : "";
		rows.push({
			frameNo,
			registrationNo: entry.registrationNo || "",
			playerName: entry.playerName || `枠${frameNo}`,
			className: entry.className || readCellText($, cells[1]),
			motorNo: readCellText($, cells[3]) || entry.motorNo || "",
			motorSecondRate,
			comment: readCellText($, cells[4]),
			source: ASHIYA_SOURCE,
		});

		if (motorSecondRate) {
			index += 1;
		}
	}

	return rows.filter((row) => row.comment).sort((left, right) => left.frameNo - right.frameNo);
}

function parseAshiyaSyussouCourseResults(html, entries) {
	const $ = load(html);
	const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	const table = $("table.table1").first().get(0) ?? $("table").toArray().find((element) => {
		const text = compactText($(element).text());
		return text.includes("初日") && text.includes("進") && text.includes("ST") && text.includes("着");
	});

	if (!table) {
		return [];
	}

	const rows = [];
	const trList = $(table).find("tr").toArray();
	for (let index = 1; index < trList.length; index += 4) {
		const raceCells = $(trList[index]).children("td,th").toArray().map((cell) => readCellText($, cell));
		const courseCells = $(trList[index + 1] ?? []).children("td,th").toArray().map((cell) => readCellText($, cell));
		const startCells = $(trList[index + 2] ?? []).children("td,th").toArray().map((cell) => readCellText($, cell));
		const finishCells = $(trList[index + 3] ?? []).children("td,th").toArray().map((cell) => readCellText($, cell));
		const frameNo = parseFrameNo(raceCells[0]);
		if (!frameNo) {
			continue;
		}

		const entry = entryByFrame.get(frameNo) ?? {};
		const raceHistory = raceCells.slice(2).filter(Boolean);
		const courseHistory = courseCells.slice(1).filter(Boolean);
		const startTimingHistory = startCells.slice(1).filter(Boolean);
		const finishHistory = finishCells.slice(1).filter(Boolean);
		rows.push({
			frameNo,
			registrationNo: entry.registrationNo || "",
			playerName: entry.playerName || `枠${frameNo}`,
			className: entry.className || "",
			raceHistory: raceHistory.slice(-10),
			courseHistory: courseHistory.slice(-10),
			startTimingHistory: startTimingHistory.slice(-10),
			finishHistory: finishHistory.slice(-10),
			averageStart: entry.averageStart || "",
			source: ASHIYA_SOURCE,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getAshiyaFeedEntries(race) {
	return (Array.isArray(race?.racers) ? race.racers : []).map((racer) => ({
		frameNo: Number(racer.frameNo ?? racer.frame ?? racer.boatNumber),
		registrationNo: compactText(racer.registrationNo ?? racer.racerId),
		playerName: compactText(racer.playerName ?? racer.name ?? racer.boatRacerName),
		className: compactText(racer.class ?? racer.grade ?? racer.className),
		averageStart: compactText(racer.averageStart ?? racer.avgSt ?? racer.st),
		winRate: compactText(racer.winRate ?? racer.winningRate),
		secondRate: compactText(racer.secondRate ?? racer.twoRate),
		localWinRate: compactText(racer.localWinRate),
		localSecondRate: compactText(racer.localSecondRate),
		motorNo: compactText(racer.motorNo ?? racer.motorNumber),
		motorSecondRate: compactText(racer.motorSecondRate ?? racer.motorTwoRate),
		boatNo: compactText(racer.boatNo ?? racer.boatMotorNo ?? racer.boatEquipmentNo),
		boatSecondRate: compactText(racer.boatSecondRate ?? racer.boatTwoRate),
	})).filter((entry) => entry.frameNo >= 1 && entry.frameNo <= 6);
}

function createAshiyaRaceEntries(race, raceIndexRows, timerankRows) {
	const feedByFrame = new Map(getAshiyaFeedEntries(race).map((entry) => [entry.frameNo, entry]));
	const timerankByName = new Map(timerankRows.map((row) => [normalizeAshiyaName(row.playerName), row]));

	return Array.from({ length: 6 }, (_, index) => {
		const frameNo = index + 1;
		const raceIndexRow = (raceIndexRows ?? []).find((row) => row.frameNo === frameNo) ?? {};
		const feedRow = feedByFrame.get(frameNo) ?? {};
		const playerName = compactText(raceIndexRow.playerName ?? feedRow.playerName);
		const timerank = timerankByName.get(normalizeAshiyaName(playerName)) ?? {};

		return {
			frameNo,
			registrationNo: timerank.registrationNo || feedRow.registrationNo || "",
			playerName,
			className: timerank.className || feedRow.className || "",
			averageStart: feedRow.averageStart || "",
			winRate: feedRow.winRate || "",
			secondRate: feedRow.secondRate || "",
			localWinRate: feedRow.localWinRate || "",
			localSecondRate: feedRow.localSecondRate || "",
			motorNo: timerank.motorNo || feedRow.motorNo || "",
			motorSecondRate: timerank.motorSecondRate || feedRow.motorSecondRate || "",
			boatNo: timerank.boatNo || feedRow.boatNo || "",
			boatSecondRate: timerank.boatSecondRate || feedRow.boatSecondRate || "",
			preinspectionTime: timerank.preinspectionTime || "",
		};
	}).filter((entry) => entry.playerName || entry.registrationNo);
}

function createAshiyaBeforeInfo(race, entries) {
	const byFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	return buildOfficialBeforeInfoExhibitionRows(race).map((row) => {
		const entry = byFrame.get(row.frameNo) ?? {};
		return {
			...row,
			playerName: entry.playerName || row.playerName,
			registrationNo: entry.registrationNo || "",
			className: entry.className || "",
			motorNo: entry.motorNo || "",
			boatNo: entry.boatNo || "",
			source: `${BOATRACE_OFFICIAL_SOURCE}+${ASHIYA_SOURCE}`,
		};
	});
}

function createAshiyaStartExhibition(race, beforeInfo) {
	return buildOfficialBeforeInfoStartExhibitionRows(race, beforeInfo).map((row) => {
		const beforeRow = beforeInfo.find((item) => item.frameNo === row.frameNo) ?? {};
		return {
			...row,
			playerName: beforeRow.playerName || "",
			className: beforeRow.className || "",
			registerNo: beforeRow.registrationNo || "",
			exhibitionTime: beforeRow.exhibitionTime || "",
			source: `${BOATRACE_OFFICIAL_SOURCE}+${ASHIYA_SOURCE}`,
		};
	});
}

function createAshiyaScoreRows(entries, scoreRows) {
	const scoreByRegistration = new Map(scoreRows.map((row) => [row.registrationNo, row]));
	const scoreByName = new Map(scoreRows.map((row) => [normalizeAshiyaName(row.playerName), row]));
	return entries.map((entry) => {
		const score = scoreByRegistration.get(entry.registrationNo) ?? scoreByName.get(normalizeAshiyaName(entry.playerName)) ?? {};
		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo || score.registrationNo || "",
			playerName: entry.playerName || score.playerName || "",
			className: entry.className || score.className || "",
			averageStart: entry.averageStart,
			winRate: entry.winRate,
			secondRate: entry.secondRate,
			localWinRate: entry.localWinRate,
			localSecondRate: entry.localSecondRate,
			motorNo: entry.motorNo,
			motorSecondRate: entry.motorSecondRate,
			scoreRank: score.scoreRank || "",
			scoreRate: score.scoreRate || "",
			score: score.score || "",
			deduction: score.deduction || "",
			starts: score.starts || "",
			sectionResults: score.sectionResults || "",
			remarks: score.remarks || "",
			source: score.source || ASHIYA_SOURCE,
		};
	});
}

function createAshiyaMotorSummary(entries, motorRows, boatRows, motorHistoryByNo) {
	const motorByNo = new Map(motorRows.map((row) => [row.motorNo, row]));
	const boatByNo = new Map(boatRows.map((row) => [row.boatNo, row]));

	return entries.map((entry) => {
		const motor = motorByNo.get(entry.motorNo) ?? {};
		const boat = boatByNo.get(entry.boatNo) ?? {};
		const historyEntries = motorHistoryByNo.get(entry.motorNo) ?? [];
		const comment = [
			`モーター2連率 ${motor.motorSecondRate || entry.motorSecondRate || "-"}`,
			`モーター勝率 ${motor.motorWinRate || "-"}`,
			`ボート ${entry.boatNo || "-"} / 2連率 ${boat.boatSecondRate || entry.boatSecondRate || "-"}`,
			entry.preinspectionTime ? `前検 ${entry.preinspectionTime}` : "",
			motor.finals ? `優出 ${motor.finals}` : "",
			motor.championships ? `優勝 ${motor.championships}` : "",
			historyEntries.length ? "使用履歴あり" : "",
		].filter(Boolean).join(" / ");

		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo,
			playerName: entry.playerName,
			className: entry.className,
			motorNo: entry.motorNo,
			motorSecondRate: motor.motorSecondRate || entry.motorSecondRate || "",
			motorWinRate: motor.motorWinRate || "",
			boatNo: entry.boatNo,
			boatSecondRate: boat.boatSecondRate || entry.boatSecondRate || "",
			boatWinRate: boat.boatWinRate || "",
			preinspectionTime: entry.preinspectionTime,
			finals: motor.finals || "",
			championships: motor.championships || "",
			starts: boat.starts || "",
			currentUser: entry.playerName,
			previousUser: historyEntries[0]?.comment || "",
			recentResults: historyEntries.slice(0, 3).map((item) =>
				[item.dateLabel, item.raceName, item.finishOrder ? `${item.finishOrder}着` : "", item.exhibitionTime ? `展示${item.exhibitionTime}` : ""]
					.filter(Boolean)
					.join(" ")
			).filter(Boolean).join(" / "),
			historyEntries,
			comment,
			source: ASHIYA_SOURCE,
		};
	});
}

function createAshiyaOriginalExhibition(entries, beforeInfo) {
	const beforeByFrame = new Map(beforeInfo.map((row) => [row.frameNo, row]));
	return entries.map((entry) => {
		const before = beforeByFrame.get(entry.frameNo) ?? {};
		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo,
			registerNo: entry.registrationNo,
			playerName: entry.playerName,
			racerName: entry.playerName,
			className: entry.className,
			weight: before.weight || "",
			weightAdjustment: before.weightAdjustment || before.adjustment || "",
			adjustment: before.adjustment || before.weightAdjustment || "",
			tilt: before.tilt || "",
			exhibitionTime: before.exhibitionTime || "",
			motorNo: entry.motorNo,
			oneLapTime: "",
			lapTime: "",
			turnTime: "",
			straightTime: "",
			exhibitionEvaluation: "",
			memo: "芦屋公式HTMLでは一周/まわり足/直線の安定掲載を確認できないため未取得",
			source: `${BOATRACE_OFFICIAL_SOURCE}+${ASHIYA_SOURCE}`,
		};
	}).filter((row) => row.exhibitionTime || row.tilt || row.motorNo);
}

async function createAshiyaVenue(feed, date) {
	const ashiyaVenue = findVenue(feed, ASHIYA_VENUE_NAME);
	if (!ashiyaVenue) {
		console.log("[venue-extras] ashiya: not held today");
		return null;
	}

	try {
		const ashiyaSpBootstrap = await fetchAshiyaHtml("https://www.boatrace-ashiya.com/sp/index.php?page=yosou-yosou").catch(() => ({ text: "", cookie: "" }));
		const ashiyaCookie = ashiyaSpBootstrap.cookie;
		const [
			raceIndexHtml,
			timerankHtml,
			scoreHtml,
			commentsHtml,
			motorHtml,
			boatHtml,
			waterHtml,
		] = await Promise.all([
			fetchHtml(toAshiyaRaceIndexUrl(date)).catch(() => ""),
			fetchHtml(ASHIYA_TIMERANK_URL).catch(() => ""),
			fetchHtml(ASHIYA_SCORE_RATE_URL).catch(() => ""),
			fetchHtml(ASHIYA_RACER_COMMENTS_URL).catch(() => ""),
			fetchHtml(ASHIYA_MOTOR_DATA_URL).catch(() => ""),
			fetchHtml(ASHIYA_BOAT_DATA_URL).catch(() => ""),
			fetchHtml(ASHIYA_WATER_SURFACE_URL).catch(() => ""),
		]);
		const raceIndexByRaceNo = parseAshiyaRaceIndex(raceIndexHtml);
		const timerankRows = parseAshiyaTimerank(timerankHtml);
		const scoreRows = parseAshiyaScoreRateGuide(scoreHtml);
		const commentRows = parseAshiyaRacerComments(commentsHtml);
		const motorRows = parseAshiyaMotorData(motorHtml);
		const boatRows = parseAshiyaBoatData(boatHtml);
		const waterSurfaceInfo = parseAshiyaWaterSurfaceInfo(waterHtml);
		const races = getRaceList(ashiyaVenue);
		const courseRowsByRaceNo = new Map();
		const cyokuzenByRaceNo = new Map();
		const waku10ByRaceNo = new Map();
		const syussouByRaceNo = new Map();
		for (const race of races) {
			const raceNo = Number(race.raceNo);
			const [courseHtml, cyokuzenHtml, waku10Html, syussouHtml] = await Promise.all([
				fetchHtml(toAshiyaCourseUrl(raceNo)).catch(() => ""),
				fetchAshiyaHtml(toAshiyaRaceTabUrl({ date, raceNo, req: "cyokuzen", run: 0 }), { cookie: ashiyaCookie }).then((result) => result.text).catch(() => ""),
				fetchAshiyaHtml(toAshiyaRaceTabUrl({ date, raceNo, req: "waku10", run: 0 }), { cookie: ashiyaCookie }).then((result) => result.text).catch(() => ""),
				fetchAshiyaHtml(toAshiyaRaceTabUrl({ date, raceNo, req: "syussou", run: 0 }), { cookie: ashiyaCookie }).then((result) => result.text).catch(() => ""),
			]);
			courseRowsByRaceNo.set(raceNo, parseAshiyaCourseResults(courseHtml));
			cyokuzenByRaceNo.set(raceNo, cyokuzenHtml);
			waku10ByRaceNo.set(raceNo, waku10Html);
			syussouByRaceNo.set(raceNo, syussouHtml);
			await sleep(REQUEST_INTERVAL_MS);
		}

		const motorNos = new Set(timerankRows.map((row) => row.motorNo).filter(Boolean));
		const motorHistoryByNo = new Map();
		for (const motorNo of motorNos) {
			const historyHtml = await fetchHtml(toAshiyaMotorHistoryUrl(motorNo)).catch(() => "");
			motorHistoryByNo.set(motorNo, parseAshiyaMotorHistory(historyHtml, motorNo));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const commentByRegistration = new Map(commentRows.map((row) => [row.registrationNo, row]));
		const commentByName = new Map(commentRows.map((row) => [normalizeAshiyaName(row.playerName), row]));
		const raceExtras = races.map((race) => {
			const raceNo = Number(race.raceNo);
			const entries = createAshiyaRaceEntries(race, raceIndexByRaceNo.get(raceNo) ?? [], timerankRows);
			const cyokuzenHtml = cyokuzenByRaceNo.get(raceNo) ?? "";
			const waku10Html = waku10ByRaceNo.get(raceNo) ?? "";
			const syussouHtml = syussouByRaceNo.get(raceNo) ?? "";
			const cyokuzenBeforeRows = parseAshiyaCyokuzenBeforeInfo(cyokuzenHtml, entries);
			const previousRaceRows = parseAshiyaCyokuzenPreviousRace(cyokuzenHtml);
			const cyokuzenBeforeByFrame = new Map(cyokuzenBeforeRows.map((row) => [row.frameNo, row]));
			const previousRaceByFrame = new Map(previousRaceRows.map((row) => [row.frameNo, row]));
			const beforeInfo = createAshiyaBeforeInfo(race, entries).map((row) => ({
				...row,
				weight: cyokuzenBeforeByFrame.get(row.frameNo)?.weight || row.weight || "",
				weightAdjustment: cyokuzenBeforeByFrame.get(row.frameNo)?.weightAdjustment || row.weightAdjustment || "",
				adjustment: cyokuzenBeforeByFrame.get(row.frameNo)?.adjustment || row.adjustment || row.weightAdjustment || "",
				partsExchange: previousRaceByFrame.get(row.frameNo)?.partsExchange || row.partsExchange || "",
				memo: previousRaceByFrame.get(row.frameNo)
					? [
						previousRaceByFrame.get(row.frameNo)?.previousRaceNo ? `前走 ${previousRaceByFrame.get(row.frameNo)?.previousRaceNo}R` : "",
						previousRaceByFrame.get(row.frameNo)?.previousRaceCourse ? `コース ${previousRaceByFrame.get(row.frameNo)?.previousRaceCourse}` : "",
						previousRaceByFrame.get(row.frameNo)?.previousRaceStartTiming ? `ST ${previousRaceByFrame.get(row.frameNo)?.previousRaceStartTiming}` : "",
						previousRaceByFrame.get(row.frameNo)?.previousRaceFinishOrder ? `${previousRaceByFrame.get(row.frameNo)?.previousRaceFinishOrder}着` : "",
					].filter(Boolean).join(" / ")
					: row.memo || "",
			}));
			const parsedStartExhibition = parseAshiyaCyokuzenStartExhibition(cyokuzenHtml, entries);
			const startExhibition = parsedStartExhibition.length ? parsedStartExhibition : createAshiyaStartExhibition(race, beforeInfo);
			const scoreQuickLook = createAshiyaScoreRows(entries, scoreRows);
			const motorSummary = createAshiyaMotorSummary(entries, motorRows, boatRows, motorHistoryByNo);
			const parsedOriginalExhibition = parseAshiyaCyokuzenOriginalExhibition(cyokuzenHtml, entries);
			const originalExhibition = parsedOriginalExhibition.length ? parsedOriginalExhibition : createAshiyaOriginalExhibition(entries, beforeInfo);
			const ashiyaFrameLast10 = parseAshiyaFrameLast10(waku10Html, entries);
			const parsedAshiyaCourseResults = (courseRowsByRaceNo.get(raceNo) ?? []).map((row) => {
				const entry = entries.find((item) => item.frameNo === row.frameNo) ?? {};
				return {
					...row,
					registrationNo: entry.registrationNo || "",
					className: entry.className || "",
					playerName: entry.playerName || row.playerName,
				};
			});
			const syussouCourseResults = parseAshiyaSyussouCourseResults(syussouHtml, entries);
			const ashiyaCourseResults = parsedAshiyaCourseResults.length ? parsedAshiyaCourseResults : syussouCourseResults;
			const syussouRacerComments = parseAshiyaSyussouRacerComments(syussouHtml, entries);
			const parsedRacerComments = entries.flatMap((entry) => {
				const comment = commentByRegistration.get(entry.registrationNo) ?? commentByName.get(normalizeAshiyaName(entry.playerName));
				return comment?.comment ? [{
					frameNo: entry.frameNo,
					registrationNo: entry.registrationNo || comment.registrationNo || "",
					playerName: entry.playerName || comment.playerName || "",
					comment: comment.comment,
					source: ASHIYA_SOURCE,
				}] : [];
			});
			const racerComments = parsedRacerComments.length ? parsedRacerComments : syussouRacerComments;
			const weatherCondition = normalizeVenueWeatherCondition(parseAshiyaCyokuzenWeather(cyokuzenHtml) ?? race?.weatherActual ?? ashiyaVenue?.weatherActual ?? null, {
				source: BOATRACE_OFFICIAL_SOURCE,
			});

			return {
				raceNo: race.raceNo,
				status: scoreQuickLook.length || motorSummary.length || ashiyaCourseResults.length || ashiyaFrameLast10.length || waterSurfaceInfo ? "available" : "waiting-ashiya-data",
				source: ASHIYA_SOURCE,
				sourceType: "ashiya-official-extras",
				officialBeforeInfo: {
					status: beforeInfo.length || startExhibition.length || scoreQuickLook.length ? "available" : "waiting",
					source: `${BOATRACE_OFFICIAL_SOURCE}+${ASHIYA_SOURCE}`,
					exhibitionRows: beforeInfo,
					startExhibition,
					scoreQuickLook,
					weatherActual: weatherCondition,
					weatherCondition,
				},
				beforeInfo,
				startExhibition,
				originalExhibition,
				motorSummary,
				scoreRateGuide: scoreQuickLook,
				ashiyaScoreRateGuide: scoreQuickLook,
				ashiyaSectionResults: scoreQuickLook,
				ashiyaCourseResults,
				ashiyaMotorData: motorSummary,
				ashiyaBoatData: motorSummary,
				ashiyaMotorHistory: motorSummary,
				ashiyaFrameLast10,
				racerComments,
				waterSurfaceInfo,
				weatherCondition,
			};
		});
		const firstRace = raceExtras[0] ?? null;
		console.log(
			`[ashiya extras] before=${firstRace?.beforeInfo?.length ?? 0} start=${firstRace?.startExhibition?.length ?? 0} original=${firstRace?.originalExhibition?.length ?? 0} motor=${firstRace?.motorSummary?.length ?? 0} boat=${firstRace?.ashiyaBoatData?.length ?? 0} score=${firstRace?.ashiyaScoreRateGuide?.length ?? 0} frame10=${firstRace?.ashiyaFrameLast10?.length ?? 0} course=${firstRace?.ashiyaCourseResults?.length ? "ok" : "none"} comments=${firstRace?.racerComments?.length ?? 0} water=${waterSurfaceInfo ? "ok" : "none"} weather=${firstRace?.weatherCondition ? "ok" : "none"}`,
		);

		return {
			venueCode: String(ashiyaVenue.venueCode ?? "21"),
			venueName: ASHIYA_VENUE_NAME,
			source: ASHIYA_SOURCE,
			isAvailable: raceExtras.some((race) => race.status === "available"),
			status: raceExtras.some((race) => race.status === "available") ? "available" : "waiting-ashiya-data",
			note: "芦屋公式SP/PC HTMLから直前情報、オリジナル展示、枠番別10走、得点率、進入コース別、選手コメント、モーター/ボート/水面特性を取得。",
			waterSurfaceInfo,
			ashiyaWaterSurfaceInfo: waterSurfaceInfo,
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] ashiya failed: ${error.message}`);
		return {
			venueCode: String(ashiyaVenue.venueCode ?? "21"),
			venueName: ASHIYA_VENUE_NAME,
			source: ASHIYA_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `Ashiya official extras fetch failed: ${error.message}`,
			races: [],
		};
	}
}

function parseKiryuProfile(value) {
	const text = compactText(value);
	const registrationMatch = text.match(/^(\d{4})/);
	const registrationNo = registrationMatch?.[1] ?? "";
	const rest = registrationNo ? text.slice(registrationNo.length).trim() : text;
	const classMatch = rest.match(/([AB]\d)\//);
	const className = classMatch?.[1] ?? "";
	const playerName = classMatch ? rest.slice(0, classMatch.index).trim() : rest;
	const profile = classMatch ? rest.slice(classMatch.index ?? 0).trim() : "";

	return {
		registrationNo,
		registerNo: registrationNo,
		playerName,
		className,
		profile,
	};
}

function parseKiryuYosouHeader(html) {
	const $ = load(html);
	const text = compactText($("body").text());
	const match = text.match(/(\d+)R\s+([^\s]+)\s+締切時刻\s*([0-9:]+)/);
	return {
		raceNo: match?.[1] ?? "",
		raceTitle: match?.[2] ?? "",
		deadline: match?.[3] ?? "",
	};
}

function parseKiryuCyokuzen(html) {
	const $ = load(html);
	const beforeInfo = [];
	const originalExhibition = [];

	$("table.cyokuzen tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		const frameNo = parseFrameNo(cells[0]);
		if (!frameNo || !cells[1]) {
			return;
		}

		const profile = parseKiryuProfile(cells[1]);
		const partsExchange = cells.find((value) => /リング|ピストン|電気|キャブ|シリンダ|シャフト|ペラ|ギヤ|キャリボ/.test(value)) ?? "";
		const weight = cells[2] ?? "";
		const tilt = cells[3] ?? "";
		const exhibitionTime = cells[4] ?? "";
		const halfLapTime = cells[5] ?? "";
		const turnTime = cells[6] ?? "";
		const straightTime = cells[7] ?? "";

		beforeInfo.push({
			frameNo,
			registrationNo: profile.registrationNo,
			registerNo: profile.registrationNo,
			playerName: profile.playerName,
			racerName: profile.playerName,
			className: profile.className,
			weight,
			weightAdjustment: "",
			adjustment: "",
			tilt,
			exhibitionTime,
			partsExchange,
			memo: partsExchange ? `部品交換: ${partsExchange}` : "",
			source: KIRYU_SOURCE,
		});

		originalExhibition.push({
			frameNo,
			registrationNo: profile.registrationNo,
			registerNo: profile.registrationNo,
			playerName: profile.playerName,
			racerName: profile.playerName,
			className: profile.className,
			weight,
			weightAdjustment: "",
			adjustment: "",
			tilt,
			exhibitionTime,
			halfLapTime,
			turnTime,
			straightTime,
			partsExchange,
			memo: halfLapTime ? "桐生公式独自計測: 半周 / まわり足 / 直線" : "",
			source: KIRYU_SOURCE,
		});
	});

	const startExhibition = [];
	$("table.start.table_01 tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		const frameNo = parseFrameNo(cells[0]);
		if (!frameNo || !cells[1]) {
			return;
		}

		const profile = parseKiryuProfile(cells[1]);
		const startTiming = cells.find((value) => /^F?\.\d+/.test(value)) ?? "";
		const course = readRaceFrameNo(cells[2]) ?? frameNo;
		const style = cells.find((value, index) => index >= 3 && /^[SD]$/.test(value)) ?? "";
		startExhibition.push({
			course,
			frameNo,
			playerName: profile.playerName,
			className: profile.className,
			registerNo: profile.registrationNo,
			registrationNo: profile.registrationNo,
			currentAverageStart: "",
			style,
			startTiming,
			startOrder: "",
			source: KIRYU_SOURCE,
		});
	});

	const weatherEntries = new Map();
	$("table.start.table_02 tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		if (cells[0] && cells[1]) {
			weatherEntries.set(cells[0], cells[1]);
		}
	});
	const weatherHeader = readCellText($, $("table.start.table_01 th").filter((_, cell) => /水面気象状況/.test($(cell).text())).first());
	const displayTime = weatherHeader.match(/(\d{1,2}:\d{2})/)?.[1] ?? "";
	const weatherCondition = normalizeVenueWeatherCondition({
		weather: weatherEntries.get("天候") ?? "",
		windDirection: weatherEntries.get("風向") ?? "",
		windSpeed: weatherEntries.get("風速") ?? "",
		waveHeight: weatherEntries.get("波高") ?? "",
		airTemperature: weatherEntries.get("気温") ?? "",
		waterTemperature: weatherEntries.get("水温") ?? "",
		displayTime,
	}, { source: KIRYU_SOURCE });

	return {
		beforeInfo: beforeInfo.sort((left, right) => left.frameNo - right.frameNo),
		originalExhibition: originalExhibition.sort((left, right) => left.frameNo - right.frameNo),
		startExhibition: startExhibition.sort((left, right) => left.course - right.course),
		weatherCondition,
	};
}

function parseKiryuSyussou(html) {
	const $ = load(html);
	const rows = [];
	const sectionResults = [];

	const tableRows = $("table.table1").first().children("tbody, thead").children("tr").toArray();
	if (!tableRows.length) {
		tableRows.push(...$("table.table1").first().children("tr").toArray());
	}
	for (let index = 0; index < tableRows.length; index += 1) {
		const cells = $(tableRows[index]).children("th,td").map((_, cell) => readCellText($, cell)).get();
		const frameNo = parseFrameNo(cells[1]);
		if (!frameNo || !/^\d{4}/.test(cells[2] ?? "")) {
			continue;
		}

		const profile = parseKiryuProfile(cells[2]);
		const courseCells = $(tableRows[index + 1]).children("th,td").map((_, cell) => readCellText($, cell)).get();
		const startCells = $(tableRows[index + 2]).children("th,td").map((_, cell) => readCellText($, cell)).get();
		const finishCells = $(tableRows[index + 3]).children("th,td").map((_, cell) => readCellText($, cell)).get();
		const raceNumbers = cells.slice(10, 22);
		const courses = courseCells[0] === "進" ? courseCells.slice(1, 13) : [];
		const startTimings = startCells.includes("ST") ? startCells.slice(startCells.indexOf("ST") + 1, startCells.indexOf("ST") + 13) : [];
		const finishOrders = finishCells[0] === "着" ? finishCells.slice(1, 13) : [];

		const row = {
			frameNo,
			registrationNo: profile.registrationNo,
			registerNo: profile.registrationNo,
			playerName: profile.playerName,
			className: profile.className,
			profile: profile.profile,
			averageStart: cells[4] ?? "",
			nationalWinRate: cells[5] ?? "",
			localWinRate: cells[6] ?? "",
			motorNo: cells[7] ?? "",
			boatNo: cells[8] ?? "",
			nationalSecondRate: startCells[0] ?? "",
			localSecondRate: startCells[1] ?? "",
			motorSecondRate: startCells[2] ?? "",
			boatSecondRate: startCells[3] ?? "",
			quickRaceNo: cells[cells.length - 1] ?? "",
			raceNumbers,
			courses,
			startTimings,
			finishOrders,
			source: KIRYU_SOURCE,
		};
		rows.push(row);
		sectionResults.push({
			frameNo,
			registrationNo: row.registrationNo,
			playerName: row.playerName,
			className: row.className,
			raceNumbers,
			courses,
			startTimings,
			finishOrders,
			source: KIRYU_SOURCE,
		});
	}

	return {
		entries: rows.sort((left, right) => left.frameNo - right.frameNo),
		sectionResults: sectionResults.sort((left, right) => left.frameNo - right.frameNo),
	};
}

function parseKiryuWaku10Course(html, entries = []) {
	const $ = load(html);
	const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	const frameLast10 = [];
	const rows = $("table.waku10 tr").toArray();

	for (let index = 0; index < rows.length; index += 1) {
		const cells = $(rows[index]).children("th,td").map((_, cell) => readCellText($, cell)).get();
		const frameNo = parseFrameNo(cells[0]);
		if (!frameNo) {
			continue;
		}

		const finishCells = $(rows[index + 1]).children("th,td").map((_, cell) => readCellText($, cell)).get();
		const entry = entryByFrame.get(frameNo) ?? {};
		const courseHistory = cells.slice(3, 13);
		const finishHistory = finishCells[0] === "着順" ? finishCells.slice(1, 11) : [];
		frameLast10.push({
			frameNo,
			registrationNo: entry.registrationNo ?? "",
			playerName: entry.playerName ?? cells[1] ?? "",
			className: entry.className ?? "",
			courseHistory,
			finishHistory,
			startTimingHistory: Array.from({ length: 10 }, () => ""),
			frameWinRate: cells[13] ?? "",
			frameAverageStart: cells[14] ?? "",
			source: KIRYU_SOURCE,
		});
	}

	const courseResults = [];
	let currentFrameNo = null;
	let currentPlayerName = "";
	$("table").not(".waku10").first().find("tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		if (!cells.length || cells[0] === "艇番") {
			return;
		}

		if (parseFrameNo(cells[0]) && cells.length >= 8) {
			currentFrameNo = Number(cells[0]);
			currentPlayerName = cells[1] ?? "";
			const entry = entryByFrame.get(currentFrameNo) ?? {};
			courseResults.push({
				frameNo: currentFrameNo,
				registrationNo: entry.registrationNo ?? "",
				playerName: entry.playerName ?? currentPlayerName,
				className: entry.className ?? "",
				course: cells[2] ?? "",
				entryRate: cells[3] ?? "",
				averageStart: cells[4] ?? "",
				firstRate: cells[5] ?? "",
				secondRate: cells[6] ?? "",
				thirdRate: cells[7] ?? "",
				source: KIRYU_SOURCE,
			});
			return;
		}

		if (currentFrameNo && cells.length >= 6) {
			const entry = entryByFrame.get(currentFrameNo) ?? {};
			courseResults.push({
				frameNo: currentFrameNo,
				registrationNo: entry.registrationNo ?? "",
				playerName: entry.playerName ?? currentPlayerName,
				className: entry.className ?? "",
				course: cells[0] ?? "",
				entryRate: cells[1] ?? "",
				averageStart: cells[2] ?? "",
				firstRate: cells[3] ?? "",
				secondRate: cells[4] ?? "",
				thirdRate: cells[5] ?? "",
				source: KIRYU_SOURCE,
			});
		}
	});

	return { frameLast10, courseResults };
}

function parseKiryuScoreRateGuide(html, entries = []) {
	const $ = load(html);
	const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
	const rows = [];

	$("table.mt_20 tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		const frameNo = parseFrameNo(cells[0]);
		if (!frameNo || !cells[1]) {
			return;
		}

		const profile = parseKiryuProfile(cells[1]);
		const entry = entryByFrame.get(frameNo) ?? {};
		rows.push({
			frameNo,
			registrationNo: profile.registrationNo || entry.registrationNo || "",
			registerNo: profile.registrationNo || entry.registrationNo || "",
			playerName: profile.playerName || entry.playerName || "",
			className: profile.className || entry.className || "",
			averageStart: entry.averageStart || "",
			winRate: entry.nationalWinRate || "",
			secondRate: entry.nationalSecondRate || "",
			localWinRate: entry.localWinRate || "",
			localSecondRate: entry.localSecondRate || "",
			motorNo: entry.motorNo || "",
			motorSecondRate: entry.motorSecondRate || "",
			scoreRate: cells[2] ?? "",
			rank: cells[3] ?? "",
			pointIfFirst: cells[4] ?? "",
			pointIfSecond: cells[5] ?? "",
			pointIfThird: cells[6] ?? "",
			pointIfFourth: cells[7] ?? "",
			pointIfFifth: cells[8] ?? "",
			pointIfSixth: cells[9] ?? "",
			quickRaceNo: cells[10] ?? entry.quickRaceNo ?? "",
			source: KIRYU_SOURCE,
		});
	});

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function parseKiryuTimerank(html) {
	const $ = load(html);
	const rows = [];

	$("table.table tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		if (cells.length < 6 || !/^\d+/.test(cells[0])) {
			return;
		}

		rows.push({
			rank: cells[0] ?? "",
			registrationNo: cells[1] ?? "",
			playerName: cells[2] ?? "",
			motorNo: cells[3] ?? "",
			motorSecondRate: cells[4] ?? "",
			boatNo: cells[5] ?? "",
			boatSecondRate: cells[6] ?? "",
			preInspectionTime: cells[7] ?? "",
			source: KIRYU_SOURCE,
		});
	});

	return rows;
}

function parseKiryuMotorRank(html) {
	const $ = load(html);
	const rows = [];

	$("table.table").first().find("tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		const motorNo = cells[0];
		if (!/^\d+$/.test(motorNo ?? "")) {
			return;
		}

		rows.push({
			motorNo,
			calculationPeriod: cells[1] ?? "",
			seriesCount: cells[2] ?? "",
			motorSecondRate: cells[3] ?? "",
			motorWinRate: cells[4] ?? "",
			accidentRate: cells[5] ?? "",
			firstCount: cells[6] ?? "",
			secondCount: cells[7] ?? "",
			thirdCount: cells[8] ?? "",
			starts: cells[9] ?? "",
			finals: cells[10] ?? "",
			championships: cells[11] ?? "",
			source: KIRYU_SOURCE,
		});
	});

	return rows;
}

function parseKiryuBoatRank(html) {
	const $ = load(html);
	const rows = [];

	$("table.table").first().find("tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		const boatNo = cells[0];
		if (!/^\d+$/.test(boatNo ?? "")) {
			return;
		}

		rows.push({
			boatNo,
			calculationPeriod: cells[1] ?? "",
			seriesCount: cells[2] ?? "",
			boatSecondRate: cells[3] ?? "",
			boatWinRate: cells[4] ?? "",
			accidentRate: cells[5] ?? "",
			firstCount: cells[6] ?? "",
			secondCount: cells[7] ?? "",
			thirdCount: cells[8] ?? "",
			starts: cells[9] ?? "",
			finals: cells[10] ?? "",
			championships: cells[11] ?? "",
			source: KIRYU_SOURCE,
		});
	});

	return rows;
}

function parseKiryuMotorHistory(html, motorNo) {
	const $ = load(html);
	const rows = [];

	$("table").first().find("tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		if (cells.length < 4 || cells[0] === "使用期間") {
			return;
		}

		rows.push({
			motorNo: String(motorNo),
			dateRange: cells[0] ?? "",
			grade: cells[1] ?? "",
			playerName: cells[2] ?? "",
			results: cells[3] ?? "",
			source: KIRYU_SOURCE,
		});
	});

	return rows.slice(0, 5);
}

function parseKiryuWaterSurfaceInfo(html) {
	const $ = load(html);
	const pointRows = {};
	$("table.point tr").each((_, row) => {
		const cells = $(row).children("th,td").map((__, cell) => readCellText($, cell)).get();
		for (let index = 0; index < cells.length; index += 2) {
			if (cells[index] && cells[index + 1]) {
				pointRows[cells[index]] = cells[index + 1];
			}
		}
	});

	const courseRates = [];
	const courseTable = $("table.course").first();
	const firstRates = $(courseTable).find("tr").eq(2).children("th,td").map((_, cell) => readCellText($, cell)).get().slice(1);
	const secondRates = $(courseTable).find("tr").eq(3).children("th,td").map((_, cell) => readCellText($, cell)).get().slice(1);
	const thirdRates = $(courseTable).find("tr").eq(4).children("th,td").map((_, cell) => readCellText($, cell)).get().slice(1);
	for (let index = 0; index < 6; index += 1) {
		courseRates.push({
			course: String(index + 1),
			firstRate: firstRates[index] ?? "",
			secondRate: secondRates[index] ?? "",
			thirdRate: thirdRates[index] ?? "",
		});
	}

	const text = [
		pointRows["水面特性"] ? `水面特性: ${pointRows["水面特性"]}` : "",
		pointRows["レースの特性"] ? `レース特性: ${pointRows["レースの特性"]}` : "",
	].filter(Boolean).join(" / ");

	return {
		source: KIRYU_SOURCE,
		surfaceSummary: [
			pointRows["水質"] ? `水質 ${pointRows["水質"]}` : "",
			pointRows["流れ：水位変化"] ? `水位変化 ${pointRows["流れ：水位変化"]}` : "",
			pointRows["チルト角度"] ? `チルト ${pointRows["チルト角度"]}` : "",
		].filter(Boolean).join(" / "),
		featureSummary: text,
		courseSummary: courseRates.map((row) => `${row.course}コース 1着${row.firstRate}% 2着${row.secondRate}% 3着${row.thirdRate}%`).join(" / "),
		waterQuality: pointRows["水質"] ?? "",
		waterLevelChange: pointRows["流れ：水位変化"] ?? "",
		tiltRange: pointRows["チルト角度"] ?? "",
		waterSurface: pointRows["水面特性"] ?? "",
		raceCharacteristics: pointRows["レースの特性"] ?? "",
		courseRates,
		description: text,
		summary: text,
	};
}

function createKiryuMotorSummary(entries, timerankRows, motorRows, boatRows, motorHistoryByNo = new Map()) {
	const timerankByRegistration = new Map(timerankRows.map((row) => [row.registrationNo, row]));
	const timerankByName = new Map(timerankRows.map((row) => [row.playerName.replace(/\s+/g, ""), row]));
	const motorByNo = new Map(motorRows.map((row) => [row.motorNo, row]));
	const boatByNo = new Map(boatRows.map((row) => [row.boatNo, row]));

	return entries.map((entry) => {
		const timerank = timerankByRegistration.get(entry.registrationNo) ?? timerankByName.get(entry.playerName.replace(/\s+/g, "")) ?? {};
		const motorNo = entry.motorNo || timerank.motorNo || "";
		const boatNo = entry.boatNo || timerank.boatNo || "";
		const motor = motorByNo.get(motorNo) ?? {};
		const boat = boatByNo.get(boatNo) ?? {};
		const historyEntries = motorHistoryByNo.get(motorNo) ?? [];
		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo,
			playerName: entry.playerName,
			motorNo,
			motorSecondRate: entry.motorSecondRate || timerank.motorSecondRate || motor.motorSecondRate || "",
			motorWinRate: motor.motorWinRate || "",
			finals: motor.finals || "",
			championships: motor.championships || "",
			boatNo,
			boatSecondRate: entry.boatSecondRate || timerank.boatSecondRate || boat.boatSecondRate || "",
			boatWinRate: boat.boatWinRate || "",
			preInspectionTime: timerank.preInspectionTime || "",
			currentUser: entry.playerName,
			previousUser: historyEntries[0]?.playerName ?? "",
			recentResults: historyEntries.map((item) => [item.dateRange, item.playerName, item.results].filter(Boolean).join(" ")).join(" / ") || (motor.calculationPeriod ? `算出期間 ${motor.calculationPeriod}` : ""),
			historyEntries,
			comment: [
				motor.motorWinRate ? `モーター勝率 ${motor.motorWinRate}` : "",
				timerank.preInspectionTime ? `前検 ${timerank.preInspectionTime}` : "",
				boat.boatWinRate ? `ボート勝率 ${boat.boatWinRate}` : "",
			].filter(Boolean).join(" / "),
			source: KIRYU_SOURCE,
		};
	});
}

async function createKiryuVenue(feed, date) {
	const kiryuVenue = findVenue(feed, KIRYU_VENUE_NAME);
	if (!kiryuVenue) {
		console.log("[venue-extras] kiryu: not held today");
		return null;
	}

	try {
		const [timerankHtml, motorHtml, boatHtml, waterHtml] = await Promise.all([
			fetchKiryuHtml(KIRYU_TIMERANK_URL).catch(() => ""),
			fetchKiryuHtml("https://www.kiryu-kyotei.com/modules/datafile/?page=index_mrankdtl&start=13&dtl=13").catch(async () => fetchKiryuHtml(KIRYU_MOTOR_RANK_URL).catch(() => "")),
			fetchKiryuHtml(KIRYU_BOAT_RANK_URL).catch(() => ""),
			fetchKiryuHtml(KIRYU_WATER_SURFACE_URL).catch(() => ""),
		]);
		const timerankRows = parseKiryuTimerank(timerankHtml);
		const motorRows = parseKiryuMotorRank(motorHtml);
		const boatRows = parseKiryuBoatRank(boatHtml);
		const waterSurfaceInfo = parseKiryuWaterSurfaceInfo(waterHtml);
		const races = getRaceList(kiryuVenue);
		const raceHtmlByNo = new Map();

		for (const race of races) {
			const raceNo = Number(race.raceNo);
			const [syussouHtml, cyokuzenHtml, waku10Html, tokuhayamiHtml] = await Promise.all([
				fetchKiryuHtml(toKiryuYosouUrl({ date, raceNo, type: "syussou" })).catch(() => ""),
				fetchKiryuHtml(toKiryuYosouUrl({ date, raceNo, type: "cyokuzen" })).catch(() => ""),
				fetchKiryuHtml(toKiryuYosouUrl({ date, raceNo, type: "waku10_cource" })).catch(() => ""),
				fetchKiryuHtml(toKiryuYosouUrl({ date, raceNo, type: "tokuhayami" })).catch(() => ""),
			]);
			raceHtmlByNo.set(raceNo, { syussouHtml, cyokuzenHtml, waku10Html, tokuhayamiHtml });
			await sleep(REQUEST_INTERVAL_MS);
		}

		const parsedSyussouByRaceNo = new Map();
		const motorNos = new Set();
		for (const race of races) {
			const raceNo = Number(race.raceNo);
			const parsedSyussou = parseKiryuSyussou(raceHtmlByNo.get(raceNo)?.syussouHtml ?? "");
			parsedSyussouByRaceNo.set(raceNo, parsedSyussou);
			for (const entry of parsedSyussou.entries) {
				if (entry.motorNo) {
					motorNos.add(entry.motorNo);
				}
			}
		}
		const motorHistoryByNo = new Map();
		for (const motorNo of motorNos) {
			const historyHtml = await fetchKiryuHtml(toKiryuMotorHistoryUrl(motorNo)).catch(() => "");
			motorHistoryByNo.set(motorNo, parseKiryuMotorHistory(historyHtml, motorNo));
			await sleep(REQUEST_INTERVAL_MS);
		}

		const raceExtras = races.map((race) => {
			const raceNo = Number(race.raceNo);
			const html = raceHtmlByNo.get(raceNo) ?? {};
			const { entries, sectionResults } = parsedSyussouByRaceNo.get(raceNo) ?? { entries: [], sectionResults: [] };
			const cyokuzen = parseKiryuCyokuzen(html.cyokuzenHtml ?? "");
			const { frameLast10, courseResults } = parseKiryuWaku10Course(html.waku10Html ?? "", entries);
			const scoreQuickLook = parseKiryuScoreRateGuide(html.tokuhayamiHtml ?? "", entries);
			const motorSummary = createKiryuMotorSummary(entries, timerankRows, motorRows, boatRows, motorHistoryByNo);
			const entryByFrame = new Map(entries.map((entry) => [entry.frameNo, entry]));
			const beforeInfo = cyokuzen.beforeInfo.map((row) => ({
				...row,
				motorNo: entryByFrame.get(row.frameNo)?.motorNo ?? "",
			}));
			const originalExhibition = cyokuzen.originalExhibition.map((row) => ({
				...row,
				motorNo: entryByFrame.get(row.frameNo)?.motorNo ?? "",
			}));
			const weatherCondition = normalizeVenueWeatherCondition(cyokuzen.weatherCondition ?? race?.weatherActual ?? kiryuVenue?.weatherActual ?? null, {
				source: KIRYU_SOURCE,
			});

			return {
				raceNo: race.raceNo,
				status: cyokuzen.beforeInfo.length || scoreQuickLook.length || motorSummary.length || frameLast10.length ? "available" : "waiting-kiryu-data",
				source: KIRYU_SOURCE,
				sourceType: "kiryu-official-extras",
				officialBeforeInfo: {
					status: cyokuzen.beforeInfo.length || cyokuzen.startExhibition.length || scoreQuickLook.length ? "available" : "waiting",
					source: `${BOATRACE_OFFICIAL_SOURCE}+${KIRYU_SOURCE}`,
					exhibitionRows: beforeInfo,
					startExhibition: cyokuzen.startExhibition,
					scoreQuickLook,
					weatherActual: weatherCondition,
					weatherCondition,
				},
				beforeInfo,
				startExhibition: cyokuzen.startExhibition,
				originalExhibition,
				motorSummary,
				scoreQuickLook,
				scoreRateGuide: scoreQuickLook,
				kiryuScoreRateGuide: scoreQuickLook,
				kiryuSectionResults: sectionResults,
				kiryuFrameLast10: frameLast10,
				kiryuCourseResults: courseResults,
				kiryuMotorData: motorSummary,
				kiryuBoatData: motorSummary,
				kiryuMotorHistory: motorSummary,
				kiryuPreInspectionRank: timerankRows,
				waterSurfaceInfo,
				kiryuWaterSurfaceInfo: waterSurfaceInfo,
				weatherCondition,
			};
		});

		const firstRace = raceExtras[0] ?? null;
		console.log(
			`[kiryu extras] before=${firstRace?.beforeInfo?.length ?? 0} start=${firstRace?.startExhibition?.length ?? 0} original=${firstRace?.originalExhibition?.length ?? 0} motor=${firstRace?.motorSummary?.length ?? 0} boat=${firstRace?.kiryuBoatData?.length ?? 0} score=${firstRace?.kiryuScoreRateGuide?.length ?? 0} frame10=${firstRace?.kiryuFrameLast10?.length ?? 0} course=${firstRace?.kiryuCourseResults?.length ? "ok" : "none"} water=${waterSurfaceInfo ? "ok" : "none"} weather=${firstRace?.weatherCondition ? "ok" : "none"}`,
		);

		return {
			venueCode: String(kiryuVenue.venueCode ?? "01"),
			venueName: KIRYU_VENUE_NAME,
			source: KIRYU_SOURCE,
			isAvailable: raceExtras.some((race) => race.status === "available"),
			status: raceExtras.some((race) => race.status === "available") ? "available" : "waiting-kiryu-data",
			note: "桐生公式HTMLから直前情報、スタート展示、独自展示、得点率早見、枠番別10走、進入コース別、モーター/ボート、水面特性を取得。",
			waterSurfaceInfo,
			kiryuWaterSurfaceInfo: waterSurfaceInfo,
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] kiryu failed: ${error.message}`);
		return {
			venueCode: String(kiryuVenue.venueCode ?? "01"),
			venueName: KIRYU_VENUE_NAME,
			source: KIRYU_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `Kiryu official extras fetch failed: ${error.message}`,
			races: [],
		};
	}
}

function getMiyajimaRaceEntries(race) {
	const racers = Array.isArray(race?.racers) ? race.racers : [];
	return racers.map((racer) => ({
		frameNo: Number(racer.frameNo ?? racer.frame ?? racer.lane ?? racer.boatNumber),
		registrationNo: compactText(racer.registrationNo ?? racer.racerId),
		registerNo: compactText(racer.registrationNo ?? racer.racerId),
		playerName: compactText(racer.playerName ?? racer.name ?? racer.boatRacerName),
		racerName: compactText(racer.playerName ?? racer.name ?? racer.boatRacerName),
		className: compactText(racer.class ?? racer.grade ?? racer.className),
		branch: compactText(racer.branch),
		averageStart: compactText(racer.averageStart ?? racer.avgSt ?? racer.st),
		winRate: compactText(racer.winRate ?? racer.winningRate),
		secondRate: compactText(racer.secondRate ?? racer.twoRate),
		localWinRate: compactText(racer.localWinRate),
		localSecondRate: compactText(racer.localSecondRate),
		motorNo: compactText(racer.motorNo ?? racer.motorNumber),
		motorSecondRate: compactText(racer.motorSecondRate ?? racer.motorTwoRate),
		boatNo: compactText(racer.boatNo ?? racer.boatMotorNo ?? racer.boatEquipmentNo),
		boatSecondRate: compactText(racer.boatSecondRate ?? racer.boatTwoRate),
	})).filter((row) => row.frameNo >= 1 && row.frameNo <= 6);
}

function parseMiyajimaTimerank(html) {
	const $ = load(html);
	const rows = [];

	$("table.raceinfotable").first().find("tr").each((_, row) => {
		const cells = $(row).find("td").map((__, cell) => readCellText($, cell)).get();
		if (cells.length < 9 || !/^\d+$/.test(cells[0]) || !/^\d{4}$/.test(cells[1])) {
			return;
		}

		rows.push({
			rank: cells[0],
			registrationNo: cells[1],
			registerNo: cells[1],
			playerName: cells[2],
			racerName: cells[2],
			className: cells[3],
			motorNo: cells[4],
			motorSecondRate: cells[5],
			boatNo: cells[6],
			boatSecondRate: cells[7],
			preInspectionTime: cells[8],
			source: MIYAJIMA_SOURCE,
		});
	});

	return rows;
}

function parseMiyajimaScoreRateRows(html) {
	const $ = load(html);
	const rows = [];

	$("table.raceinfotable").first().find("tr").each((_, row) => {
		const cells = $(row).find("td").map((__, cell) => readCellText($, cell)).get();
		if (cells.length < 8 || !/^\d+$/.test(cells[0]) || !/^\d{4}$/.test(cells[1])) {
			return;
		}

		rows.push({
			rank: cells[0],
			registrationNo: cells[1],
			playerName: cells[2],
			className: cells[3],
			scoreRate: cells[4],
			starts: cells[5],
			score: cells[6],
			deduction: cells[7],
			sectionResults: cells.slice(8, -1).filter(Boolean).join(" / "),
			remarks: cells.at(-1) ?? "",
			source: MIYAJIMA_SOURCE,
		});
	});

	return rows;
}

function parseMiyajimaRaceDataLinks(html) {
	const $ = load(html);
	const links = {};

	$("a[href*='shussou/pdf_file/']").each((_, anchor) => {
		const href = $(anchor).attr("href");
		const label = compactText($(anchor).closest(".thum02").find(".txt").text()) || compactText($(anchor).text());
		if (!href || !label) {
			return;
		}

		const url = new URL(href, MIYAJIMA_TOP_URL).href;
		const key = label.includes("\u9078\u624b\u7bc0\u9593\u6210\u7e3e\u8868") ? "sectionResults" :
			label.includes("\u5c55\u793a\u822a\u8d70\u60c5\u5831\u5c65\u6b74\u4e00\u89a7\u8868") ? "exhibitionHistory" :
			label.includes("\u4f53\u91cd\u5c65\u6b74\u4e00\u89a7\u8868") ? "weightHistory" :
			label.includes("\u6700\u8fd1\u7bc0\u9078\u624b\u6210\u7e3e\u8868\uff08\u5f53\u5730\uff09") ? "localRecent3" :
			label.includes("\u6700\u8fd1\u7bc0\u9078\u624b\u6210\u7e3e\u8868\uff08\u5168\u56fd\uff09") ? "nationalRecent3" :
			label.includes("\u524d\u691c\u822a\u8d70\u30bf\u30a4\u30e0") ? "preInspectionLapTimes" :
			label.includes("\u30e2\u30fc\u30bf\u30fc\u6210\u7e3e\u96c6\u8a08\u8868") ? "motorStats" :
			label.includes("\u30e2\u30fc\u30bf\u30fc\u524d\u56de\u6210\u7e3e\u8868") ? "motorHistory" :
			label.includes("\u30dc\u30fc\u30c8\u6210\u7e3e\u96c6\u8a08\u8868") ? "boatStats" :
			label.includes("\u30dc\u30fc\u30c8\u524d\u56de\u6210\u7e3e\u8868") ? "boatHistory" :
			label.includes("\u9078\u624b\u6210\u7e3e\u8868") ? "racerStats" :
			label.includes("\u9078\u624b\u5225\u6210\u7e3e") ? "racerStartStats" :
			"other";

		if (key !== "other" && !links[key]) {
			links[key] = { label, url, source: MIYAJIMA_SOURCE };
		}
	});

	return links;
}

async function fetchMiyajimaWeatherCondition() {
	try {
		const text = await fetchHtml(MIYAJIMA_WEATHER_LIVE_URL);
		const parsed = JSON.parse(text);
		const item = Array.isArray(parsed?.Items) ? parsed.Items[0] : null;
		if (!item) {
			return null;
		}

		return normalizeVenueWeatherCondition({
			windDirection: item.Dm ? `${item.Dm}\u00b0` : "",
			windDirectionText: item.Dm ? `${item.Dm}\u00b0` : "",
			windSpeed: item.Sm !== undefined ? `${item.Sm}m/s` : "",
			temperature: item.Ta !== undefined ? `${item.Ta}\u2103` : "",
			airTemperature: item.Ta !== undefined ? `${item.Ta}\u2103` : "",
			waterTemperature: item.Th !== undefined ? `${item.Th}\u2103` : "",
			pressure: item.Pa !== undefined ? `${item.Pa}hPa` : "",
			humidity: item.Ua !== undefined ? `${item.Ua}%` : "",
			rainfall: item.Ra !== undefined ? `${item.Ra}mm` : "",
			observedAt: compactText(item.logtime),
			updatedAt: compactText(item.logtime),
			source: MIYAJIMA_SOURCE,
			sourceUrl: MIYAJIMA_WEATHER_LIVE_URL,
			sourceLabel: "\u5bae\u5cf6\u516c\u5f0f\u6c34\u9762\u6c17\u8c61\u60c5\u5831LIVE",
		}, {
			source: MIYAJIMA_SOURCE,
			sourceUrl: MIYAJIMA_WEATHER_LIVE_URL,
			sourceLabel: "\u5bae\u5cf6\u516c\u5f0f\u6c34\u9762\u6c17\u8c61\u60c5\u5831LIVE",
		});
	} catch (error) {
		console.warn(`[venue-extras] miyajima weather failed: ${error.message}`);
		return null;
	}
}

function createMiyajimaMotorSummary(entries, timerankRows) {
	const byRegistration = new Map(timerankRows.map((row) => [row.registrationNo, row]));
	const byMotorNo = new Map(timerankRows.map((row) => [row.motorNo, row]));

	return entries.map((entry) => {
		const timerank = byRegistration.get(entry.registrationNo) ?? byMotorNo.get(entry.motorNo) ?? {};
		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo,
			playerName: entry.playerName,
			className: entry.className,
			motorNo: timerank.motorNo || entry.motorNo,
			motorSecondRate: timerank.motorSecondRate || entry.motorSecondRate,
			motorWinRate: "",
			boatNo: timerank.boatNo || entry.boatNo,
			boatSecondRate: timerank.boatSecondRate || entry.boatSecondRate,
			boatWinRate: "",
			preInspectionTime: timerank.preInspectionTime || "",
			previousUser: "",
			recentResults: timerank.rank ? `\u524d\u691c\u9806\u4f4d ${timerank.rank}` : "",
			motorGrade: "",
			comment: timerank.preInspectionTime ? `\u524d\u691c\u30bf\u30a4\u30e0 ${timerank.preInspectionTime}` : "",
			source: MIYAJIMA_SOURCE,
		};
	}).filter((row) => row.motorNo || row.boatNo || row.preInspectionTime);
}

function createMiyajimaScoreRows(entries, scoreRows, officialRows = []) {
	const byRegistration = new Map(scoreRows.map((row) => [row.registrationNo, row]));
	const officialByFrame = new Map(officialRows.map((row) => [row.frameNo, row]));

	return entries.map((entry) => {
		const score = byRegistration.get(entry.registrationNo) ?? {};
		const official = officialByFrame.get(entry.frameNo) ?? {};
		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo,
			playerName: entry.playerName,
			className: entry.className,
			branch: entry.branch,
			averageStart: entry.averageStart || official.averageStart || "",
			winRate: entry.winRate || official.winRate || "",
			secondRate: entry.secondRate || official.secondRate || "",
			localWinRate: entry.localWinRate || official.localWinRate || "",
			localSecondRate: entry.localSecondRate || official.localSecondRate || "",
			motorNo: entry.motorNo || official.motorNo || "",
			motorSecondRate: entry.motorSecondRate || official.motorSecondRate || "",
			scoreRate: score.scoreRate || official.scoreRate || "",
			score: score.score || "",
			deduction: score.deduction || "",
			starts: score.starts || "",
			sectionResults: score.sectionResults || "",
			remarks: score.remarks || "",
			source: score.source || BOATRACE_OFFICIAL_SOURCE,
		};
	});
}

function createMiyajimaOriginalExhibition(entries, beforeInfo) {
	const beforeByFrame = new Map(beforeInfo.map((row) => [row.frameNo, row]));
	return entries.map((entry) => {
		const before = beforeByFrame.get(entry.frameNo) ?? {};
		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo,
			registerNo: entry.registrationNo,
			playerName: entry.playerName,
			racerName: entry.playerName,
			className: entry.className,
			weight: before.weight || "",
			weightAdjustment: before.weightAdjustment || before.adjustment || "",
			adjustment: before.adjustment || before.weightAdjustment || "",
			tilt: before.tilt || "",
			exhibitionTime: before.exhibitionTime || "",
			motorNo: entry.motorNo,
			lapTime: "",
			turnTime: "",
			straightTime: "",
			originalTime: "",
			lapMemo: "\u5bae\u5cf6\u516c\u5f0fHTML\u3067\u306f\u5468\u56de\u30bf\u30a4\u30e0/\u30aa\u30ea\u30b8\u30ca\u30eb\u5c55\u793a\u30bf\u30a4\u30e0\u306e\u30c6\u30ad\u30b9\u30c8\u8868\u306f\u672a\u78ba\u8a8d",
			sourceLabel: "\u5bae\u5cf6\u516c\u5f0f\u30aa\u30ea\u30b8\u30ca\u30eb\u5c55\u793a\u30bf\u30a4\u30e0",
			source: `${BOATRACE_OFFICIAL_SOURCE}+${MIYAJIMA_SOURCE}`,
		};
	}).filter((row) => row.exhibitionTime || row.tilt || row.motorNo);
}

function createMiyajimaAvailabilityRows(entries, key, link) {
	if (!link) {
		return [];
	}

	return entries.map((entry) => ({
		frameNo: entry.frameNo,
		registrationNo: entry.registrationNo,
		playerName: entry.playerName,
		className: entry.className,
		sourceLabel: link.label,
		sourceUrl: link.url,
		source: MIYAJIMA_SOURCE,
		status: "available-official-pdf",
	}));
}

function createMiyajimaCourseRows(entries) {
	return entries.map((entry) => ({
		frameNo: entry.frameNo,
		registrationNo: entry.registrationNo,
		playerName: entry.playerName,
		className: entry.className,
		courseRows: Array.from({ length: 6 }, (_, index) => ({
			courseNo: index + 1,
			entryRate: "",
			averageStart: "",
			firstRate: "",
			secondRate: "",
			thirdRate: "",
			fourthRate: "",
			fifthRate: "",
			sixthRate: "",
		})),
		source: MIYAJIMA_SOURCE,
		sourceLabel: "\u5bae\u5cf6\u516c\u5f0f\u7af6\u8d70\u6c34\u9762\u30fb\u9032\u5165\u30b3\u30fc\u30b9\u5225\u60c5\u5831",
	}));
}

async function createMiyajimaVenue(feed, date) {
	const miyajimaVenue = findVenue(feed, MIYAJIMA_VENUE_NAME);
	if (!miyajimaVenue) {
		console.log("[venue-extras] miyajima: not held today");
		return null;
	}

	try {
		const [timerankHtml, scoreHtml, racedataHtml, weatherCondition] = await Promise.all([
			fetchHtml(MIYAJIMA_TIMERANK_URL).catch(() => ""),
			fetchHtml(MIYAJIMA_SCORE_RATE_URL).catch(() => ""),
			fetchHtml(MIYAJIMA_RACEDATA_URL).catch(() => ""),
			fetchMiyajimaWeatherCondition(),
		]);

		const timerankRows = parseMiyajimaTimerank(timerankHtml);
		const scoreRows = parseMiyajimaScoreRateRows(scoreHtml);
		const racedataLinks = parseMiyajimaRaceDataLinks(racedataHtml);
		const races = getRaceList(miyajimaVenue);
		const waterSurfaceInfo = {
			surfaceSummary: "\u5bae\u5cf6\u516c\u5f0f\u306e\u6c34\u9762\u6c17\u8c61LIVE\u3068\u7af6\u8d70\u6c34\u9762\u30fb\u9032\u5165\u30b3\u30fc\u30b9\u5225\u60c5\u5831\u3092\u78ba\u8a8d\u5bfe\u8c61\u3068\u3057\u3066\u4fdd\u5b58",
			featureSummary: "\u6c17\u8c61LIVE\u304b\u3089\u98a8\u901f\u30fb\u6c17\u6e29\u30fb\u6c34\u6e29\u30fb\u6c17\u5727\u30fb\u6e7f\u5ea6\u30fb\u96e8\u91cf\u3092\u53d6\u5f97",
			courseSummary: "\u9032\u5165\u30b3\u30fc\u30b9\u5225\u60c5\u5831\u306f\u5bae\u5cf6\u516c\u5f0f\u5c0e\u7dda\u78ba\u8a8d\u6e08\u307f",
			source: MIYAJIMA_SOURCE,
		};

		const raceExtras = races.map((race) => {
			const entries = getMiyajimaRaceEntries(race);
			const baseOfficialBeforeInfo = buildOfficialBeforeInfoForRace(race);
			const beforeInfo = baseOfficialBeforeInfo.exhibitionRows.map((row) => {
				const entry = entries.find((item) => item.frameNo === row.frameNo) ?? {};
				return {
					...row,
					playerName: entry.playerName || row.playerName,
					registrationNo: entry.registrationNo || "",
					registerNo: entry.registrationNo || "",
					className: entry.className || "",
					weight: row.weight || "",
					weightAdjustment: row.weightAdjustment || "",
					adjustment: row.adjustment || row.weightAdjustment || "",
					motorNo: entry.motorNo || "",
					source: `${BOATRACE_OFFICIAL_SOURCE}+${MIYAJIMA_SOURCE}`,
				};
			});
			const startExhibition = baseOfficialBeforeInfo.startExhibition.map((row) => {
				const entry = entries.find((item) => item.frameNo === row.frameNo) ?? {};
				return {
					...row,
					playerName: entry.playerName || "",
					className: entry.className || "",
					registerNo: entry.registrationNo || "",
					exhibitionTime: beforeInfo.find((item) => item.frameNo === row.frameNo)?.exhibitionTime || "",
					source: `${BOATRACE_OFFICIAL_SOURCE}+${MIYAJIMA_SOURCE}`,
				};
			});
			const scoreQuickLook = createMiyajimaScoreRows(entries, scoreRows, baseOfficialBeforeInfo.scoreQuickLook);
			const motorSummary = createMiyajimaMotorSummary(entries, timerankRows);
			const originalExhibition = createMiyajimaOriginalExhibition(entries, beforeInfo);
			const miyajimaFrameLast10 = createMiyajimaAvailabilityRows(entries, "frameLast10", racedataLinks.racerStats);
			const miyajimaNationalRecent3 = createMiyajimaAvailabilityRows(entries, "nationalRecent3", racedataLinks.nationalRecent3);
			const miyajimaLocalRecent3 = createMiyajimaAvailabilityRows(entries, "localRecent3", racedataLinks.localRecent3);
			const miyajimaSectionResults = createMiyajimaAvailabilityRows(entries, "sectionResults", racedataLinks.sectionResults);
			const miyajimaCourseResults = createMiyajimaCourseRows(entries);
			const mergedWeather = mergeVenueWeatherCondition(
				baseOfficialBeforeInfo.weatherCondition ?? race?.weatherActual ?? miyajimaVenue?.weatherActual,
				weatherCondition,
			);

			return {
				raceNo: race.raceNo,
				status: beforeInfo.length || startExhibition.length || motorSummary.length || scoreQuickLook.length ? "available" : "waiting-miyajima-data",
				source: MIYAJIMA_SOURCE,
				sourceType: "miyajima-official-extras",
				officialBeforeInfo: {
					...baseOfficialBeforeInfo,
					status: beforeInfo.length || startExhibition.length || scoreQuickLook.length ? "available" : "waiting",
					source: `${BOATRACE_OFFICIAL_SOURCE}+${MIYAJIMA_SOURCE}`,
					exhibitionRows: beforeInfo,
					startExhibition,
					scoreQuickLook,
					weatherActual: mergedWeather,
					weatherCondition: mergedWeather,
				},
				beforeInfo,
				startExhibition,
				originalExhibition,
				motorSummary,
				scoreRateGuide: scoreQuickLook,
				miyajimaScoreRateGuide: scoreQuickLook,
				miyajimaSectionResults,
				miyajimaFrameLast10,
				miyajimaNationalRecent3,
				miyajimaLocalRecent3,
				miyajimaCourseResults,
				miyajimaMotorData: motorSummary,
				miyajimaBoatData: motorSummary,
				miyajimaMotorHistory: motorSummary,
				miyajimaPreInspectionRank: timerankRows,
				miyajimaOfficialLinks: racedataLinks,
				waterSurfaceInfo,
				miyajimaWaterSurfaceInfo: waterSurfaceInfo,
				weatherCondition: mergedWeather,
			};
		});

		const firstRace = raceExtras[0] ?? null;
		console.log(
			`[miyajima extras] before=${firstRace?.beforeInfo?.length ?? 0} start=${firstRace?.startExhibition?.length ?? 0} original=${firstRace?.originalExhibition?.length ?? 0} motor=${firstRace?.motorSummary?.length ?? 0} boat=${firstRace?.miyajimaBoatData?.length ?? 0} score=${firstRace?.miyajimaScoreRateGuide?.length ?? 0} frame10=${firstRace?.miyajimaFrameLast10?.length ?? 0} national3=${firstRace?.miyajimaNationalRecent3?.length ?? 0} local3=${firstRace?.miyajimaLocalRecent3?.length ?? 0} course=${firstRace?.miyajimaCourseResults?.length ? "ok" : "none"} water=${waterSurfaceInfo ? "ok" : "none"} weather=${firstRace?.weatherCondition ? "ok" : "none"}`,
		);

		return {
			venueCode: String(miyajimaVenue.venueCode ?? "17"),
			venueName: MIYAJIMA_VENUE_NAME,
			source: MIYAJIMA_SOURCE,
			isAvailable: raceExtras.some((race) => race.status === "available"),
			status: raceExtras.some((race) => race.status === "available") ? "available" : "waiting-miyajima-data",
			note: "Miyajima official extras from before info, timerank, score rank, race data links, and weather live.",
			waterSurfaceInfo,
			miyajimaWaterSurfaceInfo: waterSurfaceInfo,
			weatherCondition,
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] miyajima failed: ${error.message}`);
		return {
			venueCode: String(miyajimaVenue.venueCode ?? "17"),
			venueName: MIYAJIMA_VENUE_NAME,
			source: MIYAJIMA_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `Miyajima official extras fetch failed: ${error.message}`,
			races: [],
		};
	}
}

function getTokonameRaceEntries(race) {
	const racers = Array.isArray(race?.racers) ? race.racers : [];
	return racers.map((racer) => ({
		frameNo: Number(racer.frameNo ?? racer.frame ?? racer.boatNumber),
		registrationNo: compactText(racer.registrationNo ?? racer.racerId),
		playerName: compactText(racer.playerName ?? racer.name ?? racer.boatRacerName),
		className: compactText(racer.class ?? racer.grade ?? racer.className),
		averageStart: compactText(racer.averageStart ?? racer.avgSt ?? racer.st),
		winRate: compactText(racer.winRate ?? racer.winningRate),
		secondRate: compactText(racer.secondRate ?? racer.twoRate),
		localWinRate: compactText(racer.localWinRate),
		localSecondRate: compactText(racer.localSecondRate),
		motorNo: compactText(racer.motorNo ?? racer.motorNumber),
		motorSecondRate: compactText(racer.motorSecondRate ?? racer.motorTwoRate),
		boatNo: compactText(racer.boatNo ?? racer.boatMotorNo ?? racer.boatEquipmentNo),
		boatSecondRate: compactText(racer.boatSecondRate ?? racer.boatTwoRate),
	})).filter((row) => row.frameNo >= 1 && row.frameNo <= 6);
}

function findTokonameRow(rows, entry, key) {
	return rows.find((row) =>
		(entry.registrationNo && row.registrationNo === entry.registrationNo) ||
		(entry[key] && row[key] === entry[key]) ||
		(entry.playerName && row.playerName === entry.playerName)
	) ?? null;
}

function createTokonameRaceScoreRows(race, scoreRows) {
	return getTokonameRaceEntries(race).map((entry) => {
		const scoreRow = findTokonameRow(scoreRows, entry, "registrationNo");
		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo,
			playerName: entry.playerName,
			className: entry.className || scoreRow?.className || "",
			averageStart: entry.averageStart,
			winRate: entry.winRate,
			secondRate: entry.secondRate,
			localWinRate: entry.localWinRate,
			localSecondRate: entry.localSecondRate,
			motorNo: entry.motorNo,
			motorSecondRate: entry.motorSecondRate,
			scoreRate: scoreRow?.scoreRate ?? "",
			scoreRank: scoreRow?.scoreRank ?? "",
			score: scoreRow?.score ?? "",
			deduction: scoreRow?.deduction ?? "",
			starts: scoreRow?.starts ?? "",
			sectionResults: scoreRow?.sectionResults ?? "",
			raceSchedule: scoreRow?.raceSchedule ?? "",
			source: scoreRow ? TOKONAME_SOURCE : BOATRACE_OFFICIAL_SOURCE,
		};
	});
}

function createTokonameCourseRows(race, courseRows) {
	const entries = getTokonameRaceEntries(race);
	const allowedFrames = new Set(entries.map((entry) => entry.frameNo));
	return courseRows
		.filter((row) => allowedFrames.has(row.frameNo))
		.map((row) => ({
			...row,
			playerName: entries.find((entry) => entry.frameNo === row.frameNo)?.playerName || row.playerName,
		}));
}

function createTokonameMotorSummary(race, timerankRows, motorRows, boatRows) {
	return getTokonameRaceEntries(race).map((entry) => {
		const timerank = findTokonameRow(timerankRows, entry, "registrationNo");
		const motor = motorRows.find((row) => row.motorNo === (timerank?.motorNo || entry.motorNo)) ?? null;
		const boat = boatRows.find((row) => row.boatNo === (timerank?.boatNo || entry.boatNo)) ?? null;
		const motorNo = timerank?.motorNo || entry.motorNo;
		const boatNo = timerank?.boatNo || entry.boatNo;
		const labels = [
			`\u30e2\u30fc\u30bf\u30fc2\u9023\u7387 ${motor?.motorSecondRate || timerank?.motorSecondRate || entry.motorSecondRate || "-"}`,
			`\u30e2\u30fc\u30bf\u30fc\u52dd\u7387 ${motor?.motorWinRate || "-"}`,
			`\u30dc\u30fc\u30c8 ${boatNo || "-"} / 2\u9023\u7387 ${boat?.boatSecondRate || timerank?.boatSecondRate || entry.boatSecondRate || "-"}`,
			timerank?.preinspectionTime ? `\u524d\u691c ${timerank.preinspectionTime}` : "",
			motor?.finals ? `\u512a\u51fa ${motor.finals}` : "",
			motor?.championships ? `\u512a\u52dd ${motor.championships}` : "",
			boat?.starts ? `\u30dc\u30fc\u30c8\u51fa\u8d70 ${boat.starts}` : "",
		].filter(Boolean);

		return {
			frameNo: entry.frameNo,
			registrationNo: entry.registrationNo,
			playerName: entry.playerName,
			className: entry.className,
			motorNo,
			motorSecondRate: motor?.motorSecondRate || timerank?.motorSecondRate || entry.motorSecondRate || "",
			motorWinRate: motor?.motorWinRate || "",
			boatNo,
			boatSecondRate: boat?.boatSecondRate || timerank?.boatSecondRate || entry.boatSecondRate || "",
			boatWinRate: boat?.boatWinRate || "",
			preinspectionTime: timerank?.preinspectionTime || "",
			finals: motor?.finals || "",
			championships: motor?.championships || "",
			starts: boat?.starts || "",
			currentUser: timerank?.playerName || entry.playerName,
			previousUser: "",
			comment: labels.join(" / "),
			source: TOKONAME_SOURCE,
		};
	});
}

function createTokonameOriginalExhibition(race, officialRows = []) {
	const exhibitionByFrame = new Map((Array.isArray(race?.exhibitions) ? race.exhibitions : []).map((row) => [Number(row.frameNo ?? row.frame ?? row.boatNumber), row]));
	return getTokonameRaceEntries(race).map((entry) => {
		const exhibition = exhibitionByFrame.get(entry.frameNo) ?? {};
		const officialRow = officialRows.find((row) =>
			row.frameNo === entry.frameNo ||
			(entry.registrationNo && row.registrationNo === entry.registrationNo) ||
			(entry.playerName && row.playerName === entry.playerName)
		) ?? null;
		const oneLapTime = officialRow?.oneLapTime ?? "";
		const turnTime = officialRow?.turnTime ?? "";
		const straightTime = officialRow?.straightTime ?? "";
		return {
			frameNo: entry.frameNo,
			registrationNo: officialRow?.registrationNo || entry.registrationNo,
			registerNo: officialRow?.registrationNo || entry.registrationNo,
			playerName: officialRow?.playerName || entry.playerName,
			racerName: officialRow?.playerName || entry.playerName,
			className: officialRow?.className || entry.className,
			branch: officialRow?.branch || "",
			hometown: officialRow?.hometown || "",
			age: officialRow?.age || "",
			weight: officialRow?.weight || compactText(exhibition.weight),
			weightAdjustment: officialRow?.weightAdjustment || compactText(exhibition.weightAdjustment ?? exhibition.adjustment),
			adjustment: officialRow?.weightAdjustment || compactText(exhibition.weightAdjustment ?? exhibition.adjustment),
			tilt: officialRow?.tilt || compactText(exhibition.tilt),
			exhibitionTime: officialRow?.exhibitionTime || compactText(exhibition.exhibitionTime ?? exhibition.displayTime ?? exhibition.time),
			motorNo: entry.motorNo,
			oneLapTime,
			lapTime: oneLapTime,
			turnTime,
			straightTime,
			exhibitionEvaluation: "",
			memo: officialRow ? "常滑公式オリジナル展示データ" : "\u5e38\u6ed1\u516c\u5f0f\u30aa\u30ea\u30b8\u30ca\u30eb\u5c55\u793a\u30c7\u30fc\u30bf\u516c\u958b\u5f85\u3061",
			note: officialRow ? "常滑公式オリジナル展示データ" : "",
			source: officialRow?.source || BOATRACE_OFFICIAL_SOURCE,
		};
	}).filter((row) => row.exhibitionTime || row.tilt || row.motorNo || row.oneLapTime || row.turnTime || row.straightTime);
}

async function createTokonameVenue(feed) {
	const tokonameVenue = findVenue(feed, TOKONAME_VENUE_NAME);
	if (!tokonameVenue) {
		console.log("[venue-extras] tokoname: not held today");
		return null;
	}

	try {
		const [
			topHtml,
			scoreHtml,
			timerankHtml,
			courseHtml,
			sectionHtml,
			motorHtml,
			boatHtml,
			waterHtml,
		] = await Promise.all([
			fetchTokonameHtml(TOKONAME_TOP_URL).catch(() => ""),
			fetchHtml(TOKONAME_SCORE_RATE_URL).catch(() => ""),
			fetchHtml(TOKONAME_TIMERANK_URL).catch(() => ""),
			fetchHtml(TOKONAME_COURSE_URL).catch(() => ""),
			fetchHtml(TOKONAME_SECTION_RESULTS_URL).catch(() => ""),
			fetchHtml(TOKONAME_MOTOR_DATA_URL).catch(() => ""),
			fetchHtml(TOKONAME_BOAT_DATA_URL).catch(() => ""),
			fetchHtml(TOKONAME_WATER_SURFACE_URL).catch(() => ""),
		]);
		const scoreRows = parseTokonameScoreRateGuide(scoreHtml);
		const timerankRows = parseTokonameTimerank(timerankHtml);
		const courseRows = parseTokonameCourseResults(courseHtml);
		const sectionRows = parseTokonameSectionResults(sectionHtml);
		const motorRows = parseTokonameMotorData(motorHtml);
		const boatRows = parseTokonameBoatData(boatHtml);
		const waterSurfaceInfo = parseTokonameWaterSurfaceInfo(waterHtml);
		const raceList = getRaceList(tokonameVenue);
		const yosouContext = parseTokonameCurrentYosouContext(topHtml, feed?.date);
		const originalRowsByRaceNo = new Map();
		for (const race of raceList) {
			const raceNo = Number(race.raceNo);
			if (!yosouContext.day || !yosouContext.hasCyokuzenFrame || !raceNo) {
				originalRowsByRaceNo.set(raceNo, []);
				continue;
			}

			const url = toTokonameOriginalExhibitionUrl(yosouContext.day, raceNo);
			const html = await fetchTokonameHtml(url).catch(() => "");
			originalRowsByRaceNo.set(raceNo, parseTokonameOriginalExhibition(html, url));
		}

		const raceExtras = raceList.map((race) => {
			const scoreQuickLook = createTokonameRaceScoreRows(race, scoreRows);
			const tokonameCourseResults = createTokonameCourseRows(race, courseRows);
			const motorSummary = createTokonameMotorSummary(race, timerankRows, motorRows, boatRows);
			const originalExhibition = createTokonameOriginalExhibition(race, originalRowsByRaceNo.get(Number(race.raceNo)) ?? []);
			const tokonameSectionResults = sectionRows.filter((row) => scoreQuickLook.some((score) => score.playerName && score.playerName === row.playerName));
			const beforeInfo = buildOfficialBeforeInfoExhibitionRows(race);
			const startExhibition = buildOfficialBeforeInfoStartExhibitionRows(race, beforeInfo);
			const weatherCondition = normalizeVenueWeatherCondition(race?.weatherActual ?? tokonameVenue?.weatherActual ?? null, {
				source: BOATRACE_OFFICIAL_SOURCE,
			});

			return {
				raceNo: race.raceNo,
				status: scoreQuickLook.length || motorSummary.length || waterSurfaceInfo ? "available" : "waiting-tokoname-data",
				source: TOKONAME_SOURCE,
				sourceType: "tokoname-official-extras",
				officialBeforeInfo: {
					status: "available",
					source: `${BOATRACE_OFFICIAL_SOURCE}+${TOKONAME_SOURCE}`,
					exhibitionRows: beforeInfo,
					startExhibition,
					scoreQuickLook,
					weatherActual: weatherCondition,
					weatherCondition,
				},
				beforeInfo,
				startExhibition,
				originalExhibition,
				motorSummary,
				scoreRateGuide: scoreQuickLook,
				tokonameScoreRateGuide: scoreQuickLook,
				tokonameCourseResults,
				tokonameSectionResults,
				tokonameMotorData: motorSummary,
				tokonameBoatData: motorSummary,
				waterSurfaceInfo,
				weatherCondition,
			};
		});
		const firstRace = raceExtras[0] ?? null;
		const originalRace = raceExtras.find((race) =>
			(Array.isArray(race.originalExhibition) ? race.originalExhibition : []).filter((row) => row.oneLapTime && row.turnTime && row.straightTime).length === 6
		) ?? null;
		const originalRows = originalRace?.originalExhibition ?? [];
		console.log(
			`[tokoname extras] before=${firstRace?.officialBeforeInfo?.scoreQuickLook?.length ?? 0} start=feed original=${firstRace?.originalExhibition?.length ?? 0} motor=${firstRace?.motorSummary?.length ?? 0} boat=${firstRace?.tokonameBoatData?.length ?? 0} score=${firstRace?.tokonameScoreRateGuide?.length ?? 0} course=${firstRace?.tokonameCourseResults?.length ? "ok" : "none"} water=${waterSurfaceInfo ? "ok" : "none"} weather=${firstRace?.weatherCondition ? "ok" : "none"}`,
		);
		console.log(
			`[tokoname original check] race=${originalRace?.raceNo ?? "-"} original=${originalRows.length} lap=${originalRows.filter((row) => row.oneLapTime).length} turn=${originalRows.filter((row) => row.turnTime).length} straight=${originalRows.filter((row) => row.straightTime).length} exhibition=${originalRows.filter((row) => row.exhibitionTime).length} source=${originalRows.some((row) => String(row.source ?? "").includes(TOKONAME_SOURCE)) ? "official" : "none"}`,
		);

		return {
			venueCode: String(tokonameVenue.venueCode ?? "08"),
			venueName: TOKONAME_VENUE_NAME,
			source: TOKONAME_SOURCE,
			isAvailable: raceExtras.some((race) => race.status === "available"),
			status: raceExtras.some((race) => race.status === "available") ? "available" : "waiting-tokoname-data",
			note: "\u5e38\u6ed1\u516c\u5f0fHP\u306e\u5f97\u70b9\u7387\u3001\u9032\u5165\u30b3\u30fc\u30b9\u5225\u6210\u7e3e\u3001\u30e2\u30fc\u30bf\u30fc/\u30dc\u30fc\u30c8\u30c7\u30fc\u30bf\u3001\u6c34\u9762\u7279\u6027\u3001\u30aa\u30ea\u30b8\u30ca\u30eb\u5c55\u793a\u30c7\u30fc\u30bf\u3092\u53d6\u5f97",
			waterSurfaceInfo,
			tokonameWaterSurfaceInfo: waterSurfaceInfo,
			races: raceExtras,
		};
	} catch (error) {
		console.warn(`[venue-extras] tokoname failed: ${error.message}`);
		return {
			venueCode: String(tokonameVenue.venueCode ?? "08"),
			venueName: TOKONAME_VENUE_NAME,
			source: TOKONAME_SOURCE,
			isAvailable: false,
			status: "fetch-failed",
			note: `Tokoname official extras fetch failed: ${error.message}`,
			races: [],
		};
	}
}

async function main(rawOptions = parseUpdateBoatVenueExtrasOptions()) {
	const timestamps = getJstTimestampParts(rawOptions.targetDate);
	const generatedAt = getJstTimestamp();
	const feed = await readTodayRaceDetails();
	const date = normalizeTargetDate(rawOptions.targetDate ?? feed?.date, timestamps.date);
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

	const tokuyamaVenue = await createTokuyamaVenue(feed, date);
	if (tokuyamaVenue) {
		venueMap.set(tokuyamaVenue.venueName, mergeVenueRecord(venueMap.get(tokuyamaVenue.venueName) ?? null, tokuyamaVenue));
	}

	const mikuniVenue = await createMikuniVenue(feed);
	if (mikuniVenue) {
		venueMap.set(mikuniVenue.venueName, mergeVenueRecord(venueMap.get(mikuniVenue.venueName) ?? null, mikuniVenue));
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

	const tokonameVenue = await createTokonameVenue(feed);
	if (tokonameVenue) {
		venueMap.set(tokonameVenue.venueName, mergeVenueRecord(venueMap.get(tokonameVenue.venueName) ?? null, tokonameVenue));
	}

	const ashiyaVenue = await createAshiyaVenue(feed, date);
	if (ashiyaVenue) {
		venueMap.set(ashiyaVenue.venueName, mergeVenueRecord(venueMap.get(ashiyaVenue.venueName) ?? null, ashiyaVenue));
	}

	const kiryuVenue = await createKiryuVenue(feed, date);
	if (kiryuVenue) {
		venueMap.set(kiryuVenue.venueName, mergeVenueRecord(venueMap.get(kiryuVenue.venueName) ?? null, kiryuVenue));
	}

	const miyajimaVenue = await createMiyajimaVenue(feed, date);
	if (miyajimaVenue) {
		venueMap.set(miyajimaVenue.venueName, mergeVenueRecord(venueMap.get(miyajimaVenue.venueName) ?? null, miyajimaVenue));
	}

	const hamanakoVenue = await buildHamanakoVenueExtras(feed, date);
	if (hamanakoVenue) {
		venueMap.set(hamanakoVenue.venueName, mergeVenueRecord(venueMap.get(hamanakoVenue.venueName) ?? null, hamanakoVenue));
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
