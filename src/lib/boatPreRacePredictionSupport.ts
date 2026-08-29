import type { BoatRaceItem, BoatRacerItem } from "./boatraceTypes";
import {
	getBoatPredictionExhibitionAvailability,
	type BoatPredictionExhibitionAvailability,
} from "./boatPredictionMaterial";
import type { BoatVenueExtraRace } from "./boatVenueExtrasFeed";

export type BoatPreRacePredictionMode =
	| "pre-race"
	| "exhibition-partial"
	| "exhibition-complete";

export type BoatPreRacePredictionModeResult = {
	mode: BoatPreRacePredictionMode;
	label: "事前予想モード" | "展示一部取得モード" | "展示取得済みモード";
	exhibitionAvailability: BoatPredictionExhibitionAvailability;
};

type RacerMaterialRecord = BoatRacerItem & Record<string, unknown>;

const missingValue = "未取得";

const readValue = (value: unknown): string => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	if (typeof value !== "string") {
		return "";
	}
	const text = value.trim();
	return text && !["-", "--", "未取得", "未公開", "確認中", "未設定"].includes(text) ? text : "";
};

const displayValue = (value: unknown): string => readValue(value) || missingValue;

const readRegistrationPeriod = (racer: RacerMaterialRecord): string =>
	readValue(racer.registrationPeriod) ||
	readValue(racer.registrationTerm) ||
	readValue(racer.term) ||
	readValue(racer.period);

const buildFramePurposeLabel = (frameNo: number): string => {
	switch (frameNo) {
		case 1:
			return "イン信頼の確認材料";
		case 2:
			return "差し警戒の確認材料";
		case 3:
			return "センター攻めの確認材料";
		case 4:
			return "カド攻めの確認材料";
		case 5:
			return "外3着保護の確認材料";
		case 6:
			return "大穴3着候補の確認材料";
		default:
			return "事前確認材料";
	}
};

const buildRacerMaterialLine = (racer: BoatRacerItem): string => {
	const source = racer as RacerMaterialRecord;
	const profile = [
		`登録番号 ${displayValue(racer.registrationNo)}`,
		`支部 ${displayValue(racer.branch)}`,
		`年齢 ${displayValue(racer.age)}`,
		`登録期 ${readRegistrationPeriod(source) || missingValue}`,
		`級別 ${displayValue(racer.class)}`,
	].join(" / ");
	const performance = [
		`全国勝率 ${displayValue(racer.winRate)}`,
		`全国2連率 ${displayValue(racer.secondRate)}`,
		`当地勝率 ${displayValue(racer.localWinRate)}`,
		`当地2連率 ${displayValue(racer.localSecondRate)}`,
		`平均ST ${displayValue(racer.averageStart)}`,
		`F/L ${displayValue(racer.fCount)}/${displayValue(racer.lCount)}`,
	].join(" / ");
	const equipment = [
		`モーター ${displayValue(racer.motorNo)}`,
		`モーター2連率 ${displayValue(racer.motorSecondRate)}`,
		`ボート ${displayValue(racer.boatMotorNo ?? racer.boatNo)}`,
		`ボート2連率 ${displayValue(racer.boatSecondRate)}`,
	].join(" / ");

	return [
		`- ${racer.frameNo}号艇 ${displayValue(racer.name)}: ${buildFramePurposeLabel(racer.frameNo)}`,
		`  - プロフィール: ${profile}`,
		`  - 成績・ST・F/L: ${performance}`,
		`  - モーター・ボート: ${equipment}`,
	].join("\n");
};

const buildMissingRacerMaterialLine = (frameNo: number): string => [
	`- ${frameNo}号艇: 出走表未取得（艇別材料は作成しない）`,
	`  - プロフィール: 登録番号 ${missingValue} / 支部 ${missingValue} / 年齢 ${missingValue} / 登録期 ${missingValue} / 級別 ${missingValue}`,
	`  - 成績・ST・F/L: ${missingValue}`,
	`  - モーター・ボート: ${missingValue}`,
].join("\n");

const getRacerByFrame = (race: BoatRaceItem, frameNo: number): BoatRacerItem | undefined =>
	(race.racers ?? []).find((racer) => racer.frameNo === frameNo);

