import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const OUTPUT_PATH =
        "public/data/boatrace-ex/derived/rough-index/latest.json";

const DERIVED_MANIFEST_PATH =
        "public/data/boatrace-ex/derived/manifest.generated.json";

const DATE_INDEX_PATH =
        "public/data/boatrace-ex/index.generated.json";

const MIN_DATE_COUNT = 7;
const MIN_PAYOUT_RACE_COUNT = 30;
const HIGH_TRIFECTA_PAYOUT_YEN = 10_000;

const FORBIDDEN_KEYS = new Set([
        "score",
        "roughscore",
        "ranking",
        "rank",
        "recommend",
        "recommendation",
        "prediction",
        "label",
        "confidence",
]);

function absolute(relativePath) {
        return path.join(
                repoRoot,
                ...relativePath.split("/"),
        );
}

function readJson(relativePath) {
        return JSON.parse(
                fs.readFileSync(
                        absolute(relativePath),
                        "utf8",
                ),
        );
}

function assert(condition, message, errors) {
        if (!condition) {
                errors.push(message);
        }
}

function parseYen(value) {
        if (typeof value === "number") {
                return Number.isFinite(value) && value >= 0
                        ? Math.round(value)
                        : null;
        }

        if (typeof value !== "string") {
                return null;
        }

        const normalized = value
                .normalize("NFKC")
                .replace(/[,\s円¥￥]/g, "");

        if (!/^\d+$/.test(normalized)) {
                return null;
        }

        const amount = Number(normalized);

        return Number.isSafeInteger(amount) && amount >= 0
                ? amount
                : null;
}

function payoutTypeText(item) {
        if (
                !item ||
                typeof item !== "object" ||
                Array.isArray(item)
        ) {
                return "";
        }

        return [
                item.betType,
                item.type,
                item.name,
        ]
                .filter(
                        (value) =>
                                typeof value === "string",
                )
                .join(" ")
                .normalize("NFKC")
                .toLowerCase();
}

function isTrifectaPayout(item) {
        const typeText = payoutTypeText(item);

        return (
                typeText.includes("3連単") ||
                typeText.includes("三連単") ||
                typeText.includes("trifecta")
        );
}

function payoutAmount(item) {
        if (
                !item ||
                typeof item !== "object" ||
                Array.isArray(item)
        ) {
                return null;
        }

        const candidates = [
                item.payoutYen,
                item.amount,
                item.payoutAmount,
                item.payout,
                item.yen,
        ];

        for (const candidate of candidates) {
                const amount = parseYen(candidate);

                if (amount !== null) {
                        return amount;
                }
        }

        return null;
}

function findTrifectaPayout(record) {
        const payouts =
                Array.isArray(
                        record?.officialResult?.payout,
                )
                        ? record.officialResult.payout
                        : [];

        for (const item of payouts) {
                if (!isTrifectaPayout(item)) {
                        continue;
                }

                const amount = payoutAmount(item);

                if (amount !== null) {
                        return amount;
                }
        }

        return null;
}

function hasResult(record) {
        const finishOrder =
                record?.officialResult?.finishOrder;

        return (
                Array.isArray(finishOrder) &&
                finishOrder.length >= 3 &&
                finishOrder
                        .slice(0, 3)
                        .every((boatNumber) => {
                                const value =
                                        Number(boatNumber);

                                return (
                                        Number.isInteger(
                                                value,
                                        ) &&
                                        value >= 1 &&
                                        value <= 6
                                );
                        })
        );
}

function buildReadiness(
        dateCount,
        payoutAvailableRaceCount,
) {
        const reasons = [];

        if (dateCount < MIN_DATE_COUNT) {
                reasons.push(
                        `dateCount ${dateCount} is below minDateCount ${MIN_DATE_COUNT}`,
                );
        }

        if (
                payoutAvailableRaceCount <
                MIN_PAYOUT_RACE_COUNT
        ) {
                reasons.push(
                        `payoutAvailableRaceCount ${payoutAvailableRaceCount} is below minPayoutRaceCount ${MIN_PAYOUT_RACE_COUNT}`,
                );
        }

        return {
                status:
                        reasons.length > 0
                                ? "insufficient-history"
                                : "ready",
                reason:
                        reasons.length > 0
                                ? reasons.join("; ")
                                : "history and payout samples meet the minimum thresholds",
                minDateCount: MIN_DATE_COUNT,
                minPayoutRaceCount:
                        MIN_PAYOUT_RACE_COUNT,
        };
}

