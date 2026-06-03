import type {
	BoatExhibitionItem,
	BoatRaceItem,
	BoatRacerItem,
	BoatTodayVenueItem,
} from "./boatraceTypes";
import type { BoatVenueExtraRace, BoatVenueExtraVenue } from "./boatVenueExtrasFeed";
import {
	formatBoatExhibitionParticipationAlertLabel,
	resolveBoatExhibitionParticipationSummary,
} from "./boatExhibitionParticipation";
import {
	buildBoatVenueFeatureFullMaterial,
	buildBoatVenueUserInsightMaterial,
	type BoatVenueFeatureNote,
	type BoatVenueUserInsight,
} from "./boatVenueFeatures";

const toMaterialArray = <T,>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, T>);
	}

	return [];
};

const toDisplay = (value: string | number | undefined | null, fallback = "未取得") => {
	if (value === undefined || value === null) {
		return fallback;
	}

	const text = String(value).trim();
	if (!text || text.toLowerCase() === "undefined" || text.toLowerCase() === "null") {
		return fallback;
	}

	return text;
};

type MaterialRecord = Record<string, unknown>;

const isMaterialRecord = (value: unknown): value is MaterialRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toMaterialRecordArray = (value: unknown): MaterialRecord[] => toMaterialArray<MaterialRecord>(value).filter(isMaterialRecord);

const readMaterialString = (value: unknown): string => {
	if (typeof value === "number") {
		return String(value);
	}

	if (typeof value !== "string") {
		return "";
	}

	const text = value.trim();
	if (!text || text.toLowerCase() === "undefined" || text.toLowerCase() === "null") {
		return "";
	}

	return text;
};

const readMaterialNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const normalized = value.trim();
		if (!normalized) {
			return null;
		}

		const parsed = Number(normalized);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return null;
};

const getFrameLabel = (frameNo: number | null): string => (frameNo ? `${frameNo}号艇` : "-号艇");

const getCourseLabel = (course: unknown): string => {
	const courseNumber = readMaterialNumber(course);
	return courseNumber ? `${courseNumber}コース` : "-コース";
};

const isPlaceholderPlayerName = (value: string): boolean => /^枠\d+$/.test(value);

const buildRacerNameMap = (racers: BoatRacerItem[]) => new Map(racers.map((racer) => [Number(racer.frameNo), racer.name]));

const readOfficialBeforeInfo = (raceExtra: BoatVenueExtraRace | undefined): MaterialRecord | null =>
	isMaterialRecord(raceExtra?.officialBeforeInfo) ? raceExtra.officialBeforeInfo : null;

const readVenueWaterRecord = (value: unknown): MaterialRecord | null => (isMaterialRecord(value) ? value : null);

const readFirstMaterialString = (...values: unknown[]): string => {
	for (const value of values) {
		const text = readMaterialString(value);
		if (text) {
			return text;
		}
	}

	return "";
};

const formatWeatherUnit = (value: string, unit: string): string => {
	if (!value) {
		return "";
	}

	if (value.includes(unit)) {
		return value;
	}

	if (/^-?\d+(\.\d+)?$/.test(value)) {
		return `${value}${unit}`;
	}

	return value;
};

const readWeatherValue = (record: MaterialRecord | null, keys: string[], unit = ""): string => {
	if (!record) {
		return "";
	}

	const value = readFirstMaterialString(...keys.map((key) => record[key]));
	return unit ? formatWeatherUnit(value, unit) : value;
};

const isPlaceholderWeatherText = (value: string): boolean =>
	["確認中", "未取得", "未設定", "undefined", "null", "-"].includes(value.trim().toLowerCase());

const hasUsableWeatherRecord = (record: MaterialRecord): boolean => {
	const keys = [
		"weather",
		"weatherText",
		"condition",
		"conditionText",
		"temperature",
		"airTemperature",
		"temp",
		"airTemp",
		"waterTemperature",
		"waterTemp",
		"windDirection",
		"windDirectionText",
		"windDir",
		"wind",
		"windSpeed",
		"windVelocity",
		"windSpeedMps",
		"waveHeight",
		"wave",
		"waveCm",
	];

	return keys.some((key) => {
		const text = readMaterialString(record[key]);
		return text && !isPlaceholderWeatherText(text);
	});
};

const resolveWeatherRecord = (
	race: BoatRaceItem,
	venue: BoatTodayVenueItem,
	venueExtra?: BoatVenueExtraVenue | null,
	raceExtra?: BoatVenueExtraRace | null,
): MaterialRecord | null => {
	const raceRecord: MaterialRecord | null = isMaterialRecord(race) ? race as MaterialRecord : null;
	const venueRecord: MaterialRecord | null = isMaterialRecord(venue) ? venue as MaterialRecord : null;
	const raceExtraRecord = isMaterialRecord(raceExtra) ? raceExtra : null;
	const venueExtraRecord = isMaterialRecord(venueExtra) ? venueExtra : null;
	const officialBeforeInfo = isMaterialRecord(raceExtraRecord?.officialBeforeInfo) ? raceExtraRecord.officialBeforeInfo : null;

	const candidates = [
		raceExtraRecord?.weatherCondition,
		raceExtraRecord?.weatherActual,
		raceExtraRecord?.weather,
		raceExtraRecord?.condition,
		raceExtraRecord?.conditions,
		officialBeforeInfo?.weatherCondition,
		officialBeforeInfo?.weatherActual,
		officialBeforeInfo?.weather,
		venueExtraRecord?.weatherCondition,
		venueExtraRecord?.weatherActual,
		venueExtraRecord?.weather,
		venueExtraRecord?.condition,
		venueExtraRecord?.conditions,
		raceRecord?.weatherCondition,
		raceRecord?.weatherActual,
		raceRecord?.weather,
		raceRecord?.condition,
		raceRecord?.conditions,
		venueRecord?.weatherCondition,
		venueRecord?.weatherActual,
		venueRecord?.weather,
		venueRecord?.condition,
		venueRecord?.conditions,
	];

	let fallbackRecord: MaterialRecord | null = null;
	for (const candidate of candidates) {
		if (isMaterialRecord(candidate)) {
			fallbackRecord ??= candidate;
			if (hasUsableWeatherRecord(candidate)) {
				return candidate;
			}
		}
	}

	return fallbackRecord;
};

