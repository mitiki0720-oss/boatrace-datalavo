import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const write = (relativePath, value) => {
	const target = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const text = (value) => value === undefined || value === null ? "" : String(value).trim();
const registration = (value) => /^\d{4,6}$/.test(text(value)) && text(value) !== "0000" ? text(value) : null;
const number = (value) => {
	const match = text(value).replace(/^\./u, "0.").match(/-?\d+(?:\.\d+)?/u);
	const parsed = match ? Number(match[0]) : Number.NaN;
	return Number.isFinite(parsed) ? parsed : null;
};
const rate = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(4)) : null;
const median = (values) => {
	const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
	if (!sorted.length) return null;
	const middle = Math.floor(sorted.length / 2);
	return Number((sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2).toFixed(3));
};
const average = (values) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3)) : null;
const sampleLevel = (count) => count >= 10 ? "sufficient" : count >= 5 ? "limited" : "low-sample";
const band = (value, unit) => {
	const numeric = number(value);
	if (numeric === null) return "未取得";
	if (numeric <= 2) return `0-2${unit}`;
	if (numeric <= 5) return `3-5${unit}`;
	return `6${unit}以上`;
};
const increment = (map, key) => { if (key) map[key] = (map[key] ?? 0) + 1; };

const registry = read("public/data/boatrace-ex/identity/registered-racers.generated.json");
const index = read("public/data/boatrace-ex/index.generated.json");
const current = read("public/data/boatrace/today-race-details.generated.json");
const registryByRegistration = new Map((registry.identities ?? []).map((identity) => [identity.registrationNo, identity]));
const features = new Map();
const unresolved = { appearanceCount: 0, uniqueNames: new Set(), bySource: {}, parserDroppedRegistrationNo: 0, historicalSourceNameOnly: 0 };

for (const date of index.availableDates ?? []) {
	const history = read(`public/data/boatrace-ex/history/races/${date}.json`);
	for (const record of history.records ?? []) {
		const officialByLane = new Map((record.officialRace?.racers ?? []).map((racer) => [Number(racer.lane), racer]));
		for (const racer of record.racer ?? []) {
			const registrationNo = registration(racer.registrationNumber);
			if (!registrationNo || !registryByRegistration.has(registrationNo)) {
				unresolved.appearanceCount += 1;
				unresolved.uniqueNames.add(text(racer.racerName));
				const lane = Number(racer.lane);
				const officialRegistration = registration(officialByLane.get(lane)?.registrationNumber);
				if (officialRegistration && !registrationNo) unresolved.parserDroppedRegistrationNo += 1;
				else if (!registrationNo) unresolved.historicalSourceNameOnly += 1;
				increment(unresolved.bySource, text(racer.sources?.[0]?.sourceType) || "unknown");
				continue;
			}
			const identity = registryByRegistration.get(registrationNo);
			const entry = features.get(registrationNo) ?? {
				registrationNo,
				name: identity.canonicalRacerName,
				nameVariants: identity.nameVariants,
				branch: text(racer.branch) || null,
				className: text(racer.className) || null,
				events: [],
			};
			const lane = Number(racer.lane);
			const finishOrder = (record.officialResult?.finishOrder ?? []).indexOf(lane) + 1 || null;
			const startTiming = number(record.officialResult?.startTiming?.[lane]);
			entry.events.push({
				date,
				venueCode: text(record.venueCode), venueName: text(record.venueName), raceNo: Number(record.raceNo), lane,
				finishOrder, startTiming, winningTechnique: finishOrder === 1 ? text(record.officialResult?.winningTechnique) : "",
				weather: text(record.weather?.weather), windDirection: text(record.weather?.windDirection), windSpeedBand: band(record.weather?.windSpeedMps, "m"), waveHeightBand: band(record.weather?.waveHeightCm, "cm"), sessionType: text(record.sessionType),
			});
			features.set(registrationNo, entry);
		}
	}
}

const buildFeature = (entry) => {
	const events = [...entry.events].sort((left, right) => left.date.localeCompare(right.date));
	const starts = events.length;
	const top = (limit) => events.slice(-limit);
	const summarize = (items) => ({ starts: items.length, averageST: average(items.map((item) => item.startTiming).filter((value) => value !== null)), top3Rate: rate(items.filter((item) => item.finishOrder && item.finishOrder <= 3).length, items.length) });
	const byVenue = new Map(); const byFrame = new Map(); const methods = {}; const conditions = {};
	for (const event of events) {
		const venue = byVenue.get(event.venueCode) ?? { venueCode: event.venueCode, venueName: event.venueName, starts: 0, wins: 0, top2: 0, top3: 0 };
		venue.starts += 1; venue.wins += event.finishOrder === 1 ? 1 : 0; venue.top2 += event.finishOrder && event.finishOrder <= 2 ? 1 : 0; venue.top3 += event.finishOrder && event.finishOrder <= 3 ? 1 : 0; byVenue.set(event.venueCode, venue);
		const frame = byFrame.get(event.lane) ?? { frameNo: event.lane, starts: 0, wins: 0, top2: 0, top3: 0 };
		frame.starts += 1; frame.wins += event.finishOrder === 1 ? 1 : 0; frame.top2 += event.finishOrder && event.finishOrder <= 2 ? 1 : 0; frame.top3 += event.finishOrder && event.finishOrder <= 3 ? 1 : 0; byFrame.set(event.lane, frame);
		increment(methods, event.winningTechnique);
		increment(conditions, `${event.sessionType || "未取得"} / ${event.weather || "未取得"} / ${event.windSpeedBand} / ${event.waveHeightBand}`);
	}
	const stValues = events.map((event) => event.startTiming).filter((value) => value !== null);
	const variance = stValues.length ? stValues.reduce((sum, value) => sum + (value - average(stValues)) ** 2, 0) / stValues.length : null;
	return {
		registrationNo: entry.registrationNo, name: entry.name, nameVariants: entry.nameVariants, branch: entry.branch, className: entry.className,
		historyStarts: starts, firstSeen: events[0]?.date ?? null, lastSeen: events.at(-1)?.date ?? null, sourceCount: starts, sampleLevel: sampleLevel(starts),
		venues: [...byVenue.values()].map((item) => ({ ...item, winRate: rate(item.wins, item.starts), top2Rate: rate(item.top2, item.starts), top3Rate: rate(item.top3, item.starts), sampleLevel: sampleLevel(item.starts) })).sort((a, b) => b.starts - a.starts),
		frames: [...byFrame.values()].map((item) => ({ ...item, firstRate: rate(item.wins, item.starts), top2Rate: rate(item.top2, item.starts), top3Rate: rate(item.top3, item.starts), sampleLevel: sampleLevel(item.starts) })).sort((a, b) => a.frameNo - b.frameNo),
		startTiming: { sampleCount: stValues.length, average: average(stValues), median: median(stValues), standardDeviation: variance === null ? null : Number(Math.sqrt(variance).toFixed(3)), fastStartCount: stValues.filter((value) => value <= 0.1).length, lateStartCount: stValues.filter((value) => value >= 0.2).length, sampleLevel: sampleLevel(stValues.length) },
		winMethodCounts: methods,
		conditionSamples: Object.entries(conditions).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([condition, count]) => ({ condition, count, sampleLevel: sampleLevel(count) })),
		recent: { last5: summarize(top(5)), last10: summarize(top(10)), last30Days: summarize(events.filter((event) => event.date >= (events.at(-1)?.date ?? "").replace(/-\d\d$/u, "-01"))) },
		policy: "registrationNo exact registry identity only; source-backed historical descriptive statistics only",
	};
};