function collectExpected(index, errors) {
        const dates = [
                ...new Set(
                        index.availableDates ?? [],
                ),
        ].sort();

        assert(
                dates.length > 0,
                "date index availableDates must not be empty",
                errors,
        );

        const venues = new Map();

        let raceCount = 0;
        let resultAvailableRaceCount = 0;
        let payoutAvailableRaceCount = 0;
        let trifectaAvailableRaceCount = 0;
        let trifectaOver10000RaceCount = 0;

        for (const date of dates) {
                const historyPath =
                        `public/data/boatrace-ex/history/races/${date}.json`;

                const history = readJson(historyPath);

                assert(
                        history.date === date,
                        `${historyPath}: history.date mismatch`,
                        errors,
                );

                assert(
                        Array.isArray(history.records),
                        `${historyPath}: history.records must be an array`,
                        errors,
                );

                const records =
                        Array.isArray(history.records)
                                ? history.records
                                : [];

                for (
                        let index = 0;
                        index < records.length;
                        index += 1
                ) {
                        const record = records[index];

                        const location =
                                `${historyPath} records[${index}]`;

                        assert(
                                record?.date === date,
                                `${location}: date mismatch`,
                                errors,
                        );

                        assert(
                                typeof record?.venueCode ===
                                        "string" &&
                                        record.venueCode.length >
                                                0,
                                `${location}: venueCode is required`,
                                errors,
                        );

                        assert(
                                typeof record?.venueName ===
                                        "string" &&
                                        record.venueName.length >
                                                0,
                                `${location}: venueName is required`,
                                errors,
                        );

                        if (
                                !record?.venueCode ||
                                !record?.venueName
                        ) {
                                continue;
                        }

                        const venue =
                                venues.get(
                                        record.venueCode,
                                ) ?? {
                                        venueId:
                                                record.venueCode,
                                        venueName:
                                                record.venueName,
                                        dates: new Set(),
                                        raceCount: 0,
                                        resultAvailableRaceCount:
                                                0,
                                        payoutAvailableRaceCount:
                                                0,
                                        trifectaAvailableRaceCount:
                                                0,
                                        trifectaOver10000RaceCount:
                                                0,
                                };

                        assert(
                                venue.venueName ===
                                        record.venueName,
                                `${location}: venueName is inconsistent`,
                                errors,
                        );

                        venue.dates.add(date);
                        venue.raceCount += 1;
                        raceCount += 1;

                        if (hasResult(record)) {
                                venue.resultAvailableRaceCount +=
                                        1;

                                resultAvailableRaceCount +=
                                        1;
                        }

                        const trifectaPayout =
                                findTrifectaPayout(record);

                        if (trifectaPayout !== null) {
                                venue.payoutAvailableRaceCount +=
                                        1;

                                venue.trifectaAvailableRaceCount +=
                                        1;

                                payoutAvailableRaceCount += 1;
                                trifectaAvailableRaceCount += 1;

                                if (
                                        trifectaPayout >=
                                        HIGH_TRIFECTA_PAYOUT_YEN
                                ) {
                                        venue.trifectaOver10000RaceCount +=
                                                1;

                                        trifectaOver10000RaceCount +=
                                                1;
                                }
                        }

                        venues.set(
                                record.venueCode,
                                venue,
                        );
                }
        }

        return {
                dates,
                raceCount,
                venueCount: venues.size,
                resultAvailableRaceCount,
                payoutAvailableRaceCount,
                trifectaAvailableRaceCount,
                trifectaOver10000RaceCount,
                venues: [...venues.values()]
                        .map((venue) => ({
                                venueId:
                                        venue.venueId,
                                venueName:
                                        venue.venueName,
                                dateCount:
                                        venue.dates.size,
                                raceCount:
                                        venue.raceCount,
                                resultAvailableRaceCount:
                                        venue.resultAvailableRaceCount,
                                payoutAvailableRaceCount:
                                        venue.payoutAvailableRaceCount,
                                trifectaAvailableRaceCount:
                                        venue.trifectaAvailableRaceCount,
                                trifectaOver10000RaceCount:
                                        venue.trifectaOver10000RaceCount,
                                readiness:
                                        buildReadiness(
                                                venue.dates
                                                        .size,
                                                venue.payoutAvailableRaceCount,
                                        ),
                        }))
                        .sort((left, right) =>
                                left.venueId.localeCompare(
                                        right.venueId,
                                        "ja",
                                ),
                        ),
        };
}