const buildWeatherMaterialBlock = (
	race: BoatRaceItem,
	venue: BoatTodayVenueItem,
	venueExtra?: BoatVenueExtraVenue | null,
	raceExtra?: BoatVenueExtraRace | null,
): string => {
	const record = resolveWeatherRecord(race, venue, venueExtra, raceExtra);
	const venueRecord = isMaterialRecord(venue) ? venue : null;
	const venueExtraRecord = isMaterialRecord(venueExtra) ? venueExtra : null;

	const weather = readWeatherValue(record, ["weather", "weatherText", "condition", "conditionText", "tenko"]);
	const temperature = readWeatherValue(record, ["temperature", "airTemperature", "temp", "airTemp"], "℃");
	const waterTemperature = readWeatherValue(record, ["waterTemperature", "waterTemp"], "℃");
	const windDirection = readWeatherValue(record, ["windDirection", "windDirectionText", "windDir", "wind"]);
	const windSpeed = readWeatherValue(record, ["windSpeed", "windVelocity", "windSpeedMps"], "m");
	const waveHeight = readWeatherValue(record, ["waveHeight", "wave", "waveCm"], "cm");
	const pressure = readWeatherValue(record, ["pressure", "airPressure"], "hPa");
	const humidity = readWeatherValue(record, ["humidity"], "%");
	const rainfall = readWeatherValue(record, ["rainfall", "rain"], "mm");
	const observedAt = readWeatherValue(record, ["observedAt", "measuredAt", "updatedAt", "time", "displayTime"]);
	const source =
		readWeatherValue(record, ["source", "sourceLabel"]) ||
		readMaterialString(venueExtraRecord?.source) ||
		readMaterialString(venueRecord?.source);

	return [
		"[C. 天気 / 風 / 波]",
		`天候: ${toDisplay(weather)}`,
		`気温: ${toDisplay(temperature)}`,
		`水温: ${toDisplay(waterTemperature)}`,
		`風向: ${toDisplay(windDirection)}`,
		`風速: ${toDisplay(windSpeed)}`,
		`波高: ${toDisplay(waveHeight)}`,
		`気圧: ${toDisplay(pressure)}`,
		`湿度: ${toDisplay(humidity)}`,
		`雨量: ${toDisplay(rainfall)}`,
		`表示時点: ${toDisplay(observedAt)}`,
		`データソース: ${toDisplay(source)}`,
	].join("\n");
};

const getMainFocus = (value: unknown): string[] =>
	Array.isArray(value) ? value.map((item) => readMaterialString(item)).filter(Boolean) : [];

const resolvePlayerName = (
	frameNo: number | null,
	racerNameMap: Map<number, string>,
	...candidates: unknown[]
): string => {
	if (frameNo) {
		const racerName = readMaterialString(racerNameMap.get(frameNo));
		if (racerName) {
			return racerName;
		}
	}

	for (const candidate of candidates) {
		const text = readMaterialString(candidate);
		if (text && !isPlaceholderPlayerName(text)) {
			return text;
		}
	}

	return frameNo ? `${frameNo}号艇` : "未取得";
};

const sortByFrameNo = (rows: MaterialRecord[]): MaterialRecord[] =>
	[...rows].sort((left, right) => (readMaterialNumber(left.frameNo) ?? 99) - (readMaterialNumber(right.frameNo) ?? 99));

const buildMissingBlock = () => "- 未取得";

const buildParticipationAlertMaterialBlock = (race: BoatRaceItem, raceExtra?: BoatVenueExtraRace | null): string => {
	const summary = resolveBoatExhibitionParticipationSummary(race, raceExtra);
	if (summary.alerts.length === 0 && !summary.raceLevelLabel) {
		return "- 展示不参加・欠場警告なし";
	}

	const lines = [
		summary.raceLevelLabel ? `- レース状態: ${summary.raceLevelLabel}` : "",
		...summary.alerts.map((alert) => {
			const label = formatBoatExhibitionParticipationAlertLabel(alert);
			const name = alert.racerName ? ` ${alert.racerName}` : "";
			const reason = alert.officialReasonText ? ` / ${alert.officialReasonText}` : "";
			const action = alert.excludeFromPrediction
				? "予想対象から除外"
				: alert.needsManualCheck
					? "出走可否を確認するまで買い目確定を避ける"
					: "欠場確定ではありません";
			const missing = alert.missingSources.length > 0 ? ` / 欠測: ${alert.missingSources.join(", ")}` : "";
			return `- ${alert.frameNo}号艇${name}: ${label} / ${action}${reason}${missing}`;
		}),
	].filter(Boolean);

	return lines.join("\n");
};

const buildOfficialBeforeInfoBlock = (racers: BoatRacerItem[], raceExtra?: BoatVenueExtraRace | null) => {
	const officialBeforeInfo = readOfficialBeforeInfo(raceExtra ?? undefined);
	const exhibitionRows = sortByFrameNo(toMaterialRecordArray(officialBeforeInfo?.exhibitionRows));
	if (exhibitionRows.length === 0) {
		return buildMissingBlock();
	}

	const racerNameMap = buildRacerNameMap(racers);
	const scoreQuickLookRows = new Map(
		sortByFrameNo(toMaterialRecordArray(officialBeforeInfo?.scoreQuickLook)).map((row) => [readMaterialNumber(row.frameNo) ?? -1, row]),
	);

	return exhibitionRows
		.map((row) => {
			const frameNo = readMaterialNumber(row.frameNo);
			const scoreRow = frameNo ? scoreQuickLookRows.get(frameNo) : null;
			const playerName = resolvePlayerName(frameNo, racerNameMap, scoreRow?.playerName, row.playerName, row.name);
			const partsExchange = readMaterialString(row.partsExchange) || readMaterialString(row.memo);

			return [
				`- ${getFrameLabel(frameNo)} ${playerName}`,
				`展示タイム ${toDisplay(readMaterialString(row.exhibitionTime), "-")}`,
				`チルト ${toDisplay(readMaterialString(row.tilt), "-")}`,
				`進入 ${toDisplay(readMaterialString(row.course), "-")}`,
				`公式ST ${toDisplay(readMaterialString(row.startTiming), "-")}`,
				`部品交換 ${toDisplay(partsExchange, "-")}`,
			].join(" ");
		})
		.join("\n");
};

