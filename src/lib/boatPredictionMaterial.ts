import type {
	BoatExhibitionItem,
	BoatOddsItem,
	BoatRaceItem,
	BoatRacerItem,
	BoatTodayVenueItem,
} from "./boatraceTypes";
import type { BoatVenueExtraRace, BoatVenueExtraVenue } from "./boatVenueExtrasFeed";

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
	const waterSurfaceInfo = readVenueWaterRecord(raceExtra?.waterSurfaceInfo) ?? readVenueWaterRecord(venueExtra?.waterSurfaceInfo);
	const venuePrediction = readVenueWaterRecord(raceExtra?.venuePrediction);
	const racerComments = sortByFrameNo(toMaterialRecordArray(raceExtra?.racerComments));
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
		readMaterialString(raceExtra?.memo),
		readMaterialString(venueExtra?.note),
	]
		.filter(Boolean)
		.join(" / ");

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
		commentLines.length > 0 ? `- 選手コメント:\n${commentLines.join("\n")}` : "- 選手コメント: 未取得",
	].join("\n");
};

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

const buildOddsBlock = (odds: unknown) => {
	const oddsRows = toMaterialArray<BoatOddsItem>(odds).filter(
		(item) => Boolean(readMaterialString(item.betType)) && Boolean(readMaterialString(item.combination)) && Boolean(readMaterialString(item.odds)),
	);

	if (oddsRows.length === 0) {
		return "オッズ情報は未取得";
	}

	return oddsRows
		.map(
			(item) =>
				`- ${toDisplay(item.betType, "-")} ${toDisplay(item.combination, "-")} ${toDisplay(item.odds, "-")}倍 人気:${toDisplay(item.popularity, "未取得")}`,
		)
		.join("\n");
};

const buildStartExhibitionBlock = (race: BoatRaceItem) => {
	const startExhibition = toMaterialArray<NonNullable<BoatRaceItem["startExhibition"]>[number]>(
		(race as { startExhibition?: unknown }).startExhibition,
	);

	if (startExhibition.length > 0) {
		const slow = startExhibition.filter((item) => Number(item.course) <= 3).map((item) => item.frameNo).join("-") || "未取得";
		const dash = startExhibition.filter((item) => Number(item.course) > 3).map((item) => item.frameNo).join("-") || "未取得";
		const formation = startExhibition.map((item) => item.course).join("-") || "未取得";

		return [
			`進入想定: ${formation}`,
			`スロー候補: ${slow}`,
			`ダッシュ候補: ${dash}`,
			"スタート展示:",
			...startExhibition.map((item) => `- ${item.frameNo}号艇 コース${item.course} ST ${toDisplay(item.startTiming)}`),
		].join("\n");
	}

	const exhibitions = toMaterialArray<BoatExhibitionItem>((race as { exhibitions?: unknown }).exhibitions);

	if (exhibitions.length === 0) {
		return "進入想定: 未取得\nスロー候補: 未取得\nダッシュ候補: 未取得\nスタート展示:\n- 未取得";
	}

	const sorted = [...exhibitions].sort((left, right) => Number(left.course ?? 99) - Number(right.course ?? 99));
	const formation = sorted.map((item) => item.course ?? "-").join("-");
	const slow = sorted.filter((item) => Number(item.course ?? 99) <= 3).map((item) => item.frameNo).join("-") || "未取得";
	const dash = sorted.filter((item) => Number(item.course ?? 99) > 3).map((item) => item.frameNo).join("-") || "未取得";

	return [
		`進入想定: ${formation || "未取得"}`,
		`スロー候補: ${slow}`,
		`ダッシュ候補: ${dash}`,
		"スタート展示:",
		...sorted.map((item) => `- ${item.frameNo}号艇 コース${toDisplay(item.course)} ST ${toDisplay(item.startTiming)}`),
	].join("\n");
};

export function buildBoatPredictionMaterial(params: {
	venue: BoatTodayVenueItem;
	race: BoatRaceItem;
	venueExtra?: BoatVenueExtraVenue | null;
	raceExtra?: BoatVenueExtraRace | null;
}): string {
	const { venue, race, venueExtra, raceExtra } = params;
	const weather = race.result?.weatherActual ?? venue.weatherActual;
	const racers = toMaterialArray<BoatRacerItem>((race as { racers?: unknown }).racers);
	const exhibitions = toMaterialArray<BoatExhibitionItem>((race as { exhibitions?: unknown }).exhibitions);
	const odds = toMaterialArray<BoatOddsItem>((race as { oddsPreview?: unknown }).oddsPreview);
	const result = race.result;
	const finishOrder = toMaterialArray<string | number>((result as { finishOrder?: unknown } | undefined)?.finishOrder);

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
			"[B. 水面 / 会場特徴]",
			"水面特徴: サンプル未登録",
			"イン逃げ傾向: サンプル未登録",
			"まくり・差し傾向: サンプル未登録",
			"風の影響: サンプル未登録",
			"荒れそう度: サンプル未登録",
			"会場メモ: サンプル未登録",
		].join("\n"),
		[
			"[C. 天気 / 風 / 波]",
			`天候: ${toDisplay(weather?.weather)}`,
			`気温: ${toDisplay(weather?.temperature)}`,
			`水温: ${toDisplay(weather?.waterTemperature)}`,
			`風向: ${toDisplay(weather?.windDirection)}`,
			`風速: ${toDisplay(weather?.windSpeed)}`,
			`波高: ${toDisplay(weather?.waveHeight)}`,
			`データソース: ${toDisplay(weather?.source ?? venue.source)}`,
		].join("\n"),
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
			buildStartExhibitionBlock(race),
		].join("\n"),
		[
			"[H. オッズ]",
			buildOddsBlock(odds),
		].join("\n"),
		[
			"[I. 結果情報]",
			result?.status === "confirmed"
				? [
						`- 結果: ${toDisplay(finishOrder.slice(0, 3).join("-"))}`,
						`- 決まり手: ${toDisplay(result.winningMethod)}`,
						`- 3連単: ${toDisplay(result.payout3tan?.combination)} ${toDisplay(result.payout3tan?.payout)}`,
						`- 2連単: ${toDisplay(result.payout2tan?.combination)} ${toDisplay(result.payout2tan?.payout)}`,
					].join("\n")
				: "結果はまだ確定していません。",
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
			buildScoreQuickLookBlock(racers, raceExtra),
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
	];

	return sections.join("\n\n");
}