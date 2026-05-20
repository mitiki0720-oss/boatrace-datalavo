import type { ReactNode } from "react";
import type { BoatExhibitionItem, BoatFrameNumber, BoatPayoutItem, BoatRaceItem, BoatRacerItem, BoatWeatherActual } from "../../lib/boatraceTypes";
import type { BoatVenueExtraRace } from "../../lib/boatVenueExtrasFeed";
import { boatTheme } from "../../lib/theme";
import { BoatExhibitionTable } from "./BoatExhibitionTable";
import { BoatOddsPreview } from "./BoatOddsPreview";
import { BoatRacerTable } from "./BoatRacerTable";

type BoatRaceDetailPanelProps = {
	venueName: string;
	venueWeatherActual?: BoatWeatherActual | null;
	race: BoatRaceItem | null | undefined;
	venueRaceExtra?: BoatVenueExtraRace | null;
	entryRacers?: BoatRacerItem[];
	entryNote?: ReactNode;
	afterEntryContent?: ReactNode;
};

type WeatherDisplayItem = {
	icon: string;
	label: string;
	value: string;
};

type ResultFinisherDisplay = {
	rank: string;
	frameNo: number;
	registrationNo: string;
	name: string;
	raceTime: string;
};

type ResultStartInfoDisplay = {
	frameNo: number;
	startTiming: string;
	course: string;
	note: string;
};

type ResultPayoutDisplay = {
	betType: string;
	combination: string;
	payout: string;
	popularity?: number;
};

const panelStyle = {
	display: "grid",
	gap: "28px",
};

const majorSectionStyle = {
	display: "grid",
	gap: "22px",
};

const summaryCardStyle = {
	padding: "22px",
	borderRadius: "26px",
	background:
		"linear-gradient(180deg, rgba(255,255,255,0.98), rgba(242,252,255,0.94))",
	border: "1px solid rgba(113, 202, 226, 0.34)",
	display: "grid",
	gap: "16px",
	boxShadow: "0 18px 44px rgba(19, 76, 112, 0.08)",
	position: "relative" as const,
	overflow: "hidden",
};

const cardLabelStyle = {
	margin: 0,
	width: "fit-content",
	padding: "5px 10px",
	borderRadius: "999px",
	background: "rgba(222, 246, 252, 0.9)",
	border: "1px solid rgba(113, 202, 226, 0.28)",
	fontSize: "0.68rem",
	letterSpacing: "0.12em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
	fontWeight: 900,
	boxShadow: "0 8px 18px rgba(19, 76, 112, 0.05)",
};

const blockTitleStyle = {
	margin: 0,
	fontSize: "1.12rem",
	fontWeight: 950,
	letterSpacing: "0.01em",
	color: boatTheme.colors.navy,
	lineHeight: 1.28,
};

const blockDescriptionStyle = {
	margin: 0,
	fontSize: "0.82rem",
	lineHeight: 1.75,
	color: boatTheme.colors.muted,
	maxWidth: "760px",
};

const sectionHeadingStyle = {
	display: "grid",
	gridTemplateColumns: "auto minmax(0, 1fr)",
	alignItems: "start",
	gap: "12px",
	padding: "2px 2px 4px",
};

const sectionNumberStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "34px",
	height: "34px",
	borderRadius: "14px",
	background: "linear-gradient(135deg, rgba(17, 64, 92, 0.98), rgba(44, 145, 201, 0.9))",
	color: "#f7fbff",
	fontSize: "0.74rem",
	fontWeight: 900,
	letterSpacing: "0.06em",
	boxShadow: "0 10px 22px rgba(17, 64, 92, 0.16)",
};

const sectionHeadingTextStyle = {
	display: "grid",
	gap: "6px",
	minWidth: 0,
};

const sectionDividerStyle = {
	height: "1px",
	background: "linear-gradient(90deg, rgba(93, 199, 232, 0.32), rgba(93, 199, 232, 0))",
};

const weatherGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
	gap: "10px",
};