function walk(
        value,
        visitor,
        pathParts = [],
) {
        if (Array.isArray(value)) {
                value.forEach((item, index) =>
                        walk(
                                item,
                                visitor,
                                [
                                        ...pathParts,
                                        String(index),
                                ],
                        ),
                );

                return;
        }

        if (
                !value ||
                typeof value !== "object"
        ) {
                return;
        }

        for (const [key, child] of Object.entries(value)) {
                const location = [
                        ...pathParts,
                        key,
                ].join(".");

                visitor(
                        key,
                        child,
                        location,
                );

                walk(
                        child,
                        visitor,
                        [...pathParts, key],
                );
        }
}

function validateNoForbiddenFields(
        value,
        errors,
) {
        walk(
                value,
                (key, child, location) => {
                        assert(
                                !FORBIDDEN_KEYS.has(
                                        key.toLowerCase(),
                                ),
                                `${location}: prohibited score, ranking, prediction, or confidence field`,
                                errors,
                        );

                        if (
                                typeof child === "string"
                        ) {
                                assert(
                                        !child.startsWith(
                                                "public/data/reviews/",
                                        ),
                                        `${location}: reviews path is prohibited`,
                                        errors,
                                );

                                assert(
                                        !/^public\/data\/boatrace\/[^/]+\.generated\.json$/.test(
                                                child,
                                        ),
                                        `${location}: direct operational source is prohibited`,
                                        errors,
                                );
                        }
                },
        );
}

function sameJson(left, right) {
        return (
                JSON.stringify(left) ===
                JSON.stringify(right)
        );
}