const buildVenueStartExhibitionBlock = (racers: BoatRacerItem[], raceExtra?: BoatVenueExtraRace | null) => {
	const officialBeforeInfo = readOfficialBeforeInfo(raceExtra ?? undefined);
	const officialExhibitionRows = sortByFrameNo(toMaterialRecordArray(officialBeforeInfo?.exhibitionRows));
	const officialStartRows = sortByFrameNo(toMaterialRecordArray(officialBeforeInfo?.startExhibition));
	const venueStartRows = toMaterialRecordArray(raceExtra?.startExhibition);
	const sourceRows = venueStartRows.length > 0 ? venueStartRows : officialStartRows;

	if (sourceRows.length === 0) {
		return buildMissingBlock();
	}

	const racerNameMap = buildRacerNameMap(racers);
	const officialExhibitionByFrame = new Map(officialExhibitionRows.map((row) => [readMaterialNumber(row.frameNo) ?? -1, row]));
	const officialStartByFrame = new Map(officialStartRows.map((row) => [readMaterialNumber(row.frameNo) ?? -1, row]));

	return [...sourceRows]
		.sort((left, right) => {
			const leftCourse = readMaterialNumber(left.course) ?? readMaterialNumber(left.courseNo) ?? readMaterialNumber(left.frameNo) ?? 99;
			const rightCourse = readMaterialNumber(right.course) ?? readMaterialNumber(right.courseNo) ?? readMaterialNumber(right.frameNo) ?? 99;
			return leftCourse - rightCourse;
		})
		.map((row) => {
			const frameNo = readMaterialNumber(row.frameNo);
			const course = readMaterialNumber(row.course) ?? readMaterialNumber(row.courseNo) ?? frameNo;
			const officialExhibition = frameNo ? officialExhibitionByFrame.get(frameNo) : null;
			const officialStart = frameNo ? officialStartByFrame.get(frameNo) : null;
			const playerName = resolvePlayerName(frameNo, racerNameMap, row.playerName, officialExhibition?.playerName);
			const currentAverageStart = readMaterialString(row.currentAverageStart) || readMaterialString(row.averageStart);

			return [
				`- ${getCourseLabel(course)} ${getFrameLabel(frameNo)} ${playerName}`,
				`ST ${toDisplay(readMaterialString(row.startTiming), "-")}`,
				`今節平均ST ${toDisplay(currentAverageStart, "-")}`,
				`進入 ${toDisplay(String(course ?? ""), "-")}`,
				`展示ST ${toDisplay(readMaterialString(officialExhibition?.startTiming), "-")}`,
				`公式ST ${toDisplay(readMaterialString(officialStart?.startTiming) || readMaterialString(officialExhibition?.startTiming), "-")}`,
			].join(" ");
		})
		.join("\n");
};

const buildScoreQuickLookBlock = (racers: BoatRacerItem[], raceExtra?: BoatVenueExtraRace | null) => {
	const officialBeforeInfo = readOfficialBeforeInfo(raceExtra ?? undefined);
	const scoreQuickLookRows = sortByFrameNo(toMaterialRecordArray(officialBeforeInfo?.scoreQuickLook));
	if (scoreQuickLookRows.length === 0) {
		return buildMissingBlock();
	}

	const racerNameMap = buildRacerNameMap(racers);
	const abilityIndexByFrame = new Map(
		sortByFrameNo(toMaterialRecordArray(raceExtra?.abilityIndex)).map((row) => [readMaterialNumber(row.frameNo) ?? -1, row]),
	);

	return scoreQuickLookRows
		.map((row) => {
			const frameNo = readMaterialNumber(row.frameNo);
			const playerName = resolvePlayerName(frameNo, racerNameMap, row.playerName, row.name);
			const abilityIndex = frameNo ? abilityIndexByFrame.get(frameNo) : null;
			const extras = [
				readMaterialString(abilityIndex?.abilityValue) ? `能力指数 ${readMaterialString(abilityIndex?.abilityValue)}` : "",
				readMaterialString(abilityIndex?.frameCompatibility) ? `枠相性 ${readMaterialString(abilityIndex?.frameCompatibility)}` : "",
				readMaterialString(abilityIndex?.startPower) ? `ST力 ${readMaterialString(abilityIndex?.startPower)}` : "",
			].filter(Boolean);

			return [
				`- ${getFrameLabel(frameNo)} ${playerName}`,
				`全国勝率 ${toDisplay(readMaterialString(row.winRate), "-")}`,
				`2連率 ${toDisplay(readMaterialString(row.secondRate), "-")}`,
				`当地勝率 ${toDisplay(readMaterialString(row.localWinRate), "-")}`,
				`当地2連率 ${toDisplay(readMaterialString(row.localSecondRate), "-")}`,
				`モーターNo ${toDisplay(readMaterialString(row.motorNo), "-")}`,
				`モーター2連率 ${toDisplay(readMaterialString(row.motorSecondRate), "-")}`,
				...extras,
			].join(" / ");
		})
		.join("\n");
};

const buildVenueRecordDetailsBlock = (racers: BoatRacerItem[], raceExtra?: BoatVenueExtraRace | null) => {
	const racerNameMap = buildRacerNameMap(racers);
	const readArrayText = (value: unknown) => Array.isArray(value)
		? value.map((item) => readMaterialString(item)).filter(Boolean).join(" ")
		: readMaterialString(value);
	const renderRows = (label: string, key: string, formatter: (row: MaterialRecord) => string) => {
		const rows = sortByFrameNo(toMaterialRecordArray((raceExtra as MaterialRecord | null | undefined)?.[key]));
		if (rows.length === 0) {
			return "";
		}
		return [
			`${label}:`,
			...rows.map((row) => {
				const frameNo = readMaterialNumber(row.frameNo);
				const playerName = resolvePlayerName(frameNo, racerNameMap, row.playerName, row.name);
				return `- ${getFrameLabel(frameNo)} ${playerName} / ${formatter(row)}`;
			}),
		].join("\n");
	};
	const blocks = [
		renderRows("\u7bc0\u9593\u6210\u7e3e", "sectionResults", (row) => [
			readArrayText(row.raceNumbers) ? `R ${readArrayText(row.raceNumbers)}` : "",
			readArrayText(row.courses) ? `\u9032\u5165 ${readArrayText(row.courses)}` : "",
			readArrayText(row.startTimings) ? `ST ${readArrayText(row.startTimings)}` : "",
			readArrayText(row.finishOrders) ? `\u7740 ${readArrayText(row.finishOrders)}` : "",
		].filter(Boolean).join(" / ")),
		renderRows("\u5168\u56fd\u904e\u53bb3\u7bc0", "nationalRecent3", (row) =>
			toMaterialRecordArray(row.histories)
				.map((history) => [readMaterialString(history.venueName), readMaterialString(history.grade), readMaterialString(history.dateRange), readMaterialString(history.results)].filter(Boolean).join(" "))
				.filter(Boolean)
				.join(" / "),
		),
		renderRows("\u5f53\u5730\u904e\u53bb3\u7bc0", "localRecent3", (row) =>
			toMaterialRecordArray(row.histories)
				.map((history) => [readMaterialString(history.venueName), readMaterialString(history.grade), readMaterialString(history.dateRange), readMaterialString(history.results)].filter(Boolean).join(" "))
				.filter(Boolean)
				.join(" / "),
		),
		renderRows("\u67a0\u756a\u5225\u904e\u53bb10\u8d70", "frameLast10", (row) => [
			readArrayText(row.courseHistory) ? `\u9032\u5165 ${readArrayText(row.courseHistory)}` : "",
			readArrayText(row.startTimingHistory) ? `ST ${readArrayText(row.startTimingHistory)}` : "",
			readArrayText(row.finishHistory) ? `\u7740 ${readArrayText(row.finishHistory)}` : "",
			readMaterialString(row.frameWinRate) ? `\u7387 ${readMaterialString(row.frameWinRate)}` : "",
			readMaterialString(row.frameAverageStart) ? `AvgST ${readMaterialString(row.frameAverageStart)}` : "",
		].filter(Boolean).join(" / ")),
		renderRows("\u5f97\u70b9\u7387\u65e9\u898b", "scoreRateGuide", (row) => [
			readMaterialString(row.rank) ? `\u9806\u4f4d ${readMaterialString(row.rank)}` : "",
			readMaterialString(row.scoreRate) ? `\u5f97\u70b9\u7387 ${readMaterialString(row.scoreRate)}` : "",
			readMaterialString(row.score) ? `\u5f97\u70b9 ${readMaterialString(row.score)}` : "",
		].filter(Boolean).join(" / ")),
	].filter(Boolean);

	return blocks.length > 0 ? blocks.join("\n\n") : buildMissingBlock();
};