const weatherCardStyle = {
	padding: "14px 15px",
	borderRadius: "20px",
	background:
		"linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 251, 255, 0.96))",
	border: "1px solid rgba(93, 199, 232, 0.22)",
	display: "grid",
	gridTemplateColumns: "auto 1fr",
	alignItems: "center",
	gap: "11px",
	minHeight: "82px",
	boxShadow: "0 12px 26px rgba(17, 64, 92, 0.055)",
};

const entrySectionStyle = {
	position: "relative" as const,
	display: "grid",
	gap: "18px",
	padding: "24px",
	borderRadius: "30px",
	background:
		"linear-gradient(180deg, rgba(250, 254, 255, 0.99), rgba(240, 251, 249, 0.97))",
	border: "1px solid rgba(93, 199, 232, 0.24)",
	boxShadow: "0 22px 54px rgba(17, 64, 92, 0.075), inset 0 1px 0 rgba(255, 255, 255, 0.88)",
	overflow: "hidden" as const,
};

const oddsSectionStyle = {
	position: "relative" as const,
	display: "grid",
	gap: "18px",
	padding: "24px",
	borderRadius: "30px",
	background:
		"linear-gradient(180deg, rgba(248, 253, 255, 0.99), rgba(235, 246, 252, 0.97))",
	border: "1px solid rgba(93, 199, 232, 0.25)",
	boxShadow: "0 24px 58px rgba(17, 64, 92, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88)",
	overflow: "hidden" as const,
};

const resultSectionWrapStyle = {
	display: "grid",
	gap: "10px",
	paddingTop: "8px",
	borderTop: `1px solid ${boatTheme.colors.line}`,
};

const afterEntrySlotStyle = {
	display: "grid",
	gap: "18px",
};

const weatherIconStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "38px",
	height: "38px",
	borderRadius: "14px",
	background: "rgba(224, 246, 252, 0.9)",
	fontSize: "1.18rem",
};

const weatherLabelStyle = {
	margin: 0,
	fontSize: "0.74rem",
	letterSpacing: "0.06em",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 800,
};

const weatherValueStyle = {
	margin: 0,
	fontSize: "1.02rem",
	fontWeight: 800,
	lineHeight: 1.35,
	color: boatTheme.colors.navy,
};

const resultCardStyle = {
	padding: "22px",
	borderRadius: "26px",
	background:
		"linear-gradient(180deg, rgba(249,255,253,0.98), rgba(235,249,248,0.96))",
	border: "1px solid rgba(113, 202, 226, 0.34)",
	display: "grid",
	gap: "16px",
	color: boatTheme.colors.navy,
	boxShadow: "0 18px 44px rgba(19, 76, 112, 0.08)",
	position: "relative" as const,
	overflow: "hidden",
};

const resultHeroStyle = {
	padding: "16px",
	borderRadius: "18px",
	background: "linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(236, 249, 247, 0.94))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "8px",
	boxShadow: "0 10px 22px rgba(17, 64, 92, 0.04)",
};

const resultHeroLabelStyle = {
	margin: 0,
	fontSize: "0.76rem",
	letterSpacing: "0.08em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
	fontWeight: 800,
};

const resultHeroValueStyle = {
	margin: 0,
	fontSize: "1.44rem",
	lineHeight: 1.2,
	color: boatTheme.colors.navy,
	fontWeight: 900,
};

const resultMiniGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
	gap: "10px",
};

const resultMetaCardStyle = {
	padding: "12px 13px",
	borderRadius: "16px",
	background: "rgba(255, 255, 255, 0.86)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "4px",
};

const resultMetaLabelStyle = {
	margin: 0,
	fontSize: "0.72rem",
	letterSpacing: "0.06em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
	fontWeight: 800,
};

const resultMetaValueStyle = {
	margin: 0,
	lineHeight: 1.45,
	fontSize: "0.92rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const resultDetailSectionStyle = {
	display: "grid",
	gap: "10px",
};

const resultDetailTitleStyle = {
	margin: 0,
	fontSize: "0.92rem",
	fontWeight: 900,
	color: boatTheme.colors.navy,
};

const resultTableWrapStyle = {
	overflowX: "auto" as const,
	borderRadius: "18px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.92)",
};

