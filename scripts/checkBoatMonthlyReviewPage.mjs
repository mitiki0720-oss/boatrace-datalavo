import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
const app = read("src/App.tsx");
const header = read("src/components/layout/SiteHeader.tsx");
const page = read("src/pages/BoatMonthlyReviewPage.tsx");
const loader = read("src/lib/boatMonthlyReview.ts");
const types = read("src/types/boatMonthlyReview.ts");
const dataPath = path.join(root, "public/data/monthly-review/boat/monthly-review-data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8").replace(/^\uFEFF/u, ""));

const months = [...new Set((data.monthlyOverview ?? []).map((item) => item.month))].sort();
const monthLastDay = (month) => {
	const [year, monthNo] = month.split("-").map(Number);
	return new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
};
const startMatch = /^(\d{4}-\d{2})-(\d{2})$/u.exec(data.period?.start ?? "");
const endMatch = /^(\d{4}-\d{2})-(\d{2})$/u.exec(data.period?.end ?? "");
const partialMonths = [
	...(startMatch && Number(startMatch[2]) !== 1 ? [startMatch[1]] : []),
	...(endMatch && Number(endMatch[2]) !== monthLastDay(endMatch[1]) ? [endMatch[1]] : []),
].filter((month, index, values) => months.includes(month) && values.indexOf(month) === index);
const quality = Object.fromEntries((data.dataQuality ?? []).map((item) => [item.item, item.count]));

const includesAll = (source, fragments) => fragments.every((fragment) => source.includes(fragment));
const checks = {
	monthlyRoutePreserved: app.includes('"#monthly-review-page": BoatMonthlyReviewPage'),
	headerMonthlyPreserved: header.includes('label: "Monthly"') && header.includes('#monthly-review-page'),
	dataExistsAndValid: fs.existsSync(dataPath) && months.length > 0 && Array.isArray(data.venueMonthly) && Array.isArray(data.nextKpi),
	githubPagesSafeLoader: loader.includes('withBasePath(path)') && loader.includes('BOAT_MONTHLY_REVIEW_DATA_PATH = "data/monthly-review/boat/monthly-review-data.json"') && loader.includes('cache: "no-store"'),
	runtimeValidation: loader.includes("validateBoatMonthlyReviewData") && loader.includes("requiredArrays") && loader.includes("monthlyOverview is empty or invalid"),
	dynamicMonths: page.includes("getBoatMonthlyAvailableMonths") && page.includes("availableMonths.map") && !/2026-(?:0[1-9]|1[0-2])/u.test(page),
	partialSupport: loader.includes("getBoatMonthlyPartialMonths") && page.includes("PARTIAL / 集計途中") && partialMonths.length > 0,
	topKpis: includesAll(page, ["対象月", "対象R数", "正式的中数", "正式的中率", "投資", "払戻", "収支", "回収率", "1号艇1着率"]),
	monthTrendSeparateRoi: page.includes("的中率 / STRUCTURE_MISS / READ_MISS") && page.includes('<p style={labelStyle}>ROI</p>'),
	venueSectionAndSort: page.includes("会場別成績") && includesAll(page, ['VenueSortKey', '"roi_pct"', '"hit_rate_pct"', '"profit_yen"', '"races"']) && page.includes("LOW SAMPLE"),
	payoutBandCaution: page.includes("配当帯別") && page.includes("この配当帯を事前に選べば利益が出るという意味ではありません"),
	ticketRoleSection: page.includes("10点役割分析") && page.includes("1点当たり的中率"),
	classifications: includesAll(page, ["TICKET_HIT", "STRUCTURE_MISS", "READ_MISS", "DATA_HOLD"]),
	classificationSources: includesAll(page, ["classification_source", "summary_v2", "recomputed_ticket", "auto_proxy", "auto_data_hold"]),
	autoProxyCaution: page.includes("AUTO / 参考分類") && page.includes("人手監査済みではありません") && quality.classification_auto_proxy > 0,
	lane1Analysis: page.includes("1号艇分析") && page.includes("平均1号艇頭点数"),
	windAndWater: page.includes("風・水面分析") && page.includes("windDirections") && page.includes("waveBands") && page.includes("主JSONに波高帯配列は未収録"),
	predictionTiming: page.includes("事前予想 vs 直前情報") && page.includes("因果関係として解釈しません"),
	stAndEntry: page.includes("展示ST / 本番ST / 進入") && includesAll(page, ["平均絶対ST差", "展示進入変化R", "本番進入変化R"]),
	motorAudit: page.includes("モーター分析") && page.includes("実勝ち艇を事後分類した監査"),
	dataQuality: page.includes("DATA QUALITY") && page.includes("ticket_parse_fail_races") && data.dataQuality.length > 0,
	nextMonthKpi: page.includes("NEXT MONTH KPI") && page.includes("次月改善ルール") && data.nextKpi.length > 0,
	gptMaterialPreview: page.includes("GPT MATERIAL PREVIEW") && page.includes("navigator.clipboard.writeText") && page.includes("classification source caution"),
	sourceContract: page.includes("Source / Data Contract") && page.includes("RAW REPORT") && page.includes("manifest?.files") && !/fetch\([^)]*\.csv/isu.test(page + loader),
	boatTicketContract: includesAll(page, ["3連単10点固定", "厚め2点", "本線3点", "中穴3点", "大穴2点", "2連単は使わない"]),
	noKeirinPointRules: !/(?:8|14|18)点/u.test(page + loader + types),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
	ok,
	dataPath: "public/data/monthly-review/boat/monthly-review-data.json",
	months,
	partialMonths,
	classificationSourceAvailability: {
		summary_v2: quality.summary_classified_races ?? null,
		recomputed_ticket: null,
		auto_proxy: quality.classification_auto_proxy ?? null,
		auto_data_hold: null,
	},
	checks,
}, null, 2));
if (!ok) process.exitCode = 1;
