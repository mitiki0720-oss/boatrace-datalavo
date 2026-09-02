import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { PageShell } from "../components/layout/PageShell";
import {
	BOAT_MONTHLY_REVIEW_DATA_FILE,
	getBoatMonthlyAvailableMonths,
	getBoatMonthlyPartialMonths,
	getBoatMonthlyQualityCount,
	loadBoatMonthlyReviewData,
	loadBoatMonthlyReviewManifest,
} from "../lib/boatMonthlyReview";
import { boatTheme } from "../lib/theme";
import type {
	BoatMonthlyReviewData,
	BoatMonthlyReviewManifest,
	BoatMonthlyVenuePerformance,
} from "../types/boatMonthlyReview";

type LoadState = "loading" | "ready" | "empty" | "error";
type VenueSortKey = "roi_pct" | "hit_rate_pct" | "profit_yen" | "races";

const sectionStyle: CSSProperties = {
	display: "grid",
	gap: "16px",
	minWidth: 0,
	padding: "22px 0",
	borderTop: `1px solid ${boatTheme.colors.line}`,
};

const panelStyle: CSSProperties = {
	display: "grid",
	gap: "12px",
	minWidth: 0,
	padding: "16px",
	border: `1px solid ${boatTheme.colors.line}`,
	borderRadius: "8px",
	background: "rgba(255, 255, 255, 0.94)",
};

const metricGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 154px), 1fr))",
	gap: "10px",
};

const labelStyle: CSSProperties = {
	margin: 0,
	fontSize: "0.72rem",
	fontWeight: 800,
	color: boatTheme.colors.aquaDeep,
};

const valueStyle: CSSProperties = {
	margin: 0,
	fontSize: "1.28rem",
	fontWeight: 850,
	color: boatTheme.colors.navy,
	overflowWrap: "anywhere",
};

const textStyle: CSSProperties = {
	margin: 0,
	lineHeight: 1.7,
	color: boatTheme.colors.muted,
};

const tableWrapStyle: CSSProperties = {
	width: "100%",
	maxWidth: "100%",
	overflowX: "auto",
	WebkitOverflowScrolling: "touch",
};

const tableStyle: CSSProperties = {
	width: "100%",
	borderCollapse: "collapse",
	fontSize: "0.78rem",
	background: "rgba(255, 255, 255, 0.76)",
};

const thStyle: CSSProperties = {
	padding: "9px 10px",
	textAlign: "left",
	whiteSpace: "nowrap",
	color: boatTheme.colors.navy,
	background: boatTheme.colors.sky,
	borderBottom: `1px solid ${boatTheme.colors.line}`,
};

const tdStyle: CSSProperties = {
	padding: "9px 10px",
	whiteSpace: "nowrap",
	color: boatTheme.colors.ink,
	borderBottom: `1px solid ${boatTheme.colors.line}`,
};

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const formatInteger = (value: number | null | undefined) => isNumber(value) ? value.toLocaleString("ja-JP") : "—";
const formatPercent = (value: number | null | undefined) => isNumber(value) ? `${value.toFixed(2)}%` : "—";
const formatYen = (value: number | null | undefined) => isNumber(value) ? `${value.toLocaleString("ja-JP")}円` : "—";
const formatProfit = (value: number | null | undefined) => isNumber(value) ? `${value > 0 ? "+" : ""}${value.toLocaleString("ja-JP")}円` : "—";
const formatValue = (value: number | string | null | undefined, suffix = "") => value === "" || value === null || value === undefined ? "—" : `${value}${suffix}`;
const clampPercent = (value: number | null | undefined) => isNumber(value) ? Math.max(0, Math.min(100, value)) : 0;

function SectionHeader({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description?: string; aside?: ReactNode }) {
	return (
		<header className="boat-monthly-section-header">
			<div>
				<p style={labelStyle}>{eyebrow}</p>
				<h3 style={{ margin: "4px 0 0", color: boatTheme.colors.navy, fontSize: "1.12rem" }}>{title}</h3>
				{description ? <p style={{ ...textStyle, marginTop: "6px", fontSize: "0.82rem" }}>{description}</p> : null}
			</div>
			{aside}
		</header>
	);
}
function MetricCard({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "positive" | "negative" }) {
	return (
		<article style={panelStyle}>
			<p style={labelStyle}>{label}</p>
			<p style={{ ...valueStyle, color: tone === "positive" ? "#087f5b" : tone === "negative" ? "#b42318" : boatTheme.colors.navy }}>{value}</p>
			{note ? <p style={{ ...textStyle, fontSize: "0.72rem" }}>{note}</p> : null}
		</article>
	);
}