const buildOriginalExhibitionBlock = (racers: BoatRacerItem[], raceExtra?: BoatVenueExtraRace | null) => {
	const originalExhibitionRows = sortByFrameNo(toMaterialRecordArray(raceExtra?.originalExhibition));
	if (originalExhibitionRows.length === 0) {
		return buildMissingBlock();
	}

	const racerNameMap = buildRacerNameMap(racers);
	const abilityIndexByFrame = new Map(
		sortByFrameNo(toMaterialRecordArray(raceExtra?.abilityIndex)).map((row) => [readMaterialNumber(row.frameNo) ?? -1, row]),
	);

	return originalExhibitionRows
		.map((row) => {
			const frameNo = readMaterialNumber(row.frameNo);
			const playerName = resolvePlayerName(frameNo, racerNameMap, row.playerName, row.name);
			const abilityIndex = frameNo ? abilityIndexByFrame.get(frameNo) : null;
			const extras = [
				readMaterialString(row.exhibitionEvaluation) ? `評価 ${readMaterialString(row.exhibitionEvaluation)}` : "",
				readMaterialString(abilityIndex?.abilityValue) ? `能力指数 ${readMaterialString(abilityIndex?.abilityValue)}` : "",
			].filter(Boolean);

			return [
				`- ${getFrameLabel(frameNo)} ${playerName}`,
				`展示 ${toDisplay(readMaterialString(row.exhibitionTime), "-")}`,
				`一周 ${toDisplay(readMaterialString(row.oneLapTime), "-")}`,
				`回り足 ${toDisplay(readMaterialString(row.turnTime), "-")}`,
				`直線 ${toDisplay(readMaterialString(row.straightTime), "-")}`,
				`チルト ${toDisplay(readMaterialString(row.tilt), "-")}`,
				...extras,
			].join(" / ");
		})
		.join("\n");
};

const buildMotorSummaryBlock = (racers: BoatRacerItem[], raceExtra?: BoatVenueExtraRace | null) => {
	const motorSummaryRows = sortByFrameNo(toMaterialRecordArray(raceExtra?.motorSummary));
	if (motorSummaryRows.length === 0) {
		return buildMissingBlock();
	}

	const racerNameMap = buildRacerNameMap(racers);

	return motorSummaryRows
		.map((row) => {
			const frameNo = readMaterialNumber(row.frameNo);
			const playerName = resolvePlayerName(frameNo, racerNameMap, row.playerName, row.name);
			const motorRate = readMaterialString(row.motorSecondRate) || readMaterialString(row.motorGrade);
			const evaluation = readMaterialString(row.evaluation) || readMaterialString(row.motorGrade) || readMaterialString(row.rankLabel);
			const memoParts = [
				readMaterialString(row.comment),
				readMaterialString(row.recentResults) ? `最近成績 ${readMaterialString(row.recentResults)}` : "",
				readMaterialString(row.previousUser) ? `前操者 ${readMaterialString(row.previousUser)}` : "",
				readMaterialString(row.memo),
			].filter(Boolean);

			return [
				`- ${getFrameLabel(frameNo)} ${playerName}`,
				`モーターNo ${toDisplay(readMaterialString(row.motorNo), "-")}`,
				`2連率 ${toDisplay(motorRate, "-")}`,
				`評価 ${toDisplay(evaluation, "-")}`,
				`メモ ${toDisplay(memoParts.join(" / "), "-")}`,
			].join(" / ");
		})
		.join("\n");
};

const buildWaterAndCommentsBlock = (
	racers: BoatRacerItem[],
	venueExtra?: BoatVenueExtraVenue | null,
	raceExtra?: BoatVenueExtraRace | null,
) => {
	const tideInfo = readVenueWaterRecord(raceExtra?.tideInfo) ?? readVenueWaterRecord(venueExtra?.tideInfo);
	const waterSurfaceInfo =
		readVenueWaterRecord(raceExtra?.waterSurfaceInfo) ??
		readVenueWaterRecord((raceExtra as MaterialRecord | null | undefined)?.waterSurface) ??
		readVenueWaterRecord(venueExtra?.waterSurfaceInfo) ??
		readVenueWaterRecord((venueExtra as MaterialRecord | null | undefined)?.waterSurface);
	const venuePrediction = readVenueWaterRecord(raceExtra?.venuePrediction);
	const preRacePrediction = readVenueWaterRecord((raceExtra as MaterialRecord | null | undefined)?.preRacePrediction);
	const racerComments = sortByFrameNo(toMaterialRecordArray(raceExtra?.racerComments));
	const raceWarnings = toMaterialArray<string>((raceExtra as MaterialRecord | null | undefined)?.warnings).map((item) => readMaterialString(item)).filter(Boolean);
	const venueWarnings = toMaterialArray<string>((venueExtra as MaterialRecord | null | undefined)?.warnings).map((item) => readMaterialString(item)).filter(Boolean);
	const racerNameMap = buildRacerNameMap(racers);

	const tideText = [
		readMaterialString(tideInfo?.dayLabel),
		readMaterialString(tideInfo?.date),
		readMaterialString(tideInfo?.highTideTime) ? `満潮 ${readMaterialString(tideInfo?.highTideTime)}` : "",
		readMaterialString(tideInfo?.lowTideTime) ? `干潮 ${readMaterialString(tideInfo?.lowTideTime)}` : "",
		readMaterialString(tideInfo?.tideType) ? `潮回り ${readMaterialString(tideInfo?.tideType)}` : "",
	]
		.filter(Boolean)
		.join(" / ");

	const waterText = [
		readMaterialString(waterSurfaceInfo?.surfaceSummary),
		readMaterialString(waterSurfaceInfo?.featureSummary),
		readMaterialString(waterSurfaceInfo?.courseSummary),
	]
		.filter(Boolean)
		.join(" / ");

	const venueComment = [
		readMaterialString(venuePrediction?.comment),
		readMaterialString(venuePrediction?.confidence) ? `信頼度 ${readMaterialString(venuePrediction?.confidence)}` : "",
		getMainFocus(venuePrediction?.mainFocus).length > 0 ? `注目 ${getMainFocus(venuePrediction?.mainFocus).join("、")}` : "",
		readMaterialString(preRacePrediction?.focus) ? `直前中心 ${readMaterialString(preRacePrediction?.focus)}` : "",
		readMaterialString(preRacePrediction?.hole) ? `直前穴 ${readMaterialString(preRacePrediction?.hole)}` : "",
		Array.isArray(preRacePrediction?.recommendedBets) && preRacePrediction.recommendedBets.length > 0 ? `直前買い目 ${preRacePrediction.recommendedBets.map((item) => readMaterialString(item)).filter(Boolean).join("、")}` : "",
		readMaterialString(preRacePrediction?.comment),
		readMaterialString(raceExtra?.memo),
		readMaterialString(venueExtra?.note),
	]
		.filter(Boolean)
		.join(" / ");

	const warningText = [...raceWarnings, ...venueWarnings].join(" / ");

	const commentLines = racerComments.map((row) => {
		const frameNo = readMaterialNumber(row.frameNo);
		const playerName = resolvePlayerName(frameNo, racerNameMap, row.playerName, row.name);
		const comment = [readMaterialString(row.comment), readMaterialString(row.motorComment)].filter(Boolean).join(" / ");
		return `  - ${getFrameLabel(frameNo)} ${playerName}: ${toDisplay(comment, "-")}`;
	});

	if (!tideText && !waterText && !venueComment && commentLines.length === 0) {
		return buildMissingBlock();
	}

	return [
		`- 潮汐: ${toDisplay(tideText, "未取得")}`,
		`- 水面傾向: ${toDisplay(waterText, "未取得")}`,
		`- 会場コメント: ${toDisplay(venueComment, "未取得")}`,
		`- 取得注意: ${toDisplay(warningText, "未取得")}`,
		commentLines.length > 0 ? `- 選手コメント:\n${commentLines.join("\n")}` : "- 選手コメント: 未取得",
	].join("\n");
};

