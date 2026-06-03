import type { BoatRaceItem } from "./boatraceTypes";
import type { BoatVenueExtraRace } from "./boatVenueExtrasFeed";

export type BoatExhibitionParticipationAlertStatus =
	| "withdrawn"
	| "exhibition-missing-needs-confirmation"
	| "partial-exhibition-data";

export type BoatExhibitionParticipationAlert = {
	frameNo: number;
	registrationNo?: string;
	racerName?: string;
	status: BoatExhibitionParticipationAlertStatus;
	officialConfirmed: boolean;
	excludeFromPrediction: boolean;
	needsManualCheck: boolean;
	officialReasonText?: string;
	missingSources: string[];
};

export type BoatExhibitionParticipationSummary = {
	alerts: BoatExhibitionParticipationAlert[];
	raceLevelLabel?: string;
};

const EXPLICIT_WITHDRAWN_PATTERN =
	/欠場|出走取消|出走取り消し|取消|転覆|不参加|withdraw|withdrawn|scratch|scratched|cancel/i;

const toRecord = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
	if (Array.isArray(value)) {
		return value.filter((item): item is Record<string, unknown> => Boolean(toRecord(item)));
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, unknown>).filter((item): item is Record<string, unknown> => Boolean(toRecord(item)));
	}

	return [];
};

const readString = (value: unknown): string => {
	if (typeof value === "number") {
		return String(value);
	}

	if (typeof value !== "string") {
		return "";
	}

	const text = value.trim();
	return text && text.toLowerCase() !== "undefined" && text.toLowerCase() !== "null" ? text : "";
};

const readNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	const text = readString(value).normalize("NFKC");
	if (!text) {
		return null;
	}

	const parsed = Number(text);
	return Number.isFinite(parsed) ? parsed : null;
};

const readFrameNo = (row: Record<string, unknown>): number | null =>
	readNumber(row.frameNo) ?? readNumber(row.frame) ?? readNumber(row.waku) ?? readNumber(row.boatNo);

const readRegistrationNo = (row: Record<string, unknown>): string =>
	readString(row.registrationNo) || readString(row.registerNo) || readString(row.racerNo) || readString(row.playerNo);

const readRacerName = (row: Record<string, unknown>): string =>
	readString(row.racerName) || readString(row.playerName) || readString(row.name);

const getOfficialBeforeInfo = (raceExtra?: BoatVenueExtraRace | null): Record<string, unknown> | null =>
	toRecord(raceExtra?.officialBeforeInfo);

const getRaceSourceRows = (raceExtra?: BoatVenueExtraRace | null) => {
	const officialBeforeInfo = getOfficialBeforeInfo(raceExtra);
	const venueStartRows = toRecordArray(raceExtra?.startExhibition);

	return [
		{
			key: "officialBeforeInfo.exhibitionRows",
			rows: toRecordArray(officialBeforeInfo?.exhibitionRows),
		},
		{
			key: "startExhibition",
			rows: venueStartRows.length > 0 ? venueStartRows : toRecordArray(officialBeforeInfo?.startExhibition),
		},
		{
			key: "originalExhibition",
			rows: toRecordArray(raceExtra?.originalExhibition),
		},
	];
};

const hasExplicitWithdrawnText = (record: Record<string, unknown> | null | undefined): string => {
	if (!record) {
		return "";
	}

	const values = [
		record.status,
		record.raceStatus,
		record.resultStatus,
		record.participationStatus,
		record.exhibitionParticipationStatus,
		record.cancelReason,
		record.reason,
		record.note,
		record.notes,
		record.memo,
		record.officialReasonText,
		record.resultText,
		record.decision,
	];

	for (const value of values) {
		const text = readString(value);
		if (text && EXPLICIT_WITHDRAWN_PATTERN.test(text)) {
			return text;
		}
	}

	return "";
};

