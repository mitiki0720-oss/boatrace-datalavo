import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const app = read("src/App.tsx");
const header = read("src/components/layout/SiteHeader.tsx");
const exPage = read("src/pages/BoatExPage.tsx");
const venueNotes = read("src/components/boatrace/ex/BoatExVenueFeatureNotes.tsx");
const predictionPage = read("src/pages/PredictionPage.tsx");
const predictionMaterial = read("src/lib/boatPredictionMaterial.ts");
const venueFeatures = read("src/lib/boatVenueFeatures.ts");
const monthly = read("src/pages/BoatMonthlyReviewPage.tsx");

const checks = {
	headerVenuesRemoved: !header.includes('label: "Venues"') && !header.includes('#venue-features-page'),
	headerMonthlyAdded: header.includes('label: "Monthly"') && header.includes('#monthly-review-page'),
	monthlyRoute: app.includes('"#monthly-review-page": BoatMonthlyReviewPage'),
	legacyVenueRedirect: app.includes('hash === "#venue-features-page"') && app.includes('return "#boat-ex-page"'),
	exVenueBiasPreserved: exPage.includes('case "venue-bias"') && exPage.includes("<VenueBiasSection venueBias={venueBias} />"),
	exVenueNotesIntegrated: exPage.includes("<BoatExVenueFeatureNotes />") && venueNotes.includes("loadBoatVenueFeatureIndex") && venueNotes.includes("loadBoatVenueFeatureNote"),
	manualNoteAndMarkdown: venueNotes.includes("BoatVenueFeatureMarkdown") && venueNotes.includes("Full Markdown") && venueNotes.includes("sourceType"),
	userInsightSeparated: venueNotes.includes("loadBoatVenueUserInsights") && venueNotes.includes("MY ANALYSIS / USER INSIGHT") && venueNotes.includes("BOAT_VENUE_FEATURE_INSIGHTS_STORAGE_KEY"),
	materialPreviewPreserved: venueNotes.includes("buildBoatVenueFeatureMaterial") && venueNotes.includes("Prediction material preview"),
	predictionVenueFeaturePreserved:
		predictionPage.includes("loadBoatVenueFeatureIndex") &&
		predictionPage.includes("loadBoatVenueFeatureNote") &&
		predictionMaterial.includes("buildBoatVenueFeatureFullMaterial") &&
		predictionMaterial.includes("buildBoatVenueUserInsightMaterial") &&
		venueFeatures.includes("export async function loadBoatVenueFeatureNote"),
	monthlySkeleton: ["外れ方分析", "10点役割分析", "会場別", "時間帯別", "EX照合", "次月改善ルール", "GPT MATERIAL PREVIEW", "RAW REPORT"].every((label) => monthly.includes(label)),
	boatTicketContract: ["3連単10点固定", "厚め2点", "本線3点", "中穴3点", "大穴2点", "2連単は使わない"].every((label) => monthly.includes(label)),
	noKeirinTicketRules: !/(?:8|14|18)点/u.test(monthly),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exitCode = 1;