const extraKeyLabels: Record<string, string> = {
	biwakoSeriesResults: "びわこ節間成績",
	biwakoFramePast10: "びわこ枠別過去10走",
	biwakoRacerCourseStats: "びわこ選手別進入コース成績",
	biwakoCurrentSeriesCourseStats: "びわこ今節コース傾向",
	biwakoCurrentSeriesWinningMethods: "びわこ今節決まり手",
	biwakoScoreRanking: "びわこ得点率ランキング",
	biwakoScoreRateGuide: "びわこ得点率早見",
	biwakoResultList: "びわこ今節結果一覧",

	tsuSeriesResults: "津節間成績",
	tsuNationalRecent3: "津全国直近3節",
	tsuLocalRecent3: "津当地直近3節",
	tsuFramePast10: "津枠別過去10走",
	tsuScoreRateGuide: "津得点率早見",

	wakamatsuSeriesResults: "若松節間成績",
	wakamatsuCourseStats: "若松コース成績",
	wakamatsuNationalRecent3: "若松全国直近3節",
	wakamatsuLocalRecent3: "若松当地直近3節",
	wakamatsuFramePast10: "若松枠別過去10走",
	wakamatsuScoreRateGuide: "若松得点率早見",
	wakamatsuMotorHistory: "若松モーター履歴",

	mikuniScoreRateGuide: "三国得点率早見",
	mikuniCourseResults: "三国進入コース別成績",
	mikuniMotorHistory: "三国モーター履歴",

	fukuokaSeriesResults: "福岡節間成績",
	fukuokaRacerComments: "福岡選手コメント",
	fukuokaFramePast10: "福岡枠別過去10走",
	fukuokaScoreRateGuide: "福岡得点率早見",
	fukuokaMotorEvaluation: "福岡モーター評価",

	kojimaSeriesResults: "児島節間成績",
	kojimaRecentResults: "児島直近成績",
	kojimaCourseStats: "児島コース成績",
	kojimaMotorStats: "児島モーター成績",
	kojimaFrameStats: "児島枠別成績",
	kojimaScoreRateGuide: "児島得点率早見",

	tamagawaSeriesResults: "多摩川節間成績",
	tamagawaFramePast10: "多摩川枠別過去10走",
	tamagawaMotorHistory: "多摩川モーター履歴",
	tamagawaScoreRateGuide: "多摩川得点率早見",

	omuraPreviousDayResults: "大村前日成績",
	omuraNationalFrameStats: "大村全国枠別成績",
	omuraFrameLast10: "大村枠別直近10走",
	omuraRacerCommentsMotor: "大村コメント・モーター",

	narutoRacerPerformance: "鳴門選手成績",
	karatsuNationalRecent5: "唐津全国最近5節成績",
	karatsuRacerCourseStats: "唐津進入コース別選手成績",
	karatsuCurrentSeriesCourseStats: "唐津今節進入コース別成績",
	karatsuCurrentSeriesWinningMethods: "唐津今節決まり手",
	karatsuScoreRanking: "唐津得点率ランキング",
	karatsuTimerank: "唐津前検タイム・抽選結果",
	karatsuAllRacerComments: "唐津全選手コメント・モーター評価",
	karatsuMarutoku: "唐津マル得情報",
	karatsuMotorData: "唐津モーターデータ",
	karatsuBoatData: "唐津ボートデータ",
	motorLotteryAndPrecheck: "宮島前検タイム・抽選結果",
	scoreRanking: "宮島予選得点率ランキング",
	frameCourseAcquisitionRates: "宮島枠番別コース取得率",
	courseSummary: "宮島コース別傾向",

	originalExhibition: "会場独自展示",
	motorSummary: "モーター概要",
	abilityIndex: "能力指数",
	racerComments: "選手コメント",
	venuePrediction: "会場予想コメント",
	waterSurfaceInfo: "水面情報",
	tideInfo: "潮汐情報",
};

const recentPerformanceExtraKeys = [
	"biwakoSeriesResults",
	"biwakoScoreRateGuide",
	"biwakoScoreRanking",
	"biwakoCurrentSeriesCourseStats",
	"biwakoCurrentSeriesWinningMethods",
	"biwakoResultList",
	"tsuSeriesResults",
	"tsuNationalRecent3",
	"tsuLocalRecent3",
	"tsuScoreRateGuide",
	"wakamatsuSeriesResults",
	"wakamatsuNationalRecent3",
	"wakamatsuLocalRecent3",
	"wakamatsuScoreRateGuide",
	"mikuniScoreRateGuide",
	"fukuokaSeriesResults",
	"fukuokaScoreRateGuide",
	"kojimaSeriesResults",
	"kojimaRecentResults",
	"kojimaScoreRateGuide",
	"tamagawaSeriesResults",
	"tamagawaScoreRateGuide",
	"omuraPreviousDayResults",
	"narutoRacerPerformance",
	"karatsuNationalRecent5",
	"karatsuCurrentSeriesCourseStats",
	"karatsuCurrentSeriesWinningMethods",
	"karatsuScoreRanking",
	"miyajimaScoreRateGuide",
	"miyajimaSectionResults",
	"miyajimaNationalRecent3",
	"miyajimaLocalRecent3",
	"scoreRanking",
];