const buildAxisLine = (label: string, racers: Array<BoatRacerItem | undefined>, fields: Array<keyof BoatRacerItem>): string => {
	const available = racers.reduce((count, racer) => {
		if (!racer) {
			return count;
		}
		return count + fields.filter((field) => Boolean(readValue(racer[field]))).length;
	}, 0);
	const total = racers.length * fields.length;
	return `- ${label}: 対象艇のsource-backed材料 ${available}/${total}項目。実値は艇別欄で確認し、材料不足は無理に評価しない。`;
};

const buildPredictionModeNote = (mode: BoatPreRacePredictionModeResult): string => {
	const availability = mode.exhibitionAvailability;
	const detail = [
		availability.hasExhibitionTime ? "展示タイム" : "",
		availability.hasStartTiming ? "展示ST" : "",
		availability.hasCourse ? "進入" : "",
		availability.hasTilt ? "チルト" : "",
	].filter(Boolean);

	if (mode.mode === "pre-race") {
		return "展示未取得のため、展示タイム・展示ST・進入は直前補正用。本予想は枠・選手成績・ST・F/L・モーター・ボート・当地成績・会場傾向・水面傾向を主材料にする。";
	}
	if (mode.mode === "exhibition-partial") {
		return `展示は一部取得（${detail.join("・") || "展示項目"}）。取得済み項目は直前補正に使い、未取得値は補完しない。事前予想の主材料は維持する。`;
	}
	return "展示タイム6艇分を取得済み。展示タイム・展示ST・進入・チルト・部品交換は直前補正またはレース後分析に使い、事前予想の主材料も維持する。";
};

export function resolveBoatPredictionMode(params: {
	race: BoatRaceItem;
	raceExtra?: BoatVenueExtraRace | null;
}): BoatPreRacePredictionModeResult {
	const exhibitionAvailability = getBoatPredictionExhibitionAvailability(params);
	if (exhibitionAvailability.exhibitionTimeFrameCount >= 6) {
		return { mode: "exhibition-complete", label: "展示取得済みモード", exhibitionAvailability };
	}
	if (exhibitionAvailability.exhibitionTimeFrameCount > 0) {
		return { mode: "exhibition-partial", label: "展示一部取得モード", exhibitionAvailability };
	}
	return { mode: "pre-race", label: "事前予想モード", exhibitionAvailability };
}

export function buildBoatPreRacePredictionSupportBlock(params: {
	race: BoatRaceItem;
	raceExtra?: BoatVenueExtraRace | null;
}): string {
	const mode = resolveBoatPredictionMode(params);
	const racerByFrame = (frameNo: number) => getRacerByFrame(params.race, frameNo);
	const racerLines = [1, 2, 3, 4, 5, 6].map((frameNo) => {
		const racer = racerByFrame(frameNo);
		return racer ? buildRacerMaterialLine(racer) : buildMissingRacerMaterialLine(frameNo);
	});

	return [
		"【事前予想サポート】",
		"【予想モード】",
		`- ${mode.label}`,
		`- 展示タイム: ${mode.exhibitionAvailability.exhibitionTimeFrameCount}/6艇`,
		`- ${buildPredictionModeNote(mode)}`,
		"",
		"【事前予想で見る軸】",
		buildAxisLine("イン信頼", [racerByFrame(1)], ["averageStart", "winRate", "localWinRate", "motorSecondRate"]),
		buildAxisLine("差し警戒", [racerByFrame(2)], ["averageStart", "winRate", "localWinRate", "motorSecondRate"]),
		buildAxisLine("センター攻め", [racerByFrame(3), racerByFrame(4)], ["averageStart", "winRate", "motorSecondRate"]),
		buildAxisLine("外3着保護", [racerByFrame(5), racerByFrame(6)], ["winRate", "thirdRate", "motorThirdRate", "boatThirdRate"]),
		"- 波乱度: F/L・ST・モーター/ボート・会場傾向・水面傾向を既存素材で確認する。数値評価や順位付けはしない。",
		"",
		"【艇別の事前材料】",
		...racerLines,
		"",
		"【買い目設計補助】",
		"- 厚め候補: イン信頼のsource-backed材料が揃う場合は1頭寄せを検討する。",
		"- 本線候補: 1号艇と2・3・4号艇の事前材料を比較する。",
		"- 中穴候補: 差し警戒・センター攻めの材料を確認する。",
		"- 大穴候補: 外3着保護が必要な場合だけ5・6号艇の材料を確認する。",
		"- この欄では買い目を生成しない。既存の3連単10点ルールで予想時に判断する。",
	].join("\n");
}