function PartialBadge() {
	return <span className="boat-monthly-badge boat-monthly-badge-warning">PARTIAL / 集計途中</span>;
}

function SourceScopeBadge() {
	return <span className="boat-monthly-badge">全期間集計</span>;
}

function EmptyRow({ colSpan, label = "主JSONに対象データは収録されていません。" }: { colSpan: number; label?: string }) {
	return <tr><td style={{ ...tdStyle, whiteSpace: "normal", color: boatTheme.colors.muted }} colSpan={colSpan}>{label}</td></tr>;
}

function PerformanceCells({ item }: { item: { races: number | null; hits: number | null; hit_rate_pct: number | null; investment_yen: number | null; return_yen: number | null; profit_yen?: number | null; roi_pct: number | null } }) {
	return (
		<>
			<td style={tdStyle}>{formatInteger(item.races)}</td>
			<td style={tdStyle}>{formatInteger(item.hits)}</td>
			<td style={tdStyle}>{formatPercent(item.hit_rate_pct)}</td>
			<td style={tdStyle}>{formatYen(item.investment_yen)}</td>
			<td style={tdStyle}>{formatYen(item.return_yen)}</td>
			{Object.prototype.hasOwnProperty.call(item, "profit_yen") ? <td style={tdStyle}>{formatProfit(item.profit_yen)}</td> : null}
			<td style={tdStyle}>{formatPercent(item.roi_pct)}</td>
		</>
	);
}