const frameCourseExtraKeys = [
	"biwakoFramePast10",
	"biwakoRacerCourseStats",
	"tsuFramePast10",
	"wakamatsuCourseStats",
	"wakamatsuFramePast10",
	"mikuniCourseResults",
	"fukuokaFramePast10",
	"kojimaCourseStats",
	"kojimaFrameStats",
	"tamagawaFramePast10",
	"omuraNationalFrameStats",
	"omuraFrameLast10",
	"karatsuRacerCourseStats",
	"miyajimaFrameLast10",
	"miyajimaCourseResults",
	"frameCourseAcquisitionRates",
	"courseSummary",
];

const motorExtraKeys = [
	"wakamatsuMotorHistory",
	"mikuniMotorHistory",
	"fukuokaMotorEvaluation",
	"kojimaMotorStats",
	"tamagawaMotorHistory",
	"omuraRacerCommentsMotor",
	"karatsuTimerank",
	"karatsuAllRacerComments",
	"karatsuMarutoku",
	"karatsuMotorData",
	"karatsuBoatData",
	"miyajimaMotorHistory",
	"motorLotteryAndPrecheck",
	"motorSummary",
	"abilityIndex",
];

const isScalarMaterialValue = (value: unknown): value is string | number | boolean => {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
};

const formatGenericExtraRow = (row: MaterialRecord, racerNameMap: Map<number, string>): string => {
	const frameNo = readMaterialNumber(row.frameNo ?? row.frame ?? row.lane ?? row.boatNumber);
	const playerName = resolvePlayerName(frameNo, racerNameMap, row.playerName, row.name, row.racerName, row.boatRacerName);

	const preferredPairs = [
		["登録", row.registrationNo],
		["級別", row.className],
		["支部", row.branch],
		["成績", row.result ?? row.results ?? row.seriesResult ?? row.finish],
		["着順", row.rank ?? row.order ?? row.finishOrder],
		["日", row.dayLabel],
		["ST", row.startTiming ?? row.st ?? row.averageStart ?? row.avgSt],
		["scoreRate", row.scoreRate],
		["scoreRank", row.scoreRank],
		["after1", row.scoreAfterFirst],
		["after2", row.scoreAfterSecond],
		["after3", row.scoreAfterThird],
		["border", row.scoreBorder],
		["entryRate", row.entryRate],
		["avgST", row.averageStartTiming],
		["firstRate", row.firstRate],
		["exacta", row.exacta],
		["exactaPayout", row.exactaPayout],
		["trifecta", row.trifecta],
		["trifectaPayout", row.trifectaPayout],
		["勝率", row.winRate ?? row.localWinRate],
		["2連率", row.secondRate ?? row.twoRate ?? row.localSecondRate],
		["コース", row.course ?? row.entryCourse ?? row.approachCourse],
		["カテゴリ", row.category],
		["期間", row.period],
		["モーター", row.motorNo ?? row.motorNumber],
		["M2連率", row.motorSecondRate ?? row.motorTwoRate],
		["素性", row.motorNature ?? row.motorNatureEvaluation],
		["前検", row.precheckTime],
		["ボート", row.boatNo],
		["B2連率", row.boatSecondRate],
		["展示", row.exhibitionTime ?? row.displayTime],
		["一周", row.lapTime ?? row.oneLapTime],
		["回り足", row.turnTime ?? row.turningTime],
		["直線", row.straightTime],
		["評価", row.evaluation ?? row.rankText ?? row.mark],
		["コメント", row.comment ?? row.memo ?? row.motorComment],
		["メモ", row.note],
	];

	const parts = preferredPairs
		.map(([label, value]) => {
			const text = readMaterialString(value);
			return text ? `${label}:${text}` : "";
		})
		.filter(Boolean);

	if (parts.length === 0) {
		const genericParts = Object.entries(row)
			.filter(([key, value]) => {
				if (["source", "status", "sourceType", "raceNo", "frameNo", "frame", "lane", "boatNumber", "playerName", "name", "racerName", "boatRacerName"].includes(key)) {
					return false;
				}

				return isScalarMaterialValue(value) && Boolean(readMaterialString(value));
			})
			.slice(0, 7)
			.map(([key, value]) => `${key}:${readMaterialString(value)}`);

		parts.push(...genericParts);
	}

	const contextualLabel = [
		readMaterialString(row.racerName),
		readMaterialString(row.playerName),
		readMaterialString(row.name),
		readMaterialString(row.dayLabel) ? `${readMaterialString(row.dayLabel)}日目` : "",
		readMaterialString(row.course) ? `${readMaterialString(row.course)}コース` : "",
		readMaterialString(row.category),
		readMaterialString(row.motorNo) ? `モーター${readMaterialString(row.motorNo)}` : "",
		readMaterialString(row.boatNo) ? `ボート${readMaterialString(row.boatNo)}` : "",
	]
		.filter(Boolean)
		.join(" ");
	const label = frameNo ? `${getFrameLabel(frameNo)} ${playerName}` : contextualLabel || playerName || "未取得";

	return `- ${label}: ${parts.length > 0 ? parts.join(" / ") : "詳細未取得"}`;
};

const readExtraValueRows = (value: unknown): MaterialRecord[] => {
	if (Array.isArray(value)) {
		return value.filter(isMaterialRecord);
	}

	if (isMaterialRecord(value)) {
		return Object.values(value).filter(isMaterialRecord);
	}

	return [];
};

const buildExtraCollectionBlock = (
	racers: BoatRacerItem[],
	venueExtra: BoatVenueExtraVenue | null | undefined,
	raceExtra: BoatVenueExtraRace | null | undefined,
	keys: string[],
) => {
	const racerNameMap = buildRacerNameMap(racers);
	const lines: string[] = [];

	for (const key of keys) {
		const raceRows = readExtraValueRows((raceExtra as MaterialRecord | null | undefined)?.[key]);
		const venueRows = readExtraValueRows((venueExtra as MaterialRecord | null | undefined)?.[key]);
		const rows = raceRows.length > 0 ? raceRows : venueRows;

		if (rows.length === 0) {
			continue;
		}

		lines.push(`■ ${extraKeyLabels[key] ?? key}`);
		lines.push(...rows.slice(0, 8).map((row) => formatGenericExtraRow(row, racerNameMap)));
	}

	if (lines.length === 0) {
		return buildMissingBlock();
	}

	return lines.join("\n");
};

const buildRecentPerformanceBlock = (
	racers: BoatRacerItem[],
	venueExtra?: BoatVenueExtraVenue | null,
	raceExtra?: BoatVenueExtraRace | null,
) => buildExtraCollectionBlock(racers, venueExtra, raceExtra, recentPerformanceExtraKeys);

const buildFrameCourseTrendBlock = (
	racers: BoatRacerItem[],
	venueExtra?: BoatVenueExtraVenue | null,
	raceExtra?: BoatVenueExtraRace | null,
) => buildExtraCollectionBlock(racers, venueExtra, raceExtra, frameCourseExtraKeys);

const buildMotorHistoryBlock = (
	racers: BoatRacerItem[],
	venueExtra?: BoatVenueExtraVenue | null,
	raceExtra?: BoatVenueExtraRace | null,
) => buildExtraCollectionBlock(racers, venueExtra, raceExtra, motorExtraKeys);