const buildExplicitAlerts = (
	racers: Record<string, unknown>[],
	raceExtra?: BoatVenueExtraRace | null,
): BoatExhibitionParticipationAlert[] => {
	const racerByFrame = new Map<number, Record<string, unknown>>();
	for (const racer of racers) {
		const frameNo = readFrameNo(racer);
		if (frameNo) {
			racerByFrame.set(frameNo, racer);
		}
	}

	const explicitRows = [
		...toRecordArray(raceExtra?.participationAlerts),
		...toRecordArray(raceExtra?.exhibitionParticipationStatus),
		...toRecordArray(raceExtra?.raceWarnings),
	];
	const sourceRows = getRaceSourceRows(raceExtra).flatMap((source) => source.rows);
	const alerts = new Map<number, BoatExhibitionParticipationAlert>();

	for (const row of [...explicitRows, ...sourceRows, ...racers]) {
		const reason = hasExplicitWithdrawnText(row);
		if (!reason) {
			continue;
		}

		const frameNo = readFrameNo(row);
		if (!frameNo || frameNo < 1 || frameNo > 6) {
			continue;
		}

		const racer = racerByFrame.get(frameNo);
		alerts.set(frameNo, {
			frameNo,
			registrationNo: readRegistrationNo(row) || (racer ? readRegistrationNo(racer) : undefined),
			racerName: readRacerName(row) || (racer ? readRacerName(racer) : undefined),
			status: "withdrawn",
			officialConfirmed: true,
			excludeFromPrediction: true,
			needsManualCheck: false,
			officialReasonText: reason,
			missingSources: [],
		});
	}

	return [...alerts.values()].sort((left, right) => left.frameNo - right.frameNo);
};

const buildInferredExhibitionAlerts = (
	racers: Record<string, unknown>[],
	raceExtra?: BoatVenueExtraRace | null,
	existingFrameNos = new Set<number>(),
): BoatExhibitionParticipationAlert[] => {
	const sources = getRaceSourceRows(raceExtra);
	const populatedSources = sources.filter((source) => source.rows.length > 0);
	if (populatedSources.length === 0) {
		return [];
	}

	const hasPartialRaceSource = populatedSources.some((source) => source.rows.length > 0 && source.rows.length < 6);
	if (!hasPartialRaceSource) {
		return [];
	}

	const alerts: BoatExhibitionParticipationAlert[] = [];
	for (const racer of racers) {
		const frameNo = readFrameNo(racer);
		if (!frameNo || frameNo < 1 || frameNo > 6 || existingFrameNos.has(frameNo)) {
			continue;
		}

		const presentSources = sources.filter((source) => source.rows.some((row) => readFrameNo(row) === frameNo));
		const missingSources = populatedSources
			.filter((source) => !source.rows.some((row) => readFrameNo(row) === frameNo))
			.map((source) => source.key);

		if (missingSources.length === 0) {
			continue;
		}

		const status: BoatExhibitionParticipationAlertStatus =
			presentSources.length === 0 ? "exhibition-missing-needs-confirmation" : "partial-exhibition-data";

		alerts.push({
			frameNo,
			registrationNo: readRegistrationNo(racer) || undefined,
			racerName: readRacerName(racer) || undefined,
			status,
			officialConfirmed: false,
			excludeFromPrediction: false,
			needsManualCheck: status === "exhibition-missing-needs-confirmation",
			officialReasonText: status === "exhibition-missing-needs-confirmation"
				? "他艇の展示は公開済みですが、この艇の展示関連データが見つかりません。"
				: "展示関連データの一部が欠けています。",
			missingSources,
		});
	}

	return alerts.sort((left, right) => left.frameNo - right.frameNo);
};

export function resolveBoatExhibitionParticipationSummary(
	race?: BoatRaceItem | null,
	raceExtra?: BoatVenueExtraRace | null,
): BoatExhibitionParticipationSummary {
	const racers = toRecordArray(race?.racers);
	const sources = getRaceSourceRows(raceExtra);
	const anyExhibitionRows = sources.some((source) => source.rows.length > 0);
	const raceExtraRecord = toRecord(raceExtra);
	const officialBeforeInfo = getOfficialBeforeInfo(raceExtra);
	const raceReason = hasExplicitWithdrawnText(raceExtraRecord) || hasExplicitWithdrawnText(officialBeforeInfo);

	if (!anyExhibitionRows && raceExtra && !raceReason) {
		return {
			alerts: [],
			raceLevelLabel: "展示未公開",
		};
	}

	const explicitAlerts = buildExplicitAlerts(racers, raceExtra);
	const inferredAlerts = buildInferredExhibitionAlerts(
		racers,
		raceExtra,
		new Set(explicitAlerts.map((alert) => alert.frameNo)),
	);

	return {
		alerts: [...explicitAlerts, ...inferredAlerts].sort((left, right) => left.frameNo - right.frameNo),
		raceLevelLabel: raceReason && explicitAlerts.length === 0 ? raceReason : undefined,
	};
}

export function formatBoatExhibitionParticipationAlertLabel(alert: BoatExhibitionParticipationAlert): string {
	if (alert.status === "withdrawn") {
		return alert.officialReasonText?.includes("取消") ? "出走取消" : "欠場";
	}

	if (alert.status === "exhibition-missing-needs-confirmation") {
		return "出走可否要確認";
	}

	return "展示データ一部欠測";
}
