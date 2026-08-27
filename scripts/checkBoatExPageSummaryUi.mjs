import fs from "node:fs";

const source = fs.readFileSync("src/pages/BoatExPage.tsx", "utf8");
const errors = [];
for (const required of ["EX分析済み日数", "日付一覧を表示", "<details>", "素材更新状況", "BOAT EX履歴データが古い可能性があります", "materialStatuses"]) {
	if (!source.includes(required)) errors.push(`missing UI contract: ${required}`);
}
if (source.includes("派生分析に利用できる日付: {availableDates}")) errors.push("availableDates are rendered as an always-visible card body");
if (errors.length) {
	console.error(errors.join("\n"));
	process.exit(1);
}
console.log(JSON.stringify({ ok: true, compactDateList: true, staleAlert: true, materialStatusTable: true }, null, 2));