const evaluationMap: Record<string, string> = {
	good: "良",
	normal: "普通",
	bad: "注意",
	unknown: "未評価",
};

const buildRacerBlock = (racer: BoatRacerItem) => {
	const flText = `${racer.fCount ?? "-"}/${racer.lCount ?? "-"}`;

	return [
		`### ${racer.frameNo}号艇 ${racer.name}`,
		`- 支部: ${toDisplay(racer.branch)}`,
		`- 級別: ${toDisplay(racer.class)}`,
		`- 年齢: ${toDisplay(racer.age)}`,
		`- 体重: ${toDisplay(racer.weight)}`,
		`- F/L: ${flText}`,
		`- 平均ST: ${toDisplay(racer.averageStart)}`,
		`- 勝率: ${toDisplay(racer.winRate)}`,
		`- 2連率: ${toDisplay(racer.secondRate)}`,
		`- 3連率: ${toDisplay(racer.thirdRate)}`,
		`- モーター: ${toDisplay(racer.motorNo)}`,
		`- モーター2連率: ${toDisplay(racer.motorSecondRate)}`,
		`- ボート: ${toDisplay(racer.boatMotorNo)}`,
		`- ボート2連率: ${toDisplay(racer.boatSecondRate)}`,
		`- コメント: ${toDisplay(racer.comment)}`,
	].join("\n");
};

const buildExhibitionBlock = (item: BoatExhibitionItem) => [
	`### ${item.frameNo}号艇`,
	`- 展示タイム: ${toDisplay(item.exhibitionTime)}`,
	`- チルト: ${toDisplay(item.tilt)}`,
	`- 展示ST: ${toDisplay(item.startTiming)}`,
	`- 進入: ${toDisplay(item.course)}`,
	`- 評価: ${evaluationMap[item.evaluation ?? "unknown"]}`,
	`- メモ: ${toDisplay(item.memo)}`,
].join("\n");

const resolvePredictionExhibitions = (
	race: BoatRaceItem,
	raceExtra?: BoatVenueExtraRace | null,
): BoatExhibitionItem[] => {
	const raceRows = toMaterialArray<BoatExhibitionItem>((race as { exhibitions?: unknown }).exhibitions);
	if (raceRows.length > 0) {
		return raceRows;
	}

	const officialBeforeInfo = readOfficialBeforeInfo(raceExtra ?? undefined);
	const officialRows = toMaterialRecordArray(officialBeforeInfo?.exhibitionRows);
	const originalRows = toMaterialRecordArray(raceExtra?.originalExhibition);
	const startRows = toMaterialRecordArray(raceExtra?.startExhibition);

	const byFrame = new Map<number, MaterialRecord>();

	const mergeRow = (row: MaterialRecord) => {
		const frameNo = readMaterialNumber(row.frameNo);
		if (!frameNo) {
			return;
		}

		const current = byFrame.get(frameNo) ?? { frameNo };
		byFrame.set(frameNo, { ...current, ...row });
	};

	officialRows.forEach(mergeRow);
	originalRows.forEach(mergeRow);
	startRows.forEach(mergeRow);

	return sortByFrameNo([...byFrame.values()]).map((row) => {
		const lapTime = readFirstMaterialString(row.lapTime, row.oneLapTime, row.oneRoundTime, row.halfLapTime);
		const turnTime = readFirstMaterialString(row.turnTime, row.mawariashi);
		const straightTime = readFirstMaterialString(row.straightTime);
		const weight = readFirstMaterialString(row.weight);
		const adjustment = readFirstMaterialString(row.adjustment);
		const memo = [
			lapTime ? `一周/周回 ${lapTime}` : "",
			turnTime ? `回り足 ${turnTime}` : "",
			straightTime ? `直線 ${straightTime}` : "",
			weight ? `体重 ${weight}` : "",
			adjustment ? `調整 ${adjustment}` : "",
		].filter(Boolean).join(" / ");

		return {
			frameNo: (readMaterialNumber(row.frameNo) ?? 0) as BoatExhibitionItem["frameNo"],
			exhibitionTime: readFirstMaterialString(row.exhibitionTime, row.displayTime),
			tilt: readFirstMaterialString(row.tilt),
			startTiming: readFirstMaterialString(row.startTiming, row.st, row.officialStart),
			course: readFirstMaterialString(row.course, row.courseNo, row.frameNo),
			evaluation: readFirstMaterialString(row.exhibitionEvaluation, row.evaluation) as BoatExhibitionItem["evaluation"],
			memo,
		};
	});
};

const readFirstRecord = (...values: unknown[]): MaterialRecord | null => {
	for (const value of values) {
		if (isMaterialRecord(value)) {
			return value;
		}
	}

	return null;
};

const formatOddsRows = (title: string, rows: MaterialRecord[], limit = 5): string[] => {
	const validRows = rows
		.filter((row) => Boolean(readMaterialString(row.combination)) && Boolean(readMaterialString(row.odds)))
		.slice(0, limit);

	if (validRows.length === 0) {
		return [];
	}

	return [
		`${title}:`,
		...validRows.map((row) => {
			const popularity = readMaterialString(row.popularity);
			return `- ${toDisplay(readMaterialString(row.combination), "-")} ${toDisplay(readMaterialString(row.odds), "-")}倍${popularity ? ` 人気:${popularity}` : ""}`;
		}),
	];
};

const buildOddsBlock = (race: BoatRaceItem) => {
	const raceRecord = race as MaterialRecord;
	const oddsRecord = readFirstRecord(raceRecord.oddsPreview);

	const lines = [
		...formatOddsRows("3連単上位", toMaterialRecordArray(oddsRecord?.trifectaTop)),
		...formatOddsRows("2連単上位", toMaterialRecordArray(oddsRecord?.exactaTop)),
		...formatOddsRows("2連複上位", toMaterialRecordArray(oddsRecord?.quinellaTop)),
	];

	if (lines.length === 0) {
		return "オッズ情報は未取得";
	}

	return lines.join("\n");
};