const resultTableStyle = {
	width: "100%",
	minWidth: "540px",
	borderCollapse: "collapse" as const,
	fontSize: "0.88rem",
	color: boatTheme.colors.navy,
};

const resultHeadCellStyle = {
	padding: "11px 10px",
	background: "rgba(228, 244, 251, 0.96)",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	textAlign: "left" as const,
	whiteSpace: "nowrap" as const,
	fontSize: "0.76rem",
	fontWeight: 900,
};

const resultBodyCellStyle = {
	padding: "11px 10px",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	whiteSpace: "nowrap" as const,
	fontWeight: 700,
};

const startInfoGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
	gap: "8px",
};

const startInfoCardStyle = {
	padding: "10px 11px",
	borderRadius: "15px",
	background: "rgba(255, 255, 255, 0.9)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "4px",
};

const startInfoFrameStyle = {
	margin: 0,
	fontSize: "0.74rem",
	fontWeight: 900,
	color: boatTheme.colors.aquaDeep,
};

const startInfoValueStyle = {
	margin: 0,
	fontSize: "1rem",
	fontWeight: 900,
	color: boatTheme.colors.navy,
};

const startInfoNoteStyle = {
	margin: 0,
	fontSize: "0.76rem",
	lineHeight: 1.4,
	color: boatTheme.colors.muted,
	fontWeight: 800,
};

const payoutSectionStyle = {
	display: "grid",
	gap: "10px",
};

const payoutSectionTitleStyle = {
	margin: 0,
	fontSize: "0.9rem",
	fontWeight: 900,
	color: boatTheme.colors.navy,
};

const payoutGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
	gap: "10px",
};

const payoutCardStyle = {
	padding: "13px 13px 11px",
	borderRadius: "16px",
	background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,252,255,0.95))",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: "0 8px 18px rgba(17, 64, 92, 0.04)",
	display: "grid",
	gap: "5px",
};

const quietNoteStyle = {
	margin: 0,
	padding: "15px 17px",
	borderRadius: "20px",
	background:
		"linear-gradient(180deg, rgba(247, 252, 255, 0.96), rgba(239, 249, 252, 0.92))",
	border: "1px dashed rgba(93, 199, 232, 0.42)",
	color: boatTheme.colors.muted,
	lineHeight: 1.75,
	boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
};

const lowerSectionStyle = {
	display: "grid",
	gap: "18px",
};

const dataClusterStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
	gap: "18px",
	alignItems: "start" as const,
};

