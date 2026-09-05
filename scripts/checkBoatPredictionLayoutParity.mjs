import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const pageSource = read("src/pages/PredictionPage.tsx");
const materialPanelSource = read("src/components/boatrace/BoatGptBulkMaterialPanel.tsx");
const pastePanelSource = read("src/components/boatrace/BoatPredictionPastePanel.tsx");
const pageShellIndex = pageSource.lastIndexOf("<PageShell");
const renderStart = pageSource.lastIndexOf("return (", pageShellIndex);
const renderedPageSource = renderStart >= 0 ? pageSource.slice(renderStart) : "";

const titleIndex = renderedPageSource.indexOf("今日の{selectedRace?.raceNo ?? 1}R素材を整える");
const quickSelectIndex = renderedPageSource.indexOf("QUICK SELECT");
const workspaceIndex = renderedPageSource.indexOf('data-prediction-workspace="compact-two-column"');

const buildRanges = (raceNumbers) => {
	const unique = [...new Set(raceNumbers)].filter((raceNo) => Number.isInteger(raceNo) && raceNo > 0).sort((a, b) => a - b);
	return [
		unique.filter((raceNo) => raceNo <= 6),
		unique.filter((raceNo) => raceNo >= 7),
	].filter((range) => range.length > 0);
};

const rangeFixtures = {
	twelveRaces: buildRanges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
	sixRaces: buildRanges([1, 2, 3, 4, 5, 6]),
	sevenRaces: buildRanges([1, 2, 3, 4, 5, 6, 7]),
	sparseRaces: buildRanges([1, 3, 6, 8, 10]),
};

const checks = {
	renderedPageFound: renderStart >= 0,
	compactOrder: titleIndex >= 0 && quickSelectIndex > titleIndex && workspaceIndex > quickSelectIndex,
	venueRaceChooser: renderedPageSource.includes("<BoatPredictionVenueRaceChooser"),
	compactMaterialPanel: renderedPageSource.includes("<BoatGptBulkMaterialPanel")
		&& renderedPageSource.includes("singleRaceMaterialText={materialText}"),
	pastePanel: renderedPageSource.includes("<BoatPredictionPastePanel"),
	desktopTwoColumn: pageSource.includes("grid-template-columns: minmax(320px, 0.82fr) minmax(0, 1.18fr)"),
	mobileSingleColumn: pageSource.includes("@media (max-width: 900px)")
		&& pageSource.includes(".prediction-page-main-panels")
		&& pageSource.includes("grid-template-columns: 1fr"),
	dynamicRaceRanges: pageSource.includes("const actualRaceNumbers = selectedVenueRaces")
		&& pageSource.includes("const frontRaceNumbers = actualRaceNumbers.filter((raceNo) => raceNo <= 6)")
		&& pageSource.includes("const lateRaceNumbers = actualRaceNumbers.filter((raceNo) => raceNo >= 7)")
		&& pageSource.includes(".filter((preset) => preset.generatedRaceCount > 0)"),
	rangeFixtures: JSON.stringify(rangeFixtures.twelveRaces) === JSON.stringify([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]])
		&& JSON.stringify(rangeFixtures.sixRaces) === JSON.stringify([[1, 2, 3, 4, 5, 6]])
		&& JSON.stringify(rangeFixtures.sevenRaces) === JSON.stringify([[1, 2, 3, 4, 5, 6], [7]])
		&& JSON.stringify(rangeFixtures.sparseRaces) === JSON.stringify([[1, 3, 6], [8, 10]]),
	directRangeCopy: materialPanelSource.includes("void copyMaterial(preset.materialText")
		&& materialPanelSource.includes("選択中Rをコピー")
		&& materialPanelSource.includes("選択範囲TXT"),
	predictionJsonExport: materialPanelSource.includes("当日予想JSONを書き出す")
		&& renderedPageSource.includes("onExportJson={handleExportJohnsonPrediction}")
		&& renderedPageSource.includes("onCopyJson={handleCopyJohnsonJson}"),
	materialTextareaRemoved: !materialPanelSource.includes("<textarea"),
	pasteWorkflowPreserved: pastePanelSource.includes("<textarea")
		&& pastePanelSource.includes("保存")
		&& pastePanelSource.includes("クリア")
		&& pastePanelSource.includes("<BoatPredictionTicketPreview"),
	legacyRenderedPanelsRemoved: !renderedPageSource.includes("<BoatGptMaterialPanel")
		&& !renderedPageSource.includes("<BoatPracticeResultPanel")
		&& !renderedPageSource.includes("heroStats.map")
		&& !renderedPageSource.includes("HIT NOTIFICATIONS")
		&& !renderedPageSource.includes("的中通知ログ"),
};

const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({ ok, checks, rangeFixtures }, null, 2));

if (!ok) {
	process.exitCode = 1;
}