function main() {
        const index = readJson(DATE_INDEX_PATH);
        const output = readJson(OUTPUT_PATH);
        const manifest =
                readJson(DERIVED_MANIFEST_PATH);

        const errors = [];

        const expected =
                collectExpected(index, errors);

        const expectedSourceFiles = [
                DATE_INDEX_PATH,
                ...expected.dates.map(
                        (date) =>
                                `public/data/boatrace-ex/history/races/${date}.json`,
                ),
        ];

        const expectedReadiness =
                buildReadiness(
                        expected.dates.length,
                        expected.payoutAvailableRaceCount,
                );

        assert(
                output.schemaVersion ===
                        "boat-ex-rough-index-v1",
                "schemaVersion must be boat-ex-rough-index-v1",
                errors,
        );

        assert(
                output.status === "available",
                "status must be available",
                errors,
        );

        assert(
                output.dateRange?.from ===
                        expected.dates[0],
                "dateRange.from mismatch",
                errors,
        );

        assert(
                output.dateRange?.to ===
                        expected.dates.at(-1),
                "dateRange.to mismatch",
                errors,
        );

        assert(
                sameJson(
                        output.dateRange?.dates,
                        expected.dates,
                ),
                "dateRange.dates must match index availableDates",
                errors,
        );

        assert(
                output.dateRange?.dateCount ===
                        expected.dates.length,
                "dateRange.dateCount mismatch",
                errors,
        );

        assert(
                output.thresholds
                        ?.highTrifectaPayoutYen ===
                        HIGH_TRIFECTA_PAYOUT_YEN,
                "thresholds.highTrifectaPayoutYen mismatch",
                errors,
        );

        assert(
                output.thresholds?.minDateCount ===
                        MIN_DATE_COUNT,
                "thresholds.minDateCount mismatch",
                errors,
        );

        assert(
                output.thresholds
                        ?.minPayoutRaceCount ===
                        MIN_PAYOUT_RACE_COUNT,
                "thresholds.minPayoutRaceCount mismatch",
                errors,
        );

        assert(
                output.summary?.raceCount ===
                        expected.raceCount,
                "summary.raceCount mismatch",
                errors,
        );

        assert(
                output.summary?.venueCount ===
                        expected.venueCount,
                "summary.venueCount mismatch",
                errors,
        );

        assert(
                output.summary
                        ?.resultAvailableRaceCount ===
                        expected.resultAvailableRaceCount,
                "summary.resultAvailableRaceCount mismatch",
                errors,
        );

        assert(
                output.summary
                        ?.payoutAvailableRaceCount ===
                        expected.payoutAvailableRaceCount,
                "summary.payoutAvailableRaceCount mismatch",
                errors,
        );

        assert(
                output.summary
                        ?.trifectaAvailableRaceCount ===
                        expected.trifectaAvailableRaceCount,
                "summary.trifectaAvailableRaceCount mismatch",
                errors,
        );

        assert(
                output.summary
                        ?.trifectaOver10000RaceCount ===
                        expected.trifectaOver10000RaceCount,
                "summary.trifectaOver10000RaceCount mismatch",
                errors,
        );

        assert(
                sameJson(
                        output.readiness,
                        expectedReadiness,
                ),
                "readiness mismatch",
                errors,
        );

        assert(
                Array.isArray(output.venues),
                "venues must be an array",
                errors,
        );

        assert(
                output.venues?.length ===
                        expected.venueCount,
                "venues.length mismatch",
                errors,
        );

        assert(
                sameJson(
                        output.venues,
                        expected.venues,
                ),
                "venues must exactly match source-backed history aggregation",
                errors,
        );

        assert(
                sameJson(
                        output.sourceFiles,
                        expectedSourceFiles,
                ),
                "sourceFiles must contain only date index and history files",
                errors,
        );

        assert(
                Array.isArray(output.warnings),
                "warnings must be an array",
                errors,
        );

        if (
                expected.payoutAvailableRaceCount === 0
        ) {
                assert(
                        output.warnings.some(
                                (warning) =>
                                        typeof warning ===
                                                "string" &&
                                        warning.includes(
                                                "No source-backed trifecta payout values",
                                        ),
                        ),
                        "missing payout warning is required",
                        errors,
                );
        }

        assert(
                manifest.schemaVersion === 1,
                "manifest schemaVersion must be 1",
                errors,
        );

        assert(
                manifest.kind ===
                        "boatrace-ex-derived-manifest",
                "manifest kind mismatch",
                errors,
        );

        const manifestEntries =
                Array.isArray(manifest.files)
                        ? manifest.files.filter(
                                (file) =>
                                        file?.path ===
                                        OUTPUT_PATH,
                        )
                        : [];

        assert(
                manifestEntries.length === 1,
                "manifest must contain exactly one Rough Index entry",
                errors,
        );

        const manifestEntry =
                manifestEntries[0];

        assert(
                manifestEntry?.kind ===
                        "boatrace-ex-rough-index-v1",
                "manifest Rough Index kind mismatch",
                errors,
        );

        assert(
                manifestEntry?.date ===
                        expected.dates.at(-1),
                "manifest Rough Index date mismatch",
                errors,
        );

        assert(
                manifestEntry?.recordCount ===
                        expected.raceCount,
                "manifest recordCount mismatch",
                errors,
        );

        assert(
                manifestEntry?.venueCount ===
                        expected.venueCount,
                "manifest venueCount mismatch",
                errors,
        );

        assert(
                manifestEntry
                        ?.payoutAvailableRaceCount ===
                        expected.payoutAvailableRaceCount,
                "manifest payoutAvailableRaceCount mismatch",
                errors,
        );

        assert(
                manifestEntry?.sourceStatus ===
                        "available",
                "manifest sourceStatus mismatch",
                errors,
        );

        assert(
                manifestEntry?.coverageStatus ===
                        "partial",
                "manifest coverageStatus mismatch",
                errors,
        );

        validateNoForbiddenFields(
                output,
                errors,
        );

        validateNoForbiddenFields(
                manifestEntry,
                errors,
        );

        if (errors.length > 0) {
                console.error(
                        errors
                                .map(
                                        (error) =>
                                                `- ${error}`,
                                )
                                .join("\n"),
                );

                process.exitCode = 1;
                return;
        }

        console.log(
                JSON.stringify(
                        {
                                ok: true,
                                path: OUTPUT_PATH,
                                dateCount:
                                        output.dateRange
                                                .dateCount,
                                raceCount:
                                        output.summary
                                                .raceCount,
                                venueCount:
                                        output.summary
                                                .venueCount,
                                resultAvailableRaceCount:
                                        output.summary
                                                .resultAvailableRaceCount,
                                payoutAvailableRaceCount:
                                        output.summary
                                                .payoutAvailableRaceCount,
                                readiness:
                                        output.readiness
                                                .status,
                        },
                        null,
                        2,
                ),
        );
}

try {
        main();
} catch (error) {
        console.error(
                error instanceof Error
                        ? error.message
                        : String(error),
        );

        process.exitCode = 1;
}
