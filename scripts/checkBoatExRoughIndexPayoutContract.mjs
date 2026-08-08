import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const ROUGH_INDEX_PATH = "public/data/boatrace-ex/derived/rough-index/latest.json";
const PAYOUT_AUDIT_DIRECTORY = "public/data/boatrace-ex/audit";
const TODAY_FLOW_PATH = "public/data/boatrace-ex/derived/today-flow/latest.json";
const MIN_DATE_COUNT = 7;
const MIN_PAYOUT_RACE_COUNT = 30;

function absolute(relativePath) {
        return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
        return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function parseYen(value) {
        if (typeof value === "number") {
                return Number.isSafeInteger(value) && value >= 0 ? value : null;
        }

        if (typeof value !== "string") return null;

        const normalized = value.normalize("NFKC").replace(/[,\s円¥￥]/g, "");
        if (!/^\d+$/u.test(normalized)) return null;

        const amount = Number(normalized);
        return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function trifectaPayout(record) {
        const payouts = Array.isArray(record?.officialResult?.payout)
                ? record.officialResult.payout
                : [];

        for (const payout of payouts) {
                const type = [payout?.betType, payout?.type, payout?.name]
                        .filter((value) => typeof value === "string")
                        .join(" ")
                        .normalize("NFKC")
                        .toLowerCase();

                if (!type.includes("3連単") && !type.includes("三連単") && !type.includes("trifecta")) {
                        continue;
                }

                for (const value of [
                        payout?.payoutYen,
                        payout?.amount,
                        payout?.payoutAmount,
                        payout?.payout,
                        payout?.yen,
                ]) {
                        const amount = parseYen(value);
                        if (amount !== null) return amount;
                }
        }

        return null;
}

function countPayouts(records) {
        return records.reduce(
                (count, record) => count + (trifectaPayout(record) === null ? 0 : 1),
                0,
        );
}

function hasResult(record) {
        const finishOrder = record?.officialResult?.finishOrder;
        return Array.isArray(finishOrder)
                && finishOrder.length >= 3
                && finishOrder.slice(0, 3).every((boatNumber) => {
                        const value = Number(boatNumber);
                        return Number.isInteger(value) && value >= 1 && value <= 6;
                });
}

function assert(condition, message, errors) {
        if (!condition) errors.push(message);
}

function main() {
        const errors = [];
        const index = readJson(DATE_INDEX_PATH);
        const roughIndex = readJson(ROUGH_INDEX_PATH);
        const todayFlow = readJson(TODAY_FLOW_PATH);
        const dates = [...new Set(index.availableDates ?? [])].sort();
        const auditPath = `${PAYOUT_AUDIT_DIRECTORY}/rough-index-payout-contract-${dates.at(-1)}.generated.json`;
        const audit = readJson(auditPath);
        let raceCount = 0;
        let resultAvailableRaceCount = 0;
        let payoutAvailableRaceCount = 0;

        for (const date of dates) {
                const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
                const history = readJson(historyPath);
                assert(history.date === date, `${historyPath}: date mismatch`, errors);
                assert(Array.isArray(history.records), `${historyPath}: records must be an array`, errors);

                for (const record of history.records ?? []) {
                        raceCount += 1;
                        if (hasResult(record)) {
                                resultAvailableRaceCount += 1;
                        }
                }

                payoutAvailableRaceCount += countPayouts(history.records ?? []);
        }

        const expectedReadiness = dates.length >= MIN_DATE_COUNT && payoutAvailableRaceCount >= MIN_PAYOUT_RACE_COUNT
                ? "ready"
                : "insufficient-history";
        assert(roughIndex.summary?.raceCount === raceCount, "rough index raceCount must match all history", errors);
        assert(roughIndex.summary?.resultAvailableRaceCount === resultAvailableRaceCount, "rough index resultAvailableRaceCount must match all history", errors);
        assert(roughIndex.summary?.payoutAvailableRaceCount === payoutAvailableRaceCount, "rough index payoutAvailableRaceCount must use the stored history payout contract", errors);
        assert(roughIndex.readiness?.status === expectedReadiness, "rough index readiness must follow source-backed payout availability", errors);
        assert(audit.kind === "boatrace-ex-rough-index-payout-contract-audit", "audit kind is invalid", errors);
        assert(audit.auditDate === dates.at(-1), "audit date must match the latest indexed history date", errors);
        assert(audit.contract?.recordPath === "officialResult.payout[]", "audit must identify the stored payout record path", errors);
        assert(JSON.stringify(audit.contract?.amountFields) === JSON.stringify(["payoutYen", "amount", "payoutAmount", "payout", "yen"]), "audit amount fields must match the payout contract", errors);
        assert(audit.summary?.payoutAvailableRaceCount === payoutAvailableRaceCount, "audit payoutAvailableRaceCount must match history", errors);
        assert(audit.summary?.readiness === expectedReadiness, "audit readiness must match rough index", errors);

        const todayHistory = readJson(`public/data/boatrace-ex/history/races/${todayFlow.targetDate}.json`);
        const todayPayoutAvailableRaceCount = countPayouts(todayHistory.records ?? []);
        assert(todayFlow.summary?.payoutAvailableRaceCount === todayPayoutAvailableRaceCount, "today flow payoutAvailableRaceCount must use the same payout contract", errors);

        if (errors.length > 0) throw new Error(errors.join("\n"));

        console.log(JSON.stringify({
                ok: true,
                auditPath,
                dateCount: dates.length,
                raceCount,
                resultAvailableRaceCount,
                payoutAvailableRaceCount,
                readiness: expectedReadiness,
                todayFlow: {
                        targetDate: todayFlow.targetDate,
                        payoutAvailableRaceCount: todayPayoutAvailableRaceCount,
                },
        }, null, 2));
}

try {
        main();
} catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
}
