import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourcePath = "src/components/boatrace/BoatPredictionVenueRaceChooser.tsx";
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
	compilerOptions: {
		jsx: ts.JsxEmit.ReactJSX,
		module: ts.ModuleKind.CommonJS,
		target: ts.ScriptTarget.ES2020,
	},
}).outputText;
const module = { exports: {} };
const copyModule = { exports: {} };
new Function("exports", "module", ts.transpileModule(fs.readFileSync("src/lib/boatPredictionGptCopy.ts", "utf8"), {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(copyModule.exports, copyModule);
const styleValues = new Proxy({}, { get: () => "" });
new Function("exports", "module", "require", compiled)(module.exports, module, (id) => {
	if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
	if (id === "../../lib/boatPredictionGptCopy") return copyModule.exports;
	if (id === "../../lib/boatVenueDayLabel") return { resolveBoatVenueDayLabel: () => "" };
	if (id === "../../lib/theme") return { boatTheme: { colors: styleValues, shadow: styleValues } };
	throw new Error(`Unexpected dependency: ${id}`);
});

const { getRaceTimeLabel } = module.exports;
assert.equal(typeof getRaceTimeLabel, "function", "getRaceTimeLabel must be exported for regression checks");

const fixtures = [
	{ name: "normal deadline", race: { deadlineTime: "12:34", startTime: "12:40" }, expected: "12:34" },
	{ name: "blank deadline falls back to start", race: { deadlineTime: "", startTime: "09:15" }, expected: "09:15" },
	{ name: "whitespace deadline falls back to close", race: { deadlineTime: "   ", closeTime: "16:42" }, expected: "16:42" },
	{ name: "placeholder deadline falls back to start", race: { deadlineTime: "--:--", deadline: "--", startTime: "18:03" }, expected: "18:03" },
	{ name: "unavailable labels fall back to time", race: { deadlineTime: "未取得", closeTime: "確認中", time: "21:08" }, expected: "21:08" },
	{ name: "all fields unavailable", race: { deadlineTime: "", deadline: null, closeTime: "--", startTime: "未取得", time: undefined }, expected: "締切未取得" },
	{ name: "invalid time is not displayed", race: { deadlineTime: "25:99", startTime: "確認中" }, expected: "締切未取得" },
	{ name: "non HH:mm value falls back", race: { deadlineTime: "9:15", startTime: "10:02" }, expected: "10:02" },
	{ name: "missing race", race: undefined, expected: "締切未取得" },
];

for (const fixture of fixtures) {
	assert.equal(getRaceTimeLabel(fixture.race), fixture.expected, fixture.name);
}

assert.match(source, /\["deadlineTime", "deadline", "closeTime", "startTime", "time"\]/u);
assert.match(source, /return "締切未取得"/u);

console.log(JSON.stringify({
	ok: true,
	fixtureCount: fixtures.length,
	fixtures: fixtures.map(({ name, expected }) => ({ name, expected })),
}, null, 2));