const racers = [...features.values()].map(buildFeature).sort((left, right) => left.registrationNo.localeCompare(right.registrationNo));
const currentSlots = (current.venues ?? []).flatMap((venue) => (venue.races ?? []).flatMap((race) => (race.racers ?? []).map((racer) => ({ venueCode: venue.venueCode, venueName: venue.venueName, raceNo: race.raceNo, frameNo: racer.frameNo, name: racer.name, registrationNo: registration(racer.registrationNo), source: venue.source ?? current.source }))));
const currentMissing = currentSlots.filter((slot) => !slot.registrationNo);
const currentExact = currentSlots.filter((slot) => slot.registrationNo && registryByRegistration.has(slot.registrationNo));
const generatedAt = new Date().toISOString();
const latest = { schemaVersion: 1, kind: "boatrace-ex-racer-features", generatedAt, identityPolicy: "registrationNo exact registry identity only; no name-only identity", sourceFiles: ["public/data/boatrace-ex/identity/registered-racers.generated.json", "public/data/boatrace-ex/index.generated.json", ...(index.availableDates ?? []).map((date) => `public/data/boatrace-ex/history/races/${date}.json`)], summary: { racerCount: racers.length, exactLinkedRacerCount: racers.length, lowSampleRacerCount: racers.filter((racer) => racer.sampleLevel === "low-sample").length, historyStartCount: racers.reduce((sum, racer) => sum + racer.historyStarts, 0), dateRange: { first: index.availableDates?.[0] ?? null, last: index.latestDate ?? null, dateCount: index.availableDates?.length ?? 0 } }, racers };
const audit = { schemaVersion: 1, kind: "boatrace-ex-racer-identity-unresolved-audit", auditDate: current.date, generatedAt, policy: "registrationNo exact only; name-only is never an exact identity", sourceFiles: ["public/data/boatrace/today.generated.json", "public/data/boatrace/today-race-details.generated.json", "public/data/boatrace-ex/identity/registered-racers.generated.json", "public/data/boatrace-ex/index.generated.json"], unresolved: { appearanceCount: unresolved.appearanceCount, uniqueRacerCount: unresolved.uniqueNames.size, bySource: unresolved.bySource, parserDroppedRegistrationNo: unresolved.parserDroppedRegistrationNo, historicalSourceNameOnly: unresolved.historicalSourceNameOnly }, currentDay: { date: current.date, venueCount: current.venues?.length ?? 0, raceCount: (current.venues ?? []).reduce((sum, venue) => sum + (venue.races?.length ?? 0), 0), slotCount: currentSlots.length, registrationPresentCount: currentSlots.length - currentMissing.length, registrationMissingCount: currentMissing.length, exactRegistryLinkedCount: currentExact.length, missingExamples: currentMissing.slice(0, 50) }, classifications: ["source-missing-registrationNo", "parser-dropped-registrationNo", "historical-source-name-only", "stale-generated-source", "foreign-racer-alias-needed", "unsafe-name-only", "unknown"] };
const summary = { schemaVersion: 1, kind: "boatrace-ex-racer-features-history-summary", generatedAt, ...latest.summary, unresolvedAuditPath: "public/data/boatrace-ex/audit/racer-identity-unresolved-audit-latest.generated.json" };
write("public/data/boatrace-ex/derived/racer-features/latest.json", latest);
write("public/data/boatrace-ex/derived/racer-features/history-summary.json", summary);
write(`public/data/boatrace-ex/audit/racer-identity-unresolved-audit-${current.date}.generated.json`, audit);
write("public/data/boatrace-ex/audit/racer-identity-unresolved-audit-latest.generated.json", audit);
console.log(JSON.stringify({ ok: true, featurePath: "public/data/boatrace-ex/derived/racer-features/latest.json", auditPath: summary.unresolvedAuditPath, ...latest.summary, currentDay: audit.currentDay, unresolved: audit.unresolved }, null, 2));