const emptyStyle = {
	margin: 0,
	padding: "18px",
	borderRadius: "20px",
	background: "rgba(247, 252, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.muted,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(value: unknown, fallback = ""): string {
	return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function getSafeDisplayValue(value?: string | null, fallback = "確認中"): string {
	return value && value.trim().length > 0 ? value : fallback;
}

function getAnyStringValue(value: unknown): string {
	if (typeof value === "string") {
		return value.trim();
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}

	return "";
}

function getFrameNo(value: unknown): BoatFrameNumber | null {
	const frameNo = Number(value);
	return Number.isInteger(frameNo) && frameNo >= 1 && frameNo <= 6 ? frameNo as BoatFrameNumber : null;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
	if (Array.isArray(value)) {
		return value.filter(isRecord);
	}

	if (isRecord(value)) {
		return Object.values(value).filter(isRecord);
	}

	return [];
}

function firstDisplayValue(...values: Array<string | undefined>): string | undefined {
	return values.find((value) => value && value.trim().length > 0);
}

function mergeExhibitionValue(current: string | undefined, next: string | undefined): string | undefined {
	return current && current.trim().length > 0 ? current : next || current;
}

function mergeExhibitionPlayerName(current: string | undefined, next: string | undefined): string | undefined {
	if (!next || !next.trim()) {
		return current;
	}

	if (!current || !current.trim() || /^枠\d+$/.test(current.trim())) {
		return next;
	}

	return current;
}

function mergeExhibitionRow(
	rowsByFrameNo: Map<BoatFrameNumber, BoatExhibitionItem>,
	frameNo: BoatFrameNumber,
	next: Partial<BoatExhibitionItem>,
) {
	const current = rowsByFrameNo.get(frameNo) ?? { frameNo };
	rowsByFrameNo.set(frameNo, {
		...current,
		frameNo,
		playerName: mergeExhibitionPlayerName(current.playerName, next.playerName),
		exhibitionTime: mergeExhibitionValue(current.exhibitionTime, next.exhibitionTime),
		weight: mergeExhibitionValue(current.weight, next.weight),
		weightAdjustment: mergeExhibitionValue(current.weightAdjustment, next.weightAdjustment),
		tilt: mergeExhibitionValue(current.tilt, next.tilt),
		partsExchange: mergeExhibitionValue(current.partsExchange, next.partsExchange),
		oneLapTime: mergeExhibitionValue(current.oneLapTime, next.oneLapTime),
		turnTime: mergeExhibitionValue(current.turnTime, next.turnTime),
		straightTime: mergeExhibitionValue(current.straightTime, next.straightTime),
		startTiming: mergeExhibitionValue(current.startTiming, next.startTiming),
		course: mergeExhibitionValue(current.course, next.course),
		weatherMemo: mergeExhibitionValue(current.weatherMemo, next.weatherMemo),
		memo: mergeExhibitionValue(current.memo, next.memo),
		evaluation: current.evaluation && current.evaluation !== "unknown" ? current.evaluation : next.evaluation ?? current.evaluation,
	});
}

function readExhibitionRow(item: Record<string, unknown>): Partial<BoatExhibitionItem> & { frameNo: BoatFrameNumber } | null {
	const frameNo = getFrameNo(item.frameNo ?? item.frame ?? item.lane ?? item.boatNumber);
	if (!frameNo) {
		return null;
	}

	return {
		frameNo,
		playerName: firstDisplayValue(
			getAnyStringValue(item.playerName),
			getAnyStringValue(item.racerName),
			getAnyStringValue(item.name),
			getAnyStringValue(item.boatRacerName),
		),
		exhibitionTime: firstDisplayValue(getAnyStringValue(item.exhibitionTime), getAnyStringValue(item.displayTime)),
		weight: getAnyStringValue(item.weight),
		weightAdjustment: firstDisplayValue(getAnyStringValue(item.weightAdjustment), getAnyStringValue(item.adjustment)),
		tilt: getAnyStringValue(item.tilt),
		partsExchange: firstDisplayValue(getAnyStringValue(item.partsExchange), getAnyStringValue(item.partsReplacement)),
		oneLapTime: firstDisplayValue(getAnyStringValue(item.oneLapTime), getAnyStringValue(item.lapTime)),
		turnTime: firstDisplayValue(getAnyStringValue(item.turnTime), getAnyStringValue(item.turningTime)),
		straightTime: getAnyStringValue(item.straightTime),
		startTiming: firstDisplayValue(getAnyStringValue(item.startTiming), getAnyStringValue(item.stDisplay)),
		course: firstDisplayValue(getAnyStringValue(item.course), getAnyStringValue(item.entryCourse)),
		memo: firstDisplayValue(getAnyStringValue(item.memo), getAnyStringValue(item.note), getAnyStringValue(item.exhibitionEvaluation)),
	};
}

function readVenueExtraExhibitionArrays(venueRaceExtra?: BoatVenueExtraRace | null): Record<string, unknown>[][] {
	if (!venueRaceExtra) {
		return [];
	}

	const officialBeforeInfo = isRecord(venueRaceExtra.officialBeforeInfo) ? venueRaceExtra.officialBeforeInfo : null;

	return [
		toRecordArray(officialBeforeInfo?.exhibitionRows),
		toRecordArray(officialBeforeInfo?.beforeInfo),
		toRecordArray(venueRaceExtra.beforeInfo),
		toRecordArray(venueRaceExtra.originalExhibition),
	].filter((rows) => rows.length > 0);
}

function buildDisplayExhibitions(race: BoatRaceItem, venueRaceExtra?: BoatVenueExtraRace | null): BoatExhibitionItem[] {
	const rowsByFrameNo = new Map<BoatFrameNumber, BoatExhibitionItem>();

	for (const item of race.exhibitions ?? []) {
		mergeExhibitionRow(rowsByFrameNo, item.frameNo, item);
	}

	for (const rows of readVenueExtraExhibitionArrays(venueRaceExtra)) {
		for (const item of rows) {
			const row = readExhibitionRow(item);
			if (row) {
				mergeExhibitionRow(rowsByFrameNo, row.frameNo, row);
			}
		}
	}

	return Array.from(rowsByFrameNo.values())
		.filter((item) =>
			Boolean(
				item.exhibitionTime ||
				item.weight ||
				item.weightAdjustment ||
				item.tilt ||
				item.partsExchange ||
				item.oneLapTime ||
				item.turnTime ||
				item.straightTime ||
				item.startTiming ||
				item.course ||
				item.playerName,
			),
		)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getOptionalDisplayValue(value?: string | null): string {
	return value && value.trim().length > 0 ? value.trim() : "";
}

function getResultRecord(race: BoatRaceItem): Record<string, unknown> {
	return isRecord(race.result) ? race.result : {};
}

function getResultWeatherActual(resultRecord: Record<string, unknown>): BoatWeatherActual | null {
	const weatherActual = resultRecord.weatherActual;
	return isRecord(weatherActual) ? (weatherActual as BoatWeatherActual) : null;
}

function getWeatherItems(weatherActual?: BoatWeatherActual | null): WeatherDisplayItem[] {
	const items = [
		{ icon: "☀️", label: "天気", value: getOptionalDisplayValue(weatherActual?.weather) },
		{ icon: "🌬️", label: "風向", value: getOptionalDisplayValue(weatherActual?.windDirection ?? weatherActual?.windDirectionText) },
		{ icon: "🍃", label: "風速", value: getOptionalDisplayValue(weatherActual?.windSpeed) },
		{ icon: "🌊", label: "波高", value: getOptionalDisplayValue(weatherActual?.waveHeight) },
		{ icon: "🌡️", label: "気温", value: getOptionalDisplayValue(weatherActual?.temperature ?? weatherActual?.airTemperature) },
		{ icon: "💧", label: "水温", value: getOptionalDisplayValue(weatherActual?.waterTemperature) },
		{ icon: "⏱️", label: "気圧", value: getOptionalDisplayValue(weatherActual?.pressure) },
		{ icon: "%", label: "湿度", value: getOptionalDisplayValue(weatherActual?.humidity) },
		{ icon: "☔", label: "雨量", value: getOptionalDisplayValue(weatherActual?.rainfall) },
		{ icon: "🕒", label: "表示時点", value: getOptionalDisplayValue(weatherActual?.observedAt ?? weatherActual?.updatedAt) },
	].filter((item) => item.value);

	return items.length > 0 ? items : [{ icon: "☁️", label: "気象", value: getSafeDisplayValue("") }];
}

function toPayoutItem(value: unknown): ResultPayoutDisplay | null {
	if (!isRecord(value)) {
		return null;
	}

	const betType = getStringValue(value.betType);
	const combination = getStringValue(value.combination);
	const payout = getStringValue(value.payout);
	const popularity = typeof value.popularity === "number" ? value.popularity : undefined;

	if (!betType || !combination || !payout) {
		return null;
	}

	return {
		betType,
		combination,
		payout,
		popularity,
	};
}

function isMainPayoutType(item: ResultPayoutDisplay): boolean {
	const betType = item.betType.replace(/\s/g, "");

	return (
		betType === "3連単" ||
		betType === "3連複" ||
		betType === "2連単" ||
		betType === "2連複"
	);
}

function getPayoutItems(resultRecord: Record<string, unknown>): ResultPayoutDisplay[] {
	if (Array.isArray(resultRecord.payoutsFull)) {
		const payoutsFull = resultRecord.payoutsFull
			.map(toPayoutItem)
			.filter((item): item is ResultPayoutDisplay => Boolean(item))
			.filter(isMainPayoutType);

		if (payoutsFull.length > 0) {
			return payoutsFull;
		}
	}

	const payouts = [
		resultRecord.payout3tan,
		resultRecord.payout3fuku,
		resultRecord.payout2tan,
		resultRecord.payout2fuku,
	];

	return payouts
		.map(toPayoutItem)
		.filter((item): item is ResultPayoutDisplay => Boolean(item))
		.filter(isMainPayoutType);
}

function getFinishOrderText(finishOrder?: unknown) {
	if (!finishOrder) {
		return "-";
	}

	if (Array.isArray(finishOrder)) {
		return finishOrder.map((item) => String(item)).slice(0, 3).join("-") || "-";
	}

	return String(finishOrder).trim() || "-";
}

function getFinishers(resultRecord: Record<string, unknown>): ResultFinisherDisplay[] {
	if (!Array.isArray(resultRecord.finishers)) {
		return [];
	}

	return resultRecord.finishers
		.filter(isRecord)
		.map((item) => {
			const frameNo = Number(item.frameNo ?? item.frame ?? item.lane ?? item.boatNumber);

			return {
				rank: getStringValue(item.rank),
				frameNo,
				registrationNo: getStringValue(item.registrationNo ?? item.racerId),
				name: getStringValue(item.name ?? item.playerName ?? item.boatRacerName),
				raceTime: getStringValue(item.raceTime),
			};
		})
		.filter((item) => item.rank && Number.isFinite(item.frameNo) && item.frameNo >= 1 && item.frameNo <= 6 && item.name);
}

function getStartInfo(resultRecord: Record<string, unknown>): ResultStartInfoDisplay[] {
	if (!Array.isArray(resultRecord.startInfo)) {
		return [];
	}

	return resultRecord.startInfo
		.filter(isRecord)
		.map((item) => {
			const frameNo = Number(item.frameNo ?? item.frame ?? item.lane ?? item.boatNumber);

			return {
				frameNo,
				startTiming: getStringValue(item.startTiming ?? item.stDisplay),
				course: getStringValue(item.course ?? item.entryCourse ?? item.approachCourse),
				note: getStringValue(item.note),
			};
		})
		.filter((item) => Number.isFinite(item.frameNo) && item.frameNo >= 1 && item.frameNo <= 6 && item.startTiming)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getWeatherSummaryText(weatherItems: WeatherDisplayItem[]) {
	return weatherItems.map((item) => `${item.label}:${item.value}`).join(" / ");
}

function getRefundText(resultRecord: Record<string, unknown>) {
	const refundText = getStringValue(resultRecord.refundText);
	if (refundText) {
		return refundText;
	}

	if (Array.isArray(resultRecord.refunds) && resultRecord.refunds.length > 0) {
		return resultRecord.refunds.map((item) => String(item)).join(" / ");
	}

	return "";
}

function renderFinishersTable(finishers: ResultFinisherDisplay[]) {
	if (!finishers.length) {
		return <p style={quietNoteStyle}>全着順はまだ generated JSON に反映されていません。</p>;
	}

	return (
		<div style={resultTableWrapStyle}>
			<table style={resultTableStyle}>
				<thead>
					<tr>
						<th style={resultHeadCellStyle}>着</th>
						<th style={resultHeadCellStyle}>枠</th>
						<th style={resultHeadCellStyle}>登録番号</th>
						<th style={resultHeadCellStyle}>ボートレーサー</th>
						<th style={resultHeadCellStyle}>レースタイム</th>
					</tr>
				</thead>
				<tbody>
					{finishers.map((item) => (
						<tr key={`${item.rank}-${item.frameNo}-${item.registrationNo}`}>
							<td style={resultBodyCellStyle}>{item.rank}</td>
							<td style={resultBodyCellStyle}>{item.frameNo}</td>
							<td style={resultBodyCellStyle}>{item.registrationNo || "-"}</td>
							<td style={resultBodyCellStyle}>{item.name}</td>
							<td style={resultBodyCellStyle}>{item.raceTime || "-"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function renderStartInfo(startInfo: ResultStartInfoDisplay[]) {
	if (!startInfo.length) {
		return <p style={quietNoteStyle}>スタート情報はまだ generated JSON に反映されていません。</p>;
	}

	return (
		<div style={startInfoGridStyle}>
			{startInfo.map((item) => (
				<article key={`start-${item.frameNo}`} style={startInfoCardStyle}>
					<p style={startInfoFrameStyle}>
						{item.course || item.frameNo}コース / {item.frameNo}号艇
					</p>
					<p style={startInfoValueStyle}>{item.startTiming}</p>
					{item.note ? <p style={startInfoNoteStyle}>{item.note}</p> : null}
				</article>
			))}
		</div>
	);
}

export function BoatRaceDetailPanel({ venueWeatherActual, race, venueRaceExtra, entryRacers, entryNote, afterEntryContent }: BoatRaceDetailPanelProps) {
	if (!race) {
		return <p style={emptyStyle}>レースが選択されていません。</p>;
	}

	const resultRecord = getResultRecord(race);
	const racers = entryRacers && entryRacers.length > 0
	 		? entryRacers
			: race.racers ?? [];
	const exhibitions = buildDisplayExhibitions(race, venueRaceExtra);
	const odds = race.oddsPreview ?? [];
	const isConfirmed = getStringValue(resultRecord.status) === "confirmed";
	const weatherItems = getWeatherItems(venueWeatherActual ?? getResultWeatherActual(resultRecord) ?? race.weatherActual);
	const payoutItems = getPayoutItems(resultRecord);
	const finishers = getFinishers(resultRecord);
	const startInfo = getStartInfo(resultRecord);
	const resultSummary = isConfirmed ? getFinishOrderText(resultRecord.finishOrder) : "結果未確定";
	const winningMethod = getStringValue(resultRecord.kimarite ?? resultRecord.winningMethod, "確認中");
	const finalizedAt = getStringValue(resultRecord.finalizedAt, "確認中");
	const refundText = getRefundText(resultRecord);
	const remarks = getStringValue(resultRecord.remarks ?? resultRecord.notes);

	return (
		<div style={panelStyle}>
			<div style={majorSectionStyle}>
				<section style={summaryCardStyle}>
					<div style={sectionHeadingStyle}>
	                     <span style={sectionNumberStyle}>01</span>
	                     <div style={sectionHeadingTextStyle}>
							<p style={cardLabelStyle}>Weather / Water</p>
							<p style={blockDescriptionStyle}></p>
							<h4 style={blockTitleStyle}>🌤️ コンディション確認</h4>
							<p style={blockDescriptionStyle}>
								天気・風・波・水温を、レース判断しやすい形で整理しています。
								</p>
								<div style={sectionDividerStyle} />
								</div>
							</div>

					<div style={weatherGridStyle}>
						{weatherItems.map((item) => (
							<article key={item.label} style={weatherCardStyle}>
								<span style={weatherIconStyle}>{item.icon}</span>
								<div style={{ display: "grid", gap: "3px" }}>
									<p style={weatherLabelStyle}>{item.label}</p>
									<p style={weatherValueStyle}>{item.value}</p>
								</div>
							</article>
						))}
					</div>
				</section>

				<section style={entrySectionStyle}>
	<div style={sectionHeadingStyle}>
		<span style={sectionNumberStyle}>02</span>
		<div style={sectionHeadingTextStyle}>
			<p style={cardLabelStyle}>Entry / Exhibition</p>
			<h4 style={blockTitleStyle}>🚤 出走表・展示データ</h4>
			<p style={blockDescriptionStyle}>
				選手情報と展示データを並べて、直前気配を確認します。
			</p>
			<div style={sectionDividerStyle} />
		</div>
	</div>

	<div style={dataClusterStyle}>
					<div style={lowerSectionStyle}>
						{racers.length > 0 ? <BoatRacerTable racers={racers} /> : <p style={quietNoteStyle}>出走表データはまだ反映されていません。</p>}
						{entryNote ? <p style={quietNoteStyle}>{entryNote}</p> : null}
					</div>
					<div style={lowerSectionStyle}>
						{exhibitions.length > 0 ? <BoatExhibitionTable exhibitions={exhibitions} /> : <p style={quietNoteStyle}>展示データはまだ反映されていません。</p>}
					</div>
				</div>
				</section>

				{afterEntryContent ? <div style={afterEntrySlotStyle}>{afterEntryContent}</div> : null}

				<section style={oddsSectionStyle}>
	<div style={sectionHeadingStyle}>
		<span style={sectionNumberStyle}>04</span>
		<div style={sectionHeadingTextStyle}>
			<p style={cardLabelStyle}>Odds Board</p>
			<h4 style={blockTitleStyle}>🎯 公式オッズ確認</h4>
			<p style={blockDescriptionStyle}>
				3連単の全組み合わせを確認しながら、人気筋と妙味ゾーンを見ます。
			</p>
			<div style={sectionDividerStyle} />
		</div>
	</div>

	<BoatOddsPreview odds={odds} />
</section>

				<div style={sectionHeadingStyle}>
	<span style={sectionNumberStyle}>05</span>
	<div style={sectionHeadingTextStyle}>
		<p style={cardLabelStyle}>Result / Payout</p>
		<h4 style={blockTitleStyle}>🏁 レース結果サマリー</h4>
		<p style={blockDescriptionStyle}>
			着順・決まり手・払戻・スタート情報をまとめて確認できます。
		</p>
		<div style={sectionDividerStyle} />
	</div>
</div>

					{isConfirmed ? (
						<>
							<div style={resultSectionWrapStyle}>
								<div style={resultHeroStyle}>
									<p style={resultHeroLabelStyle}>RESULT</p>
									<p style={resultHeroValueStyle}>{resultSummary}</p>
								</div>

								<div style={resultMiniGridStyle}>
									<article style={resultMetaCardStyle}>
										<p style={resultMetaLabelStyle}>決まり手</p>
										<p style={resultMetaValueStyle}>{winningMethod}</p>
									</article>

									<article style={resultMetaCardStyle}>
										<p style={resultMetaLabelStyle}>確定時刻</p>
										<p style={resultMetaValueStyle}>{finalizedAt}</p>
									</article>

									<article style={resultMetaCardStyle}>
										<p style={resultMetaLabelStyle}>水面</p>
										<p style={resultMetaValueStyle}>{getWeatherSummaryText(weatherItems)}</p>
									</article>

									{refundText ? (
										<article style={resultMetaCardStyle}>
											<p style={resultMetaLabelStyle}>返還</p>
											<p style={resultMetaValueStyle}>{refundText}</p>
										</article>
									) : null}

									{remarks ? (
										<article style={resultMetaCardStyle}>
											<p style={resultMetaLabelStyle}>備考</p>
											<p style={resultMetaValueStyle}>{remarks}</p>
										</article>
									) : null}
								</div>

								<div style={resultDetailSectionStyle}>
									<p style={resultDetailTitleStyle}>全着順</p>
									{renderFinishersTable(finishers)}
								</div>

								<div style={resultDetailSectionStyle}>
									<p style={resultDetailTitleStyle}>スタート情報</p>
									{renderStartInfo(startInfo)}
								</div>

								<div style={payoutSectionStyle}>
									<p style={payoutSectionTitleStyle}>払戻一覧</p>

									{payoutItems.length > 0 ? (
										<div style={payoutGridStyle}>
											{payoutItems.map((item) => (
												<article key={`${item.betType}-${item.combination}-${item.payout}`} style={payoutCardStyle}>
													<p style={weatherLabelStyle}>{item.betType}</p>
													<p style={weatherValueStyle}>{item.combination}</p>
													<p style={{ ...weatherValueStyle, fontSize: "0.86rem", color: boatTheme.colors.muted }}>
														払戻 {item.payout}
														{typeof item.popularity === "number" ? ` / 人気 ${item.popularity}` : ""}
													</p>
												</article>
											))}
										</div>
									) : (
										<p style={quietNoteStyle}>払戻はまだ generated JSON に反映されていません。</p>
									)}
								</div>
							</div>
						</>
					) : (
						<p style={quietNoteStyle}>
							{remarks || "結果はまだ確定していません。更新後の generated JSON をお待ちください。"}
						</p>
					)}
				<div style={sectionDividerStyle} />
			</div>
		</div>
	);
}