export function BoatMonthlyReviewPage() {
	const [data, setData] = useState<BoatMonthlyReviewData | null>(null);
	const [manifest, setManifest] = useState<BoatMonthlyReviewManifest | null>(null);
	const [loadState, setLoadState] = useState<LoadState>("loading");
	const [errorMessage, setErrorMessage] = useState("");
	const [selectedMonth, setSelectedMonth] = useState("all");
	const [venueSort, setVenueSort] = useState<VenueSortKey>("races");
	const [venueSortDescending, setVenueSortDescending] = useState(true);
	const [copyStatus, setCopyStatus] = useState("");

	useEffect(() => {
		let cancelled = false;
		setLoadState("loading");
		Promise.all([loadBoatMonthlyReviewData(), loadBoatMonthlyReviewManifest()])
			.then(([loadedData, loadedManifest]) => {
				if (cancelled) return;
				setData(loadedData);
				setManifest(loadedManifest);
				setLoadState(loadedData.monthlyOverview.length ? "ready" : "empty");
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				setErrorMessage(error instanceof Error ? error.message : "Monthly Review data could not be loaded.");
				setLoadState("error");
			});
		return () => { cancelled = true; };
	}, []);

	const availableMonths = useMemo(() => data ? getBoatMonthlyAvailableMonths(data) : [], [data]);
	const partialMonths = useMemo(() => data ? getBoatMonthlyPartialMonths(data) : [], [data]);
	const selectedOverview = useMemo(() => data?.monthlyOverview.find((item) => item.month === selectedMonth) ?? null, [data, selectedMonth]);
	const isPartial = selectedMonth !== "all" && partialMonths.includes(selectedMonth);
	const filterMonth = <T extends { month: string }>(items: T[]) => selectedMonth === "all" ? items : items.filter((item) => item.month === selectedMonth);

	const venueRows = useMemo(() => {
		if (!data) return [];
		const sourceRows = selectedMonth === "all" ? data.venueAllPeriod : data.venueMonthly.filter((item) => item.month === selectedMonth);
		return [...sourceRows].sort((left, right) => {
			const leftValue = left[venueSort];
			const rightValue = right[venueSort];
			if (!isNumber(leftValue) && !isNumber(rightValue)) return left.venue.localeCompare(right.venue, "ja");
			if (!isNumber(leftValue)) return 1;
			if (!isNumber(rightValue)) return -1;
			return (leftValue - rightValue) * (venueSortDescending ? -1 : 1) || left.venue.localeCompare(right.venue, "ja");
		});
	}, [data, selectedMonth, venueSort, venueSortDescending]);

	const setVenueSortKey = (key: VenueSortKey) => {
		if (key === venueSort) setVenueSortDescending((current) => !current);
		else {
			setVenueSort(key);
			setVenueSortDescending(true);
		}
	};

	const qualityStatus = useMemo(() => {
		if (!data) return "未取得";
		const warningKeys = ["ticket_parse_fail_races", "result_parse_fail_races", "summary_class_collision", "classification_auto_proxy"];
		return warningKeys.some((key) => (getBoatMonthlyQualityCount(data, key) ?? 0) > 0) ? "warning" : "good";
	}, [data]);

	const overallRaceCount = data ? getBoatMonthlyQualityCount(data, "valid_recomputed_races") : null;
	const classificationSources = data ? [
		{ name: "summary_v2", count: getBoatMonthlyQualityCount(data, "summary_classified_races"), note: "既存会場別summary v2由来" },
		{ name: "recomputed_ticket", count: null, note: "保存買い目×確定結果の正式再照合。source別件数は主JSON未収録" },
		{ name: "auto_proxy", count: getBoatMonthlyQualityCount(data, "classification_auto_proxy"), note: "AUTO / 参考分類。人手監査済みではありません" },
		{ name: "auto_data_hold", count: null, note: "source不足等の自動hold。source別件数は主JSON未収録" },
	] : [];

	const gptMaterialPreview = useMemo(() => {
		if (!data) return "Monthly Review data is not loaded.";
		const overview = selectedOverview;
		const lines = [
			"【KURARI BOAT MONTHLY REVIEW / GPT MATERIAL PREVIEW】",
			`対象月: ${selectedMonth === "all" ? `全期間 (${data.period.start} ～ ${data.period.end})` : selectedMonth}`,
			`PARTIAL: ${isPartial ? "集計途中" : "なし"}`,
			`正式的中率: ${formatPercent(overview?.hit_rate_pct)}`,
			`回収率: ${formatPercent(overview?.roi_pct)}`,
			`STRUCTURE_MISS: ${formatInteger(overview?.STRUCTURE_MISS)}R / ${formatPercent(overview?.structure_miss_rate_pct)}`,
			`READ_MISS: ${formatInteger(overview?.READ_MISS)}R / ${formatPercent(overview?.read_miss_rate_pct)}`,
			"会場課題: 主JSONに文章形式の改善ルールは未収録",
			`1号艇課題: 1号艇1着率 ${formatPercent(overview?.actual_1boat_win_rate_pct)}`,
			"風/水面課題: 主JSONの風速帯集計を参照。文章形式の改善ルールは未収録",
			"次月KPI:",
			...data.nextKpi.map((item) => `- ${item.KPI}: baseline ${item.baseline} / target ${item.next_target} / ${item.meaning}`),
			"classification source caution:",
			"- auto_proxy / auto_data_hold はAUTO参考分類。人手監査済み分類として扱わない。",
		];
		return lines.join("\n");
	}, [data, isPartial, selectedMonth, selectedOverview]);

	const copyGptMaterial = async () => {
		try {
			await navigator.clipboard.writeText(gptMaterialPreview);
			setCopyStatus("コピーしました");
		} catch {
			setCopyStatus("コピーできませんでした");
		}
	};

	if (loadState !== "ready" || !data) {
		return (
			<PageShell eyebrow="MONTHLY RETROSPECTIVE" title="月次振り返り・予想改善ラボ" description="保存済みの集計結果を読み込み、次月の確認観点を整理します。">
				<section style={sectionStyle} aria-live="polite">
					<p style={valueStyle}>{loadState === "loading" ? "月次データを読み込み中" : loadState === "empty" ? "月次データなし" : "月次データの読み込みに失敗"}</p>
					<p style={textStyle}>{loadState === "error" ? errorMessage : BOAT_MONTHLY_REVIEW_DATA_FILE}</p>
				</section>
			</PageShell>
		);
	}

	const missRows = filterMonth(data.missAnalysis);
	const oneBoatRows = filterMonth(data.oneBoatAnalysis);
	const windRows = filterMonth(data.windBands);
	const predictionModeRows = filterMonth(data.predictionModes);
	const displayRows = filterMonth(data.displayAudit);
	const metricValues = [
		["対象月", selectedMonth === "all" ? "全期間" : selectedMonth, `${data.period.start} ～ ${data.period.end}`],
		["対象R数", formatInteger(selectedOverview?.races ?? overallRaceCount), selectedMonth === "all" ? "valid_recomputed_races" : `${formatInteger(selectedOverview?.days)}日 / ${formatInteger(selectedOverview?.venues)}会場`],
		["正式的中数", formatInteger(selectedOverview?.hits), "TICKET_HIT 再照合済み"],
		["正式的中率", formatPercent(selectedOverview?.hit_rate_pct), "全期間率は主JSON未収録"],
		["投資", formatYen(selectedOverview?.investment_yen), "実保存点数×100円"],
		["払戻", formatYen(selectedOverview?.return_yen), "確定結果集計"],
		["収支", formatProfit(selectedOverview?.profit_yen), "投資と払戻の差"],
		["回収率", formatPercent(selectedOverview?.roi_pct), "月別source値"],
		["1号艇1着率", formatPercent(selectedOverview?.actual_1boat_win_rate_pct), "実結果ベース"],
	] as const;

	return (
		<PageShell eyebrow="MONTHLY RETROSPECTIVE" title="月次振り返り・予想改善ラボ" description="再照合済みMonthly Reviewデータを、会場・買い目役割・外れ方・水面条件ごとに監査します。集計値はsource JSONをそのまま表示します。" contentMaxWidth="1240px">
			<style>{`
				.boat-monthly-controls,.boat-monthly-section-header{display:flex;gap:12px;align-items:center;justify-content:space-between;min-width:0}
				.boat-monthly-badge{display:inline-flex;align-items:center;min-height:26px;padding:4px 8px;border:1px solid rgba(24,115,152,.24);border-radius:999px;background:#effaff;color:#126181;font-size:.68rem;font-weight:850;white-space:nowrap}
				.boat-monthly-badge-warning{border-color:#f4c27b;background:#fff7e8;color:#995c00}
				.boat-monthly-sort{border:0;background:transparent;color:inherit;font:inherit;font-weight:850;cursor:pointer;padding:0}
				.boat-monthly-chart-row{display:grid;grid-template-columns:72px minmax(0,1fr);gap:10px;align-items:center}
				.boat-monthly-bars{display:grid;gap:5px;min-width:0}
				.boat-monthly-bar{height:10px;border-radius:3px;min-width:2px}
				.boat-monthly-preview{margin:0;max-height:460px;overflow:auto;white-space:pre-wrap;word-break:break-word;padding:16px;border:1px solid ${boatTheme.colors.line};border-radius:8px;background:#f8fcfe;color:${boatTheme.colors.ink};font-size:.76rem;line-height:1.75}
				@media(max-width:640px){.boat-monthly-controls,.boat-monthly-section-header{align-items:stretch;flex-direction:column}.boat-monthly-controls select,.boat-monthly-controls button{width:100%}.boat-monthly-chart-row{grid-template-columns:58px minmax(0,1fr)}}
			`}</style>

			<section style={{ ...sectionStyle, paddingTop: 0 }} aria-label="月次データ操作">
				<div className="boat-monthly-controls">
					<div><p style={labelStyle}>REPORT STATUS</p><p style={{ ...valueStyle, fontSize: "1rem" }}>集計済みMonthlyデータ 接続済み</p></div>
					<label style={{ display: "grid", gap: "5px", minWidth: "min(100%, 220px)", fontWeight: 800, color: boatTheme.colors.navy }}>
						対象月
						<select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: `1px solid ${boatTheme.colors.line}`, background: "white", color: boatTheme.colors.ink, fontWeight: 800 }}>
							<option value="all">全期間</option>
							{availableMonths.map((month) => <option key={month} value={month}>{month}{partialMonths.includes(month) ? " / PARTIAL" : ""}</option>)}
						</select>
					</label>
				</div>
				<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><span className="boat-monthly-badge">DATA QUALITY: {qualityStatus}</span>{isPartial ? <PartialBadge /> : null}<span className="boat-monthly-badge">generated {data.generated_at}</span></div>
			</section>

			<section style={metricGridStyle} aria-label="月次KPI">
				{metricValues.map(([label, value, note]) => <MetricCard key={label} label={label} value={value} note={note} tone={label === "収支" && selectedOverview?.profit_yen !== null && selectedOverview?.profit_yen !== undefined ? selectedOverview.profit_yen >= 0 ? "positive" : "negative" : undefined} />)}
			</section>

			<section style={sectionStyle} aria-label="BOAT買い目契約"><SectionHeader eyebrow="BOAT TICKET CONTRACT" title="3連単10点固定" description="厚め2点 / 本線3点 / 中穴3点 / 大穴2点。2連単は使わない。" /></section>

			<section style={sectionStyle} aria-label="月推移">
				<SectionHeader eyebrow="MONTH TREND" title="月推移" description="的中・外れ分類とROIは別スケールで表示します。" />
				<div style={panelStyle}><p style={labelStyle}>的中率 / STRUCTURE_MISS / READ_MISS</p>{data.monthlyOverview.map((item) => <div className="boat-monthly-chart-row" key={item.month} style={{ opacity: selectedMonth === "all" || selectedMonth === item.month ? 1 : 0.48 }}><strong>{item.month.slice(5)}月</strong><div className="boat-monthly-bars"><div className="boat-monthly-bar" title={`的中率 ${formatPercent(item.hit_rate_pct)}`} style={{ width: `${clampPercent(item.hit_rate_pct)}%`, background: boatTheme.colors.aquaDeep }} /><div className="boat-monthly-bar" title={`STRUCTURE_MISS ${formatPercent(item.structure_miss_rate_pct)}`} style={{ width: `${clampPercent(item.structure_miss_rate_pct)}%`, background: "#d99133" }} /><div className="boat-monthly-bar" title={`READ_MISS ${formatPercent(item.read_miss_rate_pct)}`} style={{ width: `${clampPercent(item.read_miss_rate_pct)}%`, background: "#b95f76" }} /></div></div>)}<p style={{ ...textStyle, fontSize: "0.72rem" }}>青: 正式的中率 / 黄: STRUCTURE_MISS / 赤: READ_MISS</p></div>
				<div style={panelStyle}><p style={labelStyle}>ROI</p>{data.monthlyOverview.map((item) => <div className="boat-monthly-chart-row" key={`roi-${item.month}`}><strong>{item.month.slice(5)}月</strong><div className="boat-monthly-bars"><div className="boat-monthly-bar" title={`ROI ${formatPercent(item.roi_pct)}`} style={{ width: `${clampPercent(item.roi_pct)}%`, background: boatTheme.colors.mint }} /></div></div>)}</div>
			</section>

			<section style={sectionStyle} aria-label="会場別成績">
				<SectionHeader eyebrow="VENUE PERFORMANCE" title="1. 会場別成績" description="母数Rを表示し、選択した指標で並べ替えます。LOW SAMPLEも除外しません。" />
				<div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "980px" }}><thead><tr><th style={thStyle}>会場</th>{(["races", "hits", "hit_rate_pct", "investment_yen", "return_yen", "profit_yen", "roi_pct"] as const).map((key) => <th style={thStyle} key={key}>{(["races", "hit_rate_pct", "profit_yen", "roi_pct"] as string[]).includes(key) ? <button className="boat-monthly-sort" type="button" onClick={() => setVenueSortKey(key as VenueSortKey)}>{key === "races" ? "R数" : key === "hit_rate_pct" ? "的中率" : key === "profit_yen" ? "収支" : "ROI"}{venueSort === key ? venueSortDescending ? " ↓" : " ↑" : ""}</button> : key === "hits" ? "的中数" : key === "investment_yen" ? "投資" : "払戻"}</th>)}<th style={thStyle}>STRUCTURE_MISS</th><th style={thStyle}>READ_MISS</th><th style={thStyle}>DATA_HOLD</th></tr></thead><tbody>{venueRows.length ? venueRows.map((item: BoatMonthlyVenuePerformance) => <tr key={`${item.month ?? "all"}-${item.venue}`}><td style={tdStyle}><strong>{item.venue}</strong>{(item.races ?? 0) < 12 ? <span className="boat-monthly-badge boat-monthly-badge-warning" style={{ marginLeft: "6px" }}>LOW SAMPLE</span> : null}</td><PerformanceCells item={item} /><td style={tdStyle}>{formatInteger(item.STRUCTURE_MISS)}</td><td style={tdStyle}>{formatInteger(item.READ_MISS)}</td><td style={tdStyle}>{formatInteger(item.DATA_HOLD)}</td></tr>) : <EmptyRow colSpan={11} />}</tbody></table></div>
			</section>

			<section style={sectionStyle} aria-label="配当帯別">
				<SectionHeader eyebrow="PAYOUT BANDS" title="2. 配当帯別" description="実際の確定結果配当を事後的に帯分類した集計です。この配当帯を事前に選べば利益が出るという意味ではありません。" aside={<SourceScopeBadge />} />
				<div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "860px" }}><thead><tr><th style={thStyle}>配当帯</th><th style={thStyle}>R</th><th style={thStyle}>的中</th><th style={thStyle}>的中率</th><th style={thStyle}>投資</th><th style={thStyle}>払戻</th><th style={thStyle}>収支</th><th style={thStyle}>ROI</th><th style={thStyle}>1号艇1着率</th></tr></thead><tbody>{data.payoutBands.map((item) => <tr key={item.payout_band}><td style={tdStyle}>{item.payout_band}</td><PerformanceCells item={item} /><td style={tdStyle}>{formatPercent(item.actual_1boat_win_rate_pct)}</td></tr>)}</tbody></table></div>
			</section>

			<section style={sectionStyle} aria-label="買い目役割別">
				<SectionHeader eyebrow="TICKET ROLE" title="3. 10点役割分析 / 買い目役割別" description="保存済みの購入点数だけを集計した全期間source値です。" aside={<SourceScopeBadge />} />
				<div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "700px" }}><thead><tr><th style={thStyle}>役割</th><th style={thStyle}>購入点数</th><th style={thStyle}>的中数</th><th style={thStyle}>1点当たり的中率</th><th style={thStyle}>投資</th><th style={thStyle}>払戻</th><th style={thStyle}>ROI</th></tr></thead><tbody>{data.ticketRoles.map((item) => <tr key={item.role}><td style={tdStyle}><strong>{item.role}</strong></td><td style={tdStyle}>{formatInteger(item.tickets)}</td><td style={tdStyle}>{formatInteger(item.hits)}</td><td style={tdStyle}>{formatPercent(item.per_ticket_hit_rate_pct)}</td><td style={tdStyle}>{formatYen(item.investment_yen)}</td><td style={tdStyle}>{formatYen(item.return_yen)}</td><td style={tdStyle}>{formatPercent(item.roi_pct)}</td></tr>)}</tbody></table></div>
			</section>

			<section style={sectionStyle} aria-label="外れ方分析">
				<SectionHeader eyebrow="MISS CLASSIFICATION" title="4. 外れ方分析" description="TICKET_HITは保存買い目と実3連単の再照合結果です。" />
				<div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "520px" }}><thead><tr><th style={thStyle}>月</th><th style={thStyle}>分類</th><th style={thStyle}>件数</th><th style={thStyle}>率</th></tr></thead><tbody>{missRows.map((item) => <tr key={`${item.month}-${item.classification}`}><td style={tdStyle}>{item.month}</td><td style={tdStyle}><strong>{item.classification}</strong></td><td style={tdStyle}>{formatInteger(item.races)}</td><td style={tdStyle}>{formatPercent(item.rate_pct)}</td></tr>)}</tbody></table></div>
				<div className="boat-monthly-section-header" style={{ alignItems: "stretch" }}><div style={{ ...panelStyle, flex: 1 }}><strong>STRUCTURE_MISS</strong><p style={textStyle}>展開読みはある程度合っていたが、10点構成で取り逃したケース。</p></div><div style={{ ...panelStyle, flex: 1 }}><strong>READ_MISS</strong><p style={textStyle}>展開読み自体に修正が必要なケース。</p></div><div style={{ ...panelStyle, flex: 1 }}><strong>DATA_HOLD</strong><p style={textStyle}>データ不足等により分析を保留したケース。</p></div></div>
				<details style={panelStyle}><summary style={{ cursor: "pointer", fontWeight: 850, color: boatTheme.colors.navy }}>classification_source 内訳と注意</summary><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "660px" }}><thead><tr><th style={thStyle}>source</th><th style={thStyle}>件数</th><th style={thStyle}>扱い</th></tr></thead><tbody>{classificationSources.map((item) => <tr key={item.name}><td style={tdStyle}><strong>{item.name}</strong>{item.name.startsWith("auto_") ? <span className="boat-monthly-badge boat-monthly-badge-warning" style={{ marginLeft: "6px" }}>AUTO / 参考分類</span> : null}</td><td style={tdStyle}>{formatInteger(item.count)}</td><td style={{ ...tdStyle, whiteSpace: "normal" }}>{item.note}</td></tr>)}</tbody></table></div></details>
			</section>

			<section style={sectionStyle} aria-label="1号艇分析"><SectionHeader eyebrow="LANE 1" title="5. 1号艇分析" description="実結果の1号艇1着 / 非1着で監査します。" /><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "860px" }}><thead><tr><th style={thStyle}>月</th><th style={thStyle}>結果</th><th style={thStyle}>R</th><th style={thStyle}>的中</th><th style={thStyle}>的中率</th><th style={thStyle}>投資</th><th style={thStyle}>払戻</th><th style={thStyle}>収支</th><th style={thStyle}>ROI</th><th style={thStyle}>平均1号艇頭点数</th></tr></thead><tbody>{oneBoatRows.length ? oneBoatRows.map((item) => <tr key={`${item.month}-${item.result_type}`}><td style={tdStyle}>{item.month}</td><td style={tdStyle}>{item.result_type}</td><PerformanceCells item={item} /><td style={tdStyle}>{formatValue(item.avg_1boat_head_tickets)}</td></tr>) : <EmptyRow colSpan={10} />}</tbody></table></div></section>

			<section style={sectionStyle} aria-label="風水面分析"><SectionHeader eyebrow="WEATHER / WATER" title="6. 風・水面分析 / EX照合" description="風向の向かい風・追い風変換は行わず、主JSONにあるsource値だけを表示します。" /><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "780px" }}><thead><tr><th style={thStyle}>月</th><th style={thStyle}>風速帯</th><th style={thStyle}>R</th><th style={thStyle}>的中率</th><th style={thStyle}>ROI</th><th style={thStyle}>1号艇1着率</th></tr></thead><tbody>{windRows.length ? windRows.map((item) => <tr key={`${item.month}-${item.wind_band}`}><td style={tdStyle}>{item.month}</td><td style={tdStyle}>{item.wind_band}</td><td style={tdStyle}>{formatInteger(item.races)}</td><td style={tdStyle}>{formatPercent(item.hit_rate_pct)}</td><td style={tdStyle}>{formatPercent(item.roi_pct)}</td><td style={tdStyle}>{formatPercent(item.actual_1boat_win_rate_pct)}</td></tr>) : <EmptyRow colSpan={6} />}</tbody></table></div><div style={metricGridStyle}><MetricCard label="風向" value={data.windDirections?.length ? `${data.windDirections.length}区分` : "未取得"} note="CSVは配置済みですが、主JSONに風向配列は未収録" /><MetricCard label="波高" value={data.waveBands?.length ? `${data.waveBands.length}区分` : "未取得"} note="主JSONに波高帯配列は未収録" /></div></section>

			<section style={sectionStyle} aria-label="事前予想と直前情報"><SectionHeader eyebrow="PREDICTION TIMING" title="7. 事前予想 vs 直前情報 / 時間帯別" description="旧データでは条件定義が完全一致していないため、因果関係として解釈しません。" /><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "760px" }}><thead><tr><th style={thStyle}>月</th><th style={thStyle}>予想mode</th><th style={thStyle}>R</th><th style={thStyle}>的中率</th><th style={thStyle}>ROI</th><th style={thStyle}>1号艇1着率</th></tr></thead><tbody>{predictionModeRows.length ? predictionModeRows.map((item) => <tr key={`${item.month}-${item.prediction_mode}`}><td style={tdStyle}>{item.month}</td><td style={tdStyle}>{item.prediction_mode}</td><td style={tdStyle}>{formatInteger(item.races)}</td><td style={tdStyle}>{formatPercent(item.hit_rate_pct)}</td><td style={tdStyle}>{formatPercent(item.roi_pct)}</td><td style={tdStyle}>{formatPercent(item.actual_1boat_win_rate_pct)}</td></tr>) : <EmptyRow colSpan={6} />}</tbody></table></div></section>

			<section style={sectionStyle} aria-label="ST進入分析"><SectionHeader eyebrow="ST / ENTRY" title="8. 展示ST / 本番ST / 進入" description="艇番とcourseを混同せず、sourceに保存済みの月次監査値のみ表示します。" /><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "1020px" }}><thead><tr><th style={thStyle}>月</th><th style={thStyle}>R</th><th style={thStyle}>比較可能R</th><th style={thStyle}>coverage</th><th style={thStyle}>平均絶対ST差</th><th style={thStyle}>ST差大R</th><th style={thStyle}>展示F</th><th style={thStyle}>本番F</th><th style={thStyle}>展示進入変化R</th><th style={thStyle}>本番進入変化R</th></tr></thead><tbody>{displayRows.length ? displayRows.map((item) => <tr key={item.month}><td style={tdStyle}>{item.month}</td><td style={tdStyle}>{formatInteger(item.races)}</td><td style={tdStyle}>{formatInteger(item.st_comparable_races)}</td><td style={tdStyle}>{formatPercent(item.coverage_pct)}</td><td style={tdStyle}>{formatValue(item.avg_abs_st_delta)}</td><td style={tdStyle}>{formatInteger(item.races_with_large_st_delta_boat)}</td><td style={tdStyle}>{formatInteger(item.display_f_total)}</td><td style={tdStyle}>{formatInteger(item.actual_f_total)}</td><td style={tdStyle}>{formatInteger(item.display_entry_change_races)}</td><td style={tdStyle}>{formatInteger(item.actual_entry_change_races)}</td></tr>) : <EmptyRow colSpan={10} />}</tbody></table></div></section>

			<section style={sectionStyle} aria-label="モーター分析"><SectionHeader eyebrow="WINNER MOTOR" title="9. モーター分析" description="実勝ち艇を事後分類した監査です。高2連率motorの購入推奨ではありません。" aside={<SourceScopeBadge />} /><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "660px" }}><thead><tr><th style={thStyle}>勝ち艇motor2連率帯</th><th style={thStyle}>R</th><th style={thStyle}>的中率</th><th style={thStyle}>ROI</th></tr></thead><tbody>{data.winnerMotorBands.map((item) => <tr key={item.winner_motor_2rate_band}><td style={tdStyle}>{item.winner_motor_2rate_band}</td><td style={tdStyle}>{formatInteger(item.races)}</td><td style={tdStyle}>{formatPercent(item.hit_rate_pct)}</td><td style={tdStyle}>{formatPercent(item.roi_pct)}</td></tr>)}</tbody></table></div></section>

			<section style={sectionStyle} aria-label="データ品質"><SectionHeader eyebrow="AUDIT" title="10. DATA QUALITY" description="欠損・抽出失敗・AUTO分類を隠さず表示します。" aside={<span className={`boat-monthly-badge ${qualityStatus === "warning" ? "boat-monthly-badge-warning" : ""}`}>{qualityStatus}</span>} /><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "720px" }}><thead><tr><th style={thStyle}>quality field</th><th style={thStyle}>件数</th><th style={thStyle}>説明</th></tr></thead><tbody>{data.dataQuality.map((item) => <tr key={item.item}><td style={tdStyle}><strong>{item.item}</strong>{item.item === "classification_auto_proxy" ? <span className="boat-monthly-badge boat-monthly-badge-warning" style={{ marginLeft: "6px" }}>AUTO</span> : null}</td><td style={tdStyle}>{formatInteger(item.count)}</td><td style={{ ...tdStyle, whiteSpace: "normal" }}>{item.note}</td></tr>)}</tbody></table></div></section>

			<section style={sectionStyle} aria-label="次月KPI"><SectionHeader eyebrow="NEXT MONTH KPI" title="11. 次月改善ルール / NEXT MONTH KPI" description="target・baseline・meaningはJSONの記載をそのまま表示します。" /><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "760px" }}><thead><tr><th style={thStyle}>KPI</th><th style={thStyle}>current / baseline</th><th style={thStyle}>target</th><th style={thStyle}>note</th></tr></thead><tbody>{data.nextKpi.map((item) => <tr key={item.KPI}><td style={tdStyle}><strong>{item.KPI}</strong></td><td style={tdStyle}>{item.baseline || "—"}</td><td style={tdStyle}>{item.next_target || "—"}</td><td style={{ ...tdStyle, whiteSpace: "normal" }}>{item.meaning || "—"}</td></tr>)}</tbody></table></div></section>

			<section style={sectionStyle} aria-label="GPT素材プレビュー"><SectionHeader eyebrow="NEXT PHASE" title="12. GPT MATERIAL PREVIEW" description="PredictionPageへはまだ自動注入せず、JSONに存在する値と未収録項目だけをコピー可能な形で確認します。" aside={<button type="button" onClick={copyGptMaterial} style={{ padding: "9px 12px", borderRadius: "6px", border: `1px solid ${boatTheme.colors.aquaDeep}`, background: "white", color: boatTheme.colors.aquaDeep, fontWeight: 850, cursor: "pointer" }}>コピー</button>} />{copyStatus ? <p style={labelStyle} aria-live="polite">{copyStatus}</p> : null}<pre className="boat-monthly-preview">{gptMaterialPreview}</pre></section>

			<section style={sectionStyle} aria-label="source data contract"><SectionHeader eyebrow="RAW REPORT" title="13. Source / Data Contract" description="CSVをブラウザで全件fetchせず、manifestの配置一覧だけを表示します。" /><details style={panelStyle} open><summary style={{ cursor: "pointer", fontWeight: 850, color: boatTheme.colors.navy }}>RAW REPORT / source metadata</summary><div style={metricGridStyle}><MetricCard label="data file" value={BOAT_MONTHLY_REVIEW_DATA_FILE} /><MetricCard label="generatedAt" value={data.generated_at || "未取得"} /><MetricCard label="period" value={`${data.period.start} ～ ${data.period.end}`} /><MetricCard label="partial months" value={partialMonths.length ? partialMonths.join(" / ") : "なし"} /><MetricCard label="version / schemaVersion" value={data.schemaVersion ?? data.version ?? "未取得"} /><MetricCard label="classification" value={data.method.classification ?? "未取得"} /></div><div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "560px" }}><thead><tr><th style={thStyle}>配置ファイル</th><th style={thStyle}>bytes</th></tr></thead><tbody>{manifest?.files ? Object.entries(manifest.files).map(([name, item]) => <tr key={name}><td style={tdStyle}>{name}</td><td style={tdStyle}>{formatInteger(item.bytes)}</td></tr>) : <EmptyRow colSpan={2} label="manifestを取得できませんでした。" />}</tbody></table></div></details></section>
		</PageShell>
	);
}
