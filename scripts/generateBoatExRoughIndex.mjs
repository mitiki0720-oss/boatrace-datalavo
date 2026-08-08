import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const OUTPUT_PATH = "public/data/boatrace-ex/derived/rough-index/latest.json";
const PAYOUT_AUDIT_DIRECTORY = "public/data/boatrace-ex/audit";
const DERIVED_MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";

const MIN_DATE_COUNT = 7;
const MIN_PAYOUT_RACE_COUNT = 30;
const HIGH_TRIFECTA_PAYOUT_YEN = 10_000;

function parseArgs(argv) {
        const args = { dryRun: false };

        for (const arg of argv) {
                if (arg === "--dry-run") {
                        args.dryRun = true;
                        continue;
                }

                throw new Error(`Unknown argument: ${arg}`);
        }

        return args;
}

function absolute(relativePath) {
        return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
        return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function readJsonIfExists(relativePath) {
        const filePath = absolute(relativePath);

        if (!fs.existsSync(filePath)) {
                return null;
        }

        return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(relativePath, value, dryRun) {
        if (dryRun) {
                return;
        }

        const filePath = absolute(relativePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
        if (!item || typeof item !== "object" || Array.isArray(item)) {
                return "";
        }

        return [
                item.betType,
                item.type,
                item.name,
        ]
                .filter((value) => typeof value === "string")
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
        if (!item || typeof item !== "object" || Array.isArray(item)) {
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
        const payouts = Array.isArray(record?.officialResult?.payout)
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
        const finishOrder = record?.officialResult?.finishOrder;

        return (
                Array.isArray(finishOrder) &&
                finishOrder.length >= 3 &&
                finishOrder
                        .slice(0, 3)
                        .every((boatNumber) => {
                                const value = Number(boatNumber);
                                return Number.isInteger(value) && value >= 1 && value <= 6;
                        })
        );
}

function buildReadiness(dateCount, payoutAvailableRaceCount) {
        const reasons = [];

        if (dateCount < MIN_DATE_COUNT) {
                reasons.push(
                        `dateCount ${dateCount} is below minDateCount ${MIN_DATE_COUNT}`,
                );
        }

        if (payoutAvailableRaceCount < MIN_PAYOUT_RACE_COUNT) {
                reasons.push(
                        `payoutAvailableRaceCount ${payoutAvailableRaceCount} is below minPayoutRaceCount ${MIN_PAYOUT_RACE_COUNT}`,
                );
        }

        return {
                status: reasons.length > 0
                        ? "insufficient-history"
                        : "ready",
                reason: reasons.length > 0
                        ? reasons.join("; ")
                        : "history and payout samples meet the minimum thresholds",
                minDateCount: MIN_DATE_COUNT,
                minPayoutRaceCount: MIN_PAYOUT_RACE_COUNT,
        };
}

function collectRoughIndex(index) {
        const dates = [...new Set(index.availableDates ?? [])].sort();

        if (dates.length === 0) {
                throw new Error("date index availableDates must not be empty");
        }

        const venues = new Map();
        const sourceFiles = [DATE_INDEX_PATH];

        let raceCount = 0;
        let resultAvailableRaceCount = 0;
        let payoutAvailableRaceCount = 0;
        let trifectaAvailableRaceCount = 0;
        let trifectaOver10000RaceCount = 0;

        for (const date of dates) {
                const historyPath =
                        `public/data/boatrace-ex/history/races/${date}.json`;

                const history = readJson(historyPath);

                if (history.date !== date || !Array.isArray(history.records)) {
                        throw new Error(`history is invalid for ${date}`);
                }

                sourceFiles.push(historyPath);

                for (const record of history.records) {
                        if (
                                record?.date !== date ||
                                typeof record?.venueCode !== "string" ||
                                record.venueCode.length === 0 ||
                                typeof record?.venueName !== "string" ||
                                record.venueName.length === 0
                        ) {
                                throw new Error(
                                        `history record is missing source-backed date or venue for ${date}`,
                                );
                        }

                        const venueId = record.venueCode;

                        const venue = venues.get(venueId) ?? {
                                venueId,
                                venueName: record.venueName,
                                dates: new Set(),
                                raceCount: 0,
                                resultAvailableRaceCount: 0,
                                payoutAvailableRaceCount: 0,
                                trifectaAvailableRaceCount: 0,
                                trifectaOver10000RaceCount: 0,
                        };

                        if (venue.venueName !== record.venueName) {
                                throw new Error(
                                        `venue name is inconsistent for venueId ${venueId}`,
                                );
                        }

                        venue.dates.add(date);
                        venue.raceCount += 1;
                        raceCount += 1;

                        if (hasResult(record)) {
                                venue.resultAvailableRaceCount += 1;
                                resultAvailableRaceCount += 1;
                        }

                        const trifectaPayout = findTrifectaPayout(record);

                        if (trifectaPayout !== null) {
                                venue.payoutAvailableRaceCount += 1;
                                venue.trifectaAvailableRaceCount += 1;
                                payoutAvailableRaceCount += 1;
                                trifectaAvailableRaceCount += 1;

                                if (
                                        trifectaPayout >=
                                        HIGH_TRIFECTA_PAYOUT_YEN
                                ) {
                                        venue.trifectaOver10000RaceCount += 1;
                                        trifectaOver10000RaceCount += 1;
                                }
                        }

                        venues.set(venueId, venue);
                }
        }

        const readiness = buildReadiness(
                dates.length,
                payoutAvailableRaceCount,
        );

        const warnings = [];

        if (payoutAvailableRaceCount === 0) {
                warnings.push(
                        "No source-backed trifecta payout values are currently available. Rough scores and payout rates are not emitted.",
                );
        }

        if (resultAvailableRaceCount === 0) {
                warnings.push(
                        "No records currently contain a validated top-three finish order.",
                );
        }

        return {
                status: "available",
                readiness,
                dateRange: {
                        from: dates[0],
                        to: dates.at(-1),
                        dates,
                        dateCount: dates.length,
                },
                thresholds: {
                        highTrifectaPayoutYen: HIGH_TRIFECTA_PAYOUT_YEN,
                        minDateCount: MIN_DATE_COUNT,
                        minPayoutRaceCount: MIN_PAYOUT_RACE_COUNT,
                },
                summary: {
                        raceCount,
                        venueCount: venues.size,
                        resultAvailableRaceCount,
                        payoutAvailableRaceCount,
                        trifectaAvailableRaceCount,
                        trifectaOver10000RaceCount,
                },
                venues: [...venues.values()]
                        .map((venue) => ({
                                venueId: venue.venueId,
                                venueName: venue.venueName,
                                dateCount: venue.dates.size,
                                raceCount: venue.raceCount,
                                resultAvailableRaceCount:
                                        venue.resultAvailableRaceCount,
                                payoutAvailableRaceCount:
                                        venue.payoutAvailableRaceCount,
                                trifectaAvailableRaceCount:
                                        venue.trifectaAvailableRaceCount,
                                trifectaOver10000RaceCount:
                                        venue.trifectaOver10000RaceCount,
                                readiness: buildReadiness(
                                        venue.dates.size,
                                        venue.payoutAvailableRaceCount,
                                ),
                        }))
                        .sort((left, right) =>
                                left.venueId.localeCompare(
                                        right.venueId,
                                        "ja",
                                ),
                        ),
                sourceFiles,
                warnings,
        };
}

function mergeManifest(entry, generatedAt) {
        const existing = readJsonIfExists(DERIVED_MANIFEST_PATH);

        const files = Array.isArray(existing?.files)
                ? [...existing.files]
                : [];
        const existingIndex = files.findIndex(
                (file) => file?.path === entry.path,
        );

        if (existingIndex >= 0) {
                files[existingIndex] = entry;
        } else {
                files.push(entry);
        }

        return {
                schemaVersion: 1,
                kind: "boatrace-ex-derived-manifest",
                generatedAt,
                sourceFiles: Array.isArray(existing?.sourceFiles)
                        ? existing.sourceFiles
                        : [],
                files,
        };
}

function buildPayoutContractAudit(roughIndex, generatedAt) {
        return {
                schemaVersion: 1,
                kind: "boatrace-ex-rough-index-payout-contract-audit",
                auditDate: roughIndex.dateRange.to,
                generatedAt,
                mode: "source-backed",
                contract: {
                        recordPath: "officialResult.payout[]",
                        trifectaTypeFields: ["betType", "type", "name"],
                        trifectaTypeValues: ["3連単", "三連単", "trifecta"],
                        amountFields: ["payoutYen", "amount", "payoutAmount", "payout", "yen"],
                        amountFormat: "non-negative integer or yen-formatted string",
                        note: "Only payout values already present in BOATRACE EX history are counted. No payout value is inferred or generated.",
                },
                summary: {
                        dateCount: roughIndex.dateRange.dateCount,
                        raceCount: roughIndex.summary.raceCount,
                        resultAvailableRaceCount:
                                roughIndex.summary.resultAvailableRaceCount,
                        payoutAvailableRaceCount:
                                roughIndex.summary.payoutAvailableRaceCount,
                        trifectaAvailableRaceCount:
                                roughIndex.summary.trifectaAvailableRaceCount,
                        trifectaOver10000RaceCount:
                                roughIndex.summary.trifectaOver10000RaceCount,
                        readiness: roughIndex.readiness.status,
                },
                sourceFiles: roughIndex.sourceFiles,
                warnings: roughIndex.warnings,
        };
}

function payoutAuditPath(date) {
        return `${PAYOUT_AUDIT_DIRECTORY}/rough-index-payout-contract-${date}.generated.json`;
}

function main() {
        const args = parseArgs(process.argv.slice(2));
        const index = readJson(DATE_INDEX_PATH);
        const generatedAt = new Date().toISOString();
        const roughIndex = collectRoughIndex(index);

        const output = {
                schemaVersion: "boat-ex-rough-index-v1",
                generatedAt,
                ...roughIndex,
        };
        const auditPath = payoutAuditPath(output.dateRange.to);

        const manifest = mergeManifest(
                {
                        path: OUTPUT_PATH,
                        kind: "boatrace-ex-rough-index-v1",
                        date: output.dateRange.to,
                        recordCount: output.summary.raceCount,
                        venueCount: output.summary.venueCount,
                        payoutAvailableRaceCount:
                                output.summary.payoutAvailableRaceCount,
                        generatedAt,
                        sourceStatus: "available",
                        coverageStatus: "partial",
                },
                generatedAt,
        );
        const payoutAudit = buildPayoutContractAudit(roughIndex, generatedAt);

        writeJson(OUTPUT_PATH, output, args.dryRun);
        writeJson(auditPath, payoutAudit, args.dryRun);
        writeJson(DERIVED_MANIFEST_PATH, manifest, args.dryRun);

        console.log(
                JSON.stringify(
                        {
                                ok: true,
                                dryRun: args.dryRun,
                                path: OUTPUT_PATH,
                                auditPath,
                                dateCount: output.dateRange.dateCount,
                                raceCount: output.summary.raceCount,
                                venueCount: output.summary.venueCount,
                                resultAvailableRaceCount:
                                        output.summary
                                                .resultAvailableRaceCount,
                                payoutAvailableRaceCount:
                                        output.summary
                                                .payoutAvailableRaceCount,
                                readiness: output.readiness.status,
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