const buildStartExhibitionBlock = (race: BoatRaceItem) => {
	const startExhibition = toMaterialArray<NonNullable<BoatRaceItem["startExhibition"]>[number]>(
		(race as { startExhibition?: unknown }).startExhibition,
	);

	if (startExhibition.length > 0) {
		const sortedStartExhibition = [...startExhibition].sort(
			(left, right) => Number(left.course ?? 99) - Number(right.course ?? 99),
		);

		const formation = sortedStartExhibition.map((item) => item.frameNo).join("-") || "未取得";

		const slow =
			sortedStartExhibition
				.filter((item) => Number(item.course) <= 3)
				.map((item) => item.frameNo)
				.join("-") || "未取得";

		const dash =
			sortedStartExhibition
				.filter((item) => Number(item.course) > 3)
				.map((item) => item.frameNo)
				.join("-") || "未取得";

		return [
			`進入想定: ${formation}`,
			`スロー候補: ${slow}`,
			`ダッシュ候補: ${dash}`,
			"スタート展示:",
			...sortedStartExhibition.map((item) => `- ${item.frameNo}号艇 コース${item.course} ST ${toDisplay(item.startTiming)}`),
		].join("\n");
	}

	const exhibitions = toMaterialArray<BoatExhibitionItem>((race as { exhibitions?: unknown }).exhibitions);

	if (exhibitions.length === 0) {
		return "進入想定: 未取得\nスロー候補: 未取得\nダッシュ候補: 未取得\nスタート展示:\n- 未取得";
	}

	const sortedExhibitions = [...exhibitions].sort(
		(left, right) => Number(left.course ?? 99) - Number(right.course ?? 99),
	);

	const formation = sortedExhibitions.map((item) => item.frameNo).join("-") || "未取得";

	const slow =
		sortedExhibitions
			.filter((item) => Number(item.course ?? 99) <= 3)
			.map((item) => item.frameNo)
			.join("-") || "未取得";

	const dash =
		sortedExhibitions
			.filter((item) => Number(item.course ?? 99) > 3)
			.map((item) => item.frameNo)
			.join("-") || "未取得";

	return [
		`進入想定: ${formation}`,
		`スロー候補: ${slow}`,
		`ダッシュ候補: ${dash}`,
		"スタート展示:",
		...sortedExhibitions.map((item) => `- ${item.frameNo}号艇 コース${toDisplay(item.course)} ST ${toDisplay(item.startTiming)}`),
	].join("\n");
};

export function buildBoatPredictionMaterial(params: {
	venue: BoatTodayVenueItem;
	race: BoatRaceItem;
	venueExtra?: BoatVenueExtraVenue | null;
	raceExtra?: BoatVenueExtraRace | null;
	venueFeatureNote?: BoatVenueFeatureNote | null;
	venueFeatureInsights?: BoatVenueUserInsight[];
}): string {
	const { venue, race, venueExtra, raceExtra, venueFeatureNote, venueFeatureInsights = [] } = params;
	const racers = toMaterialArray<BoatRacerItem>((race as { racers?: unknown }).racers);
	const exhibitions = resolvePredictionExhibitions(race, raceExtra);
	const venueStartExhibitionMaterial = buildVenueStartExhibitionBlock(racers, raceExtra);
	const raceStartExhibitionMaterial = buildStartExhibitionBlock(race);

	const sections = [
		[
			"[A. レース基本情報]",
			`会場名: ${venue.venueName}`,
			`日付: ${venue.date}`,
			`レース番号: ${race.raceNo}R`,
			`締切予定: ${toDisplay(race.deadlineTime)}`,
			`発走予定: ${toDisplay(race.startTime)}`,
			`レースタイトル: ${toDisplay(race.title)}`,
			`時間帯: ${toDisplay(venue.session, "未設定")}`,
			`race_id: ${toDisplay(race.raceId)}`,
		].join("\n"),
		[
			"[A2. 最重要 / 欠場・展示不参加確認]",
			buildParticipationAlertMaterialBlock(race, raceExtra),
		].join("\n"),
		[
			"[B. \u4f1a\u5834\u7279\u5fb4\u30ce\u30fc\u30c8 / Venue Selector\u5168\u6587]",
			buildBoatVenueFeatureFullMaterial(venueFeatureNote) || "- \u672a\u767b\u9332",
		].join("\n"),
		[
			"[B2. MY ANALYSIS LOG / \u81ea\u5206\u5206\u6790\u30b5\u30de\u30ea\u30fc\u5168\u6587]",
			buildBoatVenueUserInsightMaterial(venue.venueName, venueFeatureInsights),
		].join("\n"),
		buildWeatherMaterialBlock(race, venue, venueExtra, raceExtra),
		[
			"[D. 出走表 基本データ]",
			racers.length > 0 ? racers.map((racer) => buildRacerBlock(racer)).join("\n\n") : "出走表サンプルなし",
		].join("\n"),
		[
			"[E. モーター / ボート評価]",
			racers.length > 0
				? racers
						.map(
							(racer) =>
								`- ${racer.frameNo}号艇 モーター${toDisplay(racer.motorNo)} (${toDisplay(racer.motorSecondRate)}) / ボート${toDisplay(racer.boatMotorNo)} (${toDisplay(racer.boatSecondRate)})`,
						)
						.join("\n")
				: "モーター / ボート評価サンプルなし",
		].join("\n"),
		[
			"[F. 展示情報]",
			exhibitions.length > 0 ? exhibitions.map((item) => buildExhibitionBlock(item)).join("\n\n") : "展示情報サンプルなし",
		].join("\n"),
		[
			"[G. 進入 / スタート展示]",
			venueStartExhibitionMaterial !== buildMissingBlock()
				? venueStartExhibitionMaterial
				: raceStartExhibitionMaterial,
		].join("\n"),
		[
			"[H. オッズ]",
			buildOddsBlock(race),
		].join("\n"),
		[
			"[I. 予想時点チェック]",
			"この素材は予想用のため、着順・払戻・決まり手などの結果情報は含めません。",
		].join("\n"),
		[
			"[J. GPTへの予想依頼メモ]",
			"この資料をもとに、展示・進入・モーター・ボート・風・波・オッズを総合して競艇予想をしてください。",
			"買い目は合計10点。",
			"3連単は厚め2点、本線6点。",
			"2連単は穴狙い2点。",
			"展開の根拠、危険な人気、穴候補も短く説明してください。",
		].join("\n"),
		[
			"[K. 公式直前情報]",
			buildOfficialBeforeInfoBlock(racers, raceExtra),
		].join("\n"),
		[
			"[L. スタート展示]",
			buildVenueStartExhibitionBlock(racers, raceExtra),
		].join("\n"),
		[
			"[M. 成績・勝率]",
			[
				buildScoreQuickLookBlock(racers, raceExtra),
				buildVenueRecordDetailsBlock(racers, raceExtra),
			].filter((block) => block !== buildMissingBlock()).join("\n\n") || buildMissingBlock(),
		].join("\n"),
		[
			"[N. 会場独自展示]",
			buildOriginalExhibitionBlock(racers, raceExtra),
		].join("\n"),
		[
			"[O. モーター]",
			buildMotorSummaryBlock(racers, raceExtra),
		].join("\n"),
		[
			"[P. 水面・コメント]",
			buildWaterAndCommentsBlock(racers, venueExtra, raceExtra),
		].join("\n"),
		[
			"[Q. 直近成績・節間成績]",
			buildRecentPerformanceBlock(racers, venueExtra, raceExtra),
		].join("\n"),
		[
			"[R. 枠別 / コース別傾向]",
			buildFrameCourseTrendBlock(racers, venueExtra, raceExtra),
		].join("\n"),
		[
			"[S. 会場別モーター履歴・気配]",
			buildMotorHistoryBlock(racers, venueExtra, raceExtra),
		].join("\n"),
	];

	return sections.join("\n\n");
}
