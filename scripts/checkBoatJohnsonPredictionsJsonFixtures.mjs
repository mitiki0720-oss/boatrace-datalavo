import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkerPath = path.join(rootDir, "scripts", "checkBoatJohnsonPredictionsJson.mjs");
const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "boat-johnson-json-fixtures-"));
const date = "2026-07-24";

const createPayload = (predictionText) => ({
	generatedAt: "2026-07-24T00:00:00.000Z",
	updatedAt: "2026-07-24T00:00:00.000Z",
	records: [{ raceKey: "fixture", date, predictionText }],
	notifiedSlackResultKeys: [],
	notifiedSlackHitKeys: [],
});

const writeFixture = (name, payload) => {
	const fixturePath = path.join(fixtureDirectory, name);
	fs.writeFileSync(fixturePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	return fixturePath;
};

const runChecker = (fixturePath) => spawnSync(process.execPath, [checkerPath, fixturePath, "--expected-date", date], {
	encoding: "utf8",
});

try {
	const valid = runChecker(writeFixture("valid.json", createPayload("\u65e5\u4ed8: 2026-07-24\n\u4f1a\u5834: \u3073\u308f\u3053\u7af6\u8247\u5834\n1R \u51fa\u8d70\u8868\n\u8cb7\u3044\u76ee 1-2-3")));
	assert.equal(valid.status, 0, valid.stderr || valid.stdout);

	const mojibake = runChecker(writeFixture("mojibake.json", createPayload("\u95c3\u3066\u87bb\u72d7\u306f\u6fc2\u30fb\uf8f0\u30b4\u7e72\u0031R\u7e72\u7e67\u30b5\u30f3")));
	assert.notEqual(mojibake.status, 0, "mojibake fixture must be rejected");
	assert.match(mojibake.stderr, /possible mojibake character/u);

	console.log(JSON.stringify({ ok: true, valid: "passed", mojibake: "rejected" }, null, 2));
} finally {
	fs.rmSync(fixtureDirectory, { recursive: true, force: true });
}
