import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

const EXPLICIT_NO_PRESERVE_PATTERN =
	/欠場|中止|不成立|返還|取消|艇変更|再展示|absence|cancel|cancelled|canceled|withdraw|withdrawn|scratch|scratched|refund|no[-\s]?race|re[-\s]?exhibition/i;
const TRANSIENT_EXHIBITION_STATUS_PATTERN =
	/^(?:scheduled|pending|not-published|waiting(?:$|[-_\s]))/i;

export async function readJsonIfExists(filePath) {
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch (error) {
		if (error?.code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

function toArray(value) {
	return Array.isArray(value) ? value : [];
}

function readText(value) {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "string") {
		return value.trim();
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return "";
}

function normalizeRaceNo(value) {
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function venueKey(venue) {
	return readText(venue?.venueCode) || readText(venue?.venueName) || readText(venue?.id);
}

function mapVenuesByKey(feed) {
	return new Map(toArray(feed?.venues).map((venue) => [venueKey(venue), venue]).filter(([key]) => key));
}

function mapRacesByNo(venue) {
	return new Map(toArray(venue?.races).map((race) => [normalizeRaceNo(race?.raceNo), race]).filter(([raceNo]) => raceNo !== null));
}

function getStatusTexts(race) {
	const officialBeforeInfo = race?.officialBeforeInfo ?? {};
	const sourceStatus = race?.sourceStatus ?? {};
	return [
		race?.status,
		race?.raceStatus,
		race?.resultStatus,
		race?.participationStatus,
		race?.exhibitionParticipationStatus,
		race?.cancelReason,
		race?.reason,
		race?.note,
		race?.notes,
		race?.memo,
		race?.resultText,
		race?.decision,
		race?.result?.status,
		race?.result?.notes,
		race?.result?.remarks,
		officialBeforeInfo?.status,
		officialBeforeInfo?.note,
		officialBeforeInfo?.notes,
		sourceStatus?.officialBeforeInfo,
		sourceStatus?.beforeInfo,
		sourceStatus?.startExhibition,
		sourceStatus?.originalExhibition,
	].map(readText).filter(Boolean);
}

export function hasExplicitExhibitionNoPreserveState(race) {
	return getStatusTexts(race).some((text) => EXPLICIT_NO_PRESERVE_PATTERN.test(text));
}

export function hasTransientExhibitionPublicationState(...races) {
	return races
		.flatMap((race) => getStatusTexts(race))
		.some((text) => TRANSIENT_EXHIBITION_STATUS_PATTERN.test(text));
}

export function countDetailsExhibitionRows(race) {
	return toArray(race?.exhibitions).length;
}

export function countVenueExtraExhibitionRows(race) {
	const officialBeforeInfo = race?.officialBeforeInfo ?? {};
	return (
		toArray(officialBeforeInfo.exhibitionRows).length +
		toArray(officialBeforeInfo.startExhibition).length +
		toArray(race?.beforeInfo).length +
		toArray(race?.startExhibition).length +
		toArray(race?.originalExhibition).length
	);
}

export function countDisplayExhibitionRows({ detailRace, extraRace }) {
	return countDetailsExhibitionRows(detailRace) + countVenueExtraExhibitionRows(extraRace);
}

function createPreservationMetadata({ generatedAt, previousFeed, previousRace, preservedFields, reason }) {
	return {
		preservedFromPreviousSnapshot: true,
		preservedAt: generatedAt,
		preservedReason: reason,
		previousCapturedAt: previousRace?.exhibitionSnapshotPreservation?.previousCapturedAt ?? previousRace?.updatedAt ?? previousFeed?.generatedAt ?? null,
		preservedFields,
	};
}

function copyIfMissing(target, source, fields, preservedFields, labelPrefix = "") {
	for (const field of fields) {
		const targetValue = target[field];
		const sourceValue = source?.[field];
		const targetEmpty = Array.isArray(targetValue) ? targetValue.length === 0 : targetValue === undefined || targetValue === null || targetValue === "";
		const sourceHasValue = Array.isArray(sourceValue) ? sourceValue.length > 0 : sourceValue !== undefined && sourceValue !== null && sourceValue !== "";
		if (targetEmpty && sourceHasValue) {
			target[field] = sourceValue;
			preservedFields.push(`${labelPrefix}${field}`);
		}
	}
}

function markSourceAvailable(race, fields) {
	if (!race.sourceStatus || typeof race.sourceStatus !== "object") {
		race.sourceStatus = {};
	}
	for (const field of fields) {
		if (field.includes("officialBeforeInfo") || field === "beforeInfo") {
			race.sourceStatus.officialBeforeInfo = "preserved";
			race.sourceStatus.beforeInfo = "preserved";
		}
		if (field.includes("startExhibition")) {
			race.sourceStatus.startExhibition = "preserved";
		}
		if (field.includes("originalExhibition")) {
			race.sourceStatus.originalExhibition = "preserved";
		}
	}
}

const RESULT_INVALIDATION_STATUSES = new Set(["cancelled", "canceled", "no-race", "invalid"]);
const RESULT_PAYOUT_FIELDS = [
	"payout3tan", "payout2tan", "payout3fuku", "payout2fuku", "payoutWide",
	"payoutWin", "payoutPlace", "payouts", "payoutsFull", "refunds", "refundText",
];

function isConfirmedResult(result) {
	return toArray(result?.finishOrder).length >= 3 &&
		(["confirmed", "finished"].includes(readText(result?.status)) || Boolean(result?.finalizedAt));
}

function finishOrderKey(result) {
	return toArray(result?.finishOrder).slice(0, 3).map(String).join("-");
}

function hasValue(value) {
	return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== "";
}

export function hasOfficialResultIdentity(race, date, venueCode, previousResult) {
	const result = race?.result;
	if (!readText(result?.source).startsWith("official:owpc-html+")) return false;
	const fetchedAt = Date.parse(readText(result?.fetchedAt));
	const previousAt = Math.max(
		Date.parse(readText(previousResult?.finalizedAt)) || 0,
		Date.parse(readText(previousResult?.fetchedAt)) || 0,
	);
	if (!Number.isFinite(fetchedAt) || (Number.isFinite(previousAt) && fetchedAt <= previousAt)) return false;
	try {
		const url = new URL(readText(result?.sourceUrl));
		return url.protocol === "https:" && url.hostname === "www.boatrace.jp" &&
			url.pathname === "/owpc/pc/race/raceresult" &&
			url.searchParams.get("hd") === date.replaceAll("-", "") &&
			url.searchParams.get("jcd") === readText(venueCode).padStart(2, "0") &&
			Number(url.searchParams.get("rno")) === normalizeRaceNo(race?.raceNo);
	} catch {
		return false;
	}
}

export function hasExplicitOfficialResultInvalidation(race, date, venueCode, previousResult) {
	const result = race?.result;
	return RESULT_INVALIDATION_STATUSES.has(readText(result?.status)) &&
		/中止|不成立|全額返還/.test(readText(result?.notes ?? result?.remarks)) &&
		hasOfficialResultIdentity(race, date, venueCode, previousResult);
}

function preserveOfficialResult(race, previousRace, date, venueCode, generatedAt, previousFeed) {
	const previousResult = previousRace?.result;
	if (!isConfirmedResult(previousResult)) return null;
	if (hasExplicitOfficialResultInvalidation(race, date, venueCode, previousResult)) return null;
	const result = race?.result;
	let preservedFields = [];
	let reason = "";
	if (!isConfirmedResult(result) || !["confirmed", "finished"].includes(readText(result?.status))) {
		race.result = previousResult;
		preservedFields = ["result"];
		reason = "new official result is pending, unavailable, or incomplete";
	} else if (finishOrderKey(result) === finishOrderKey(previousResult)) {
		const payoutChanged = RESULT_PAYOUT_FIELDS.some((field) =>
			hasValue(result[field]) && hasValue(previousResult[field]) && !isDeepStrictEqual(result[field], previousResult[field]));
		if (payoutChanged && !hasOfficialResultIdentity(race, date, venueCode, previousResult)) {
			race.result = previousResult;
			preservedFields = ["result"];
			reason = "unverified official payout correction";
		} else if (!payoutChanged) {
			copyIfMissing(result, previousResult, RESULT_PAYOUT_FIELDS, preservedFields, "result.");
			if (preservedFields.length) reason = "same finish order but new official payout fields are missing";
		}
	} else if (!hasOfficialResultIdentity(race, date, venueCode, previousResult)) {
		race.result = previousResult;
		preservedFields = ["result"];
		reason = "unverified official finish-order correction";
	}
	if (!preservedFields.length) return null;
	const previousCapturedAt = previousResult.finalizedAt ?? previousFeed?.generatedAt ?? null;
		race.resultSnapshotPreservation = {
		preservedFromPreviousSnapshot: true,
		preservedAt: generatedAt,
		previousCapturedAt,
		preservedFields,
		reason,
	};
	return `${venueCode}#${race.raceNo}: ${reason} (${preservedFields.join(", ")})`;
}

export function preserveTodayRaceDetailsFeed(feed, previousFeed, { generatedAt = feed?.generatedAt } = {}) {
	if (!feed || !previousFeed || feed.date !== previousFeed.date) {
		return { feed, preservedCount: 0, preservedResultCount: 0, resultReasons: [] };
	}

	const previousVenues = mapVenuesByKey(previousFeed);
	let preservedCount = 0;
	const resultReasons = [];

	for (const venue of toArray(feed.venues)) {
		const previousVenue = previousVenues.get(venueKey(venue));
		const previousRaces = mapRacesByNo(previousVenue);

		for (const race of toArray(venue.races)) {
			const previousRace = previousRaces.get(normalizeRaceNo(race?.raceNo));
			if (!previousRace || (venue.date && venue.date !== feed.date) ||
				(previousVenue?.date && previousVenue.date !== feed.date)) {
				continue;
			}
			const resultReason = preserveOfficialResult(race, previousRace, feed.date, venue.venueCode, generatedAt, previousFeed);
			if (resultReason) resultReasons.push(resultReason);
			if (hasExplicitExhibitionNoPreserveState(race)) {
				continue;
			}
			if (countDetailsExhibitionRows(race) > 0 || countDetailsExhibitionRows(previousRace) === 0) {
				continue;
			}

			const preservedFields = [];
			race.exhibitions = previousRace.exhibitions;
			preservedFields.push("exhibitions");
			copyIfMissing(race, previousRace, ["weatherActual", "deadlineTime", "startTime", "updatedAt"], preservedFields);
			race.exhibitionSnapshotPreservation = createPreservationMetadata({
				generatedAt,
				previousFeed,
				previousRace,
				preservedFields,
				reason: "current beforeinfo fetch returned no exhibition rows after a prior snapshot had them",
			});
			preservedCount += 1;
		}
	}

	return { feed, preservedCount, preservedResultCount: resultReasons.length, resultReasons };
}

export function preserveVenueExtrasFeed(feed, previousFeed, { generatedAt = feed?.generatedAt } = {}) {
	if (!feed || !previousFeed || feed.date !== previousFeed.date) {
		return { feed, preservedCount: 0 };
	}

	const previousVenues = mapVenuesByKey(previousFeed);
	let preservedCount = 0;

	for (const venue of toArray(feed.venues)) {
		const previousVenue = previousVenues.get(venueKey(venue));
		const previousRaces = mapRacesByNo(previousVenue);

		for (const race of toArray(venue.races)) {
			const previousRace = previousRaces.get(normalizeRaceNo(race?.raceNo));
			if (!previousRace || hasExplicitExhibitionNoPreserveState(race)) {
				continue;
			}
			if (countVenueExtraExhibitionRows(race) > 0 || countVenueExtraExhibitionRows(previousRace) === 0) {
				continue;
			}

			const preservedFields = [];
			const previousOfficialBeforeInfo = previousRace.officialBeforeInfo ?? {};
			const officialBeforeInfo = {
				...(race.officialBeforeInfo ?? {}),
			};
			copyIfMissing(
				officialBeforeInfo,
				previousOfficialBeforeInfo,
				["exhibitionRows", "startExhibition", "weatherCondition", "weatherActual", "deadline", "updatedAt"],
				preservedFields,
				"officialBeforeInfo.",
			);
			if (preservedFields.length > 0) {
				officialBeforeInfo.status = officialBeforeInfo.status === "waiting" || !officialBeforeInfo.status ? "available" : officialBeforeInfo.status;
				race.officialBeforeInfo = officialBeforeInfo;
			}

			copyIfMissing(
				race,
				previousRace,
				["beforeInfo", "startExhibition", "originalExhibition", "weatherCondition", "waterSurface", "waterSurfaceInfo", "deadline", "deadlineTime", "updatedAt"],
				preservedFields,
			);

			if (!preservedFields.length) {
				continue;
			}

			markSourceAvailable(race, preservedFields);
			race.exhibitionSnapshotPreservation = createPreservationMetadata({
				generatedAt,
				previousFeed,
				previousRace,
				preservedFields,
				reason: "current venue extras fetch returned no exhibition rows after a prior snapshot had them",
			});
			preservedCount += 1;
		}
	}

	return { feed, preservedCount };
}

export function findUnexplainedExhibitionGaps(detailsFeed, venueExtrasFeed) {
	const extraVenues = mapVenuesByKey(venueExtrasFeed);
	const gaps = [];

	for (const venue of toArray(detailsFeed?.venues)) {
		const extraVenue = extraVenues.get(venueKey(venue));
		const extraRaces = mapRacesByNo(extraVenue);
		const rows = toArray(venue.races)
			.map((race) => {
				const raceNo = normalizeRaceNo(race?.raceNo);
				const extraRace = extraRaces.get(raceNo);
				return {
					raceNo,
					detailRace: race,
					extraRace,
					count: countDisplayExhibitionRows({ detailRace: race, extraRace }),
				};
			})
			.filter((race) => race.raceNo !== null)
			.sort((left, right) => left.raceNo - right.raceNo);

		for (const row of rows) {
			const laterPublishedRace = rows.find((candidate) => candidate.raceNo > row.raceNo && candidate.count > 0);
			if (row.count > 0 || !laterPublishedRace) {
				continue;
			}
			if (hasExplicitExhibitionNoPreserveState(row.detailRace) || hasExplicitExhibitionNoPreserveState(row.extraRace)) {
				continue;
			}
			if (row.detailRace?.exhibitionSnapshotPreservation?.preservedFromPreviousSnapshot || row.extraRace?.exhibitionSnapshotPreservation?.preservedFromPreviousSnapshot) {
				continue;
			}

			gaps.push({
				venueCode: venue.venueCode ?? extraVenue?.venueCode ?? "",
				venueName: venue.venueName ?? extraVenue?.venueName ?? "",
				raceNo: row.raceNo,
				laterPublishedRaceNo: laterPublishedRace.raceNo,
				raceCounts: Object.fromEntries(rows.map((race) => [race.raceNo, race.count])),
				status: row.detailRace?.status ?? row.extraRace?.status ?? "",
				severity: hasTransientExhibitionPublicationState(row.detailRace, row.extraRace) ? "warning" : "error",
			});
		}
	}

	return gaps;
}
