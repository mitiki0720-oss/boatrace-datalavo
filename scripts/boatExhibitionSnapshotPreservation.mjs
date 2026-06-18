import { readFile } from "node:fs/promises";

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

export function preserveTodayRaceDetailsFeed(feed, previousFeed, { generatedAt = feed?.generatedAt } = {}) {
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

	return { feed, preservedCount };
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
