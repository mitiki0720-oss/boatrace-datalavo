import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import type {
	BoatExDateIndexEntry,
	BoatExDateIndexFile,
	BoatExRacerEvidenceFile,
	BoatExRacerEvidenceItem,
	BoatExPredictionStructureV1File,
	BoatExRoughIndexV1File,
	BoatExTodayFlowV1File,
	BoatExVenueBiasV1File,
	BoatExVenueEvidenceFile,
	BoatExVenueEvidenceItem,
} from "../lib/boatExTypes";
import { boatTheme } from "../lib/theme";

type BoatExSectionKey =
	| "overview"
	| "identity"
	| "data-coverage"
	| "trend-lab"
	| "trifecta-ranking"
	| "rough-index"
	| "race-transition"
	| "weather"
	| "venue-bias"
	| "today-flow"
	| "prediction-structure"
	| "ex-analysis";

type BoatExManifestFile = {
	path?: string;
	kind?: string;
	date?: string;
	sourceStatus?: string;
	coverageStatus?: string;
	recordCount?: number;
	racerCount?: number;
};

type BoatExManifest = {
	schemaVersion?: number;
	kind?: string;
	generatedAt?: string;
	sourceFiles?: Array<{
		sourceName?: string;
		sourcePath?: string;
		sourceStatus?: string;
		coverageStatus?: string;
	}>;
	files?: BoatExManifestFile[];
};

type LoadState = {
	status: "loading" | "ready" | "missing";
	manifest: BoatExManifest | null;
	derivedManifest: BoatExManifest | null;
	dateIndex: BoatExDateIndexFile | null;
	venueEvidence: BoatExVenueEvidenceFile | null;
	racerEvidence: BoatExRacerEvidenceFile | null;
	venueBias: BoatExVenueBiasV1File | null;
	roughIndex: BoatExRoughIndexV1File | null;
	todayFlow: BoatExTodayFlowV1File | null;
	predictionStructure: BoatExPredictionStructureV1File | null;
	message: string;
};

const sectionCards: Array<{
	key: BoatExSectionKey;
	title: string;
	subtitle: string;
	status: "ready" | "available" | "pending" | "insufficient-history";
}> = [
	{ key: "overview", title: "概要", subtitle: "全体サマリー", status: "ready" },
	{ key: "identity", title: "選手・出走者データ", subtitle: "選手情報", status: "available" },
	{ key: "data-coverage", title: "データ充足状況", subtitle: "自動更新・出典", status: "available" },
	{ key: "trend-lab", title: "傾向分析ラボ", subtitle: "計画データ", status: "pending" },
	{ key: "trifecta-ranking", title: "3連単ランキング", subtitle: "3連単 v1", status: "pending" },
	{ key: "rough-index", title: "荒れ指数", subtitle: "結果・払戻 v1", status: "insufficient-history" },
	{ key: "race-transition", title: "レース推移", subtitle: "推移 v1", status: "pending" },
	{ key: "weather", title: "天候・水面", subtitle: "風・波の事実", status: "available" },
	{ key: "venue-bias", title: "会場傾向", subtitle: "会場傾向 v1", status: "available" },
	{ key: "today-flow", title: "当日フロー", subtitle: "当日フロー v1", status: "insufficient-history" },
	{ key: "prediction-structure", title: "予測構造ラボ", subtitle: "カバレッジマップ v1", status: "pending" },
	{ key: "ex-analysis", title: "EX分析", subtitle: "会場・選手の照合", status: "pending" },
];

const cardGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))",
	gap: "12px",
	alignItems: "stretch",
};

const sectionMenuStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(146px, 1fr))",
	gap: "10px",
	alignItems: "stretch",
};

const metricGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
	gap: "12px",
	alignItems: "stretch",
};

const twoColumnGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
	gap: "12px",
	alignItems: "stretch",
};

const dashboardRowStyle = {
	display: "grid",
	gridTemplateColumns: "minmax(430px, 1.6fr) repeat(4, minmax(150px, 0.65fr))",
	gap: "12px",
	alignItems: "stretch",
};

const cardStyle = {
	padding: "16px",
	borderRadius: "8px",
	background: "rgba(255, 255, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "8px",
};

const menuCardStyle = {
	...cardStyle,
	width: "100%",
	minHeight: "96px",
	padding: "12px",
	textAlign: "left" as const,
	cursor: "pointer",
	font: "inherit",
};

const labelStyle = {
	margin: 0,
	fontSize: "0.78rem",
	fontWeight: 800,
	letterSpacing: "0.08em",
	color: boatTheme.colors.aquaDeep,
	textTransform: "uppercase" as const,
};

const valueStyle = {
	margin: 0,
	fontSize: "1.12rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const metricValueStyle = {
	...valueStyle,
	fontSize: "1.45rem",
};

const menuTitleStyle = {
	margin: 0,
	fontSize: "0.9rem",
	fontWeight: 850,
	lineHeight: 1.18,
	color: boatTheme.colors.navy,
};

const menuSubtitleStyle = {
	margin: 0,
	fontSize: "0.78rem",
	lineHeight: 1.45,
	color: boatTheme.colors.muted,
};

const textStyle = {
	margin: 0,
	lineHeight: 1.65,
	color: boatTheme.colors.muted,
};

const noteListStyle = {
	margin: 0,
	paddingLeft: "1.1rem",
	lineHeight: 1.75,
	color: boatTheme.colors.muted,
};

const tableWrapStyle = {
	overflowX: "auto" as const,
	border: `1px solid ${boatTheme.colors.line}`,
	borderRadius: "8px",
	background: "rgba(255, 255, 255, 0.92)",
};

const tableStyle = {
	width: "100%",
	minWidth: "1260px",
	borderCollapse: "collapse" as const,
	fontSize: "0.9rem",
};

const thStyle = {
	padding: "12px 10px",
	textAlign: "left" as const,
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.78rem",
	letterSpacing: "0.04em",
	background: "rgba(223, 245, 255, 0.64)",
};

const tdStyle = {
	padding: "10px 10px",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.ink,
	verticalAlign: "top" as const,
};

function findLatestHistoryFile(manifest: BoatExManifest | null): BoatExManifestFile | undefined {
	return [...(manifest?.files ?? [])]
		.filter((file) => file.kind === "history" && file.date)
		.sort((left, right) => String(right.date).localeCompare(String(left.date)))
		[0];
}

function statusLabel(status: string | undefined): string {
	const value = status ?? "unknown";
	const labels: Record<string, string> = {
		available: "表示可能",
		ready: "準備完了",
		pending: "準備中",
		"insufficient-history": "履歴不足",
		missing: "なし",
		error: "エラー",
		unknown: "不明",
	};
	return labels[value] ?? value;
}

function countLabel(value: number | undefined, total: number): string {
	return `${value ?? 0}/${total}`;
}

function numberLabel(value: number | null | undefined, digits = 2): string {
	if (typeof value !== "number") return "なし";
	return value.toFixed(digits).replace(/\.?0+$/u, "");
}

function yenLabel(value: number | null | undefined): string {
	if (typeof value !== "number") return "なし";
	return `${value.toLocaleString("ja-JP")}円`;
}

function venueReadinessLabel(venue: BoatExVenueEvidenceItem, key: "venueBias" | "roughIndex" | "todayFlow"): string {
	return statusLabel(venue.derivedReadiness[key]?.status ?? "pending");
}

function racerReadinessLabel(
	racer: BoatExRacerEvidenceItem,
	key: "racerProfile" | "courseChangePattern" | "exhibitionReliability" | "startTimingPattern",
): string {
	return statusLabel(racer.derivedReadiness[key]?.status ?? "pending");
}

function courseChangeLabel(racer: BoatExRacerEvidenceItem): string {
	if (racer.courseChangeEvidence.sourceStatus === "missing") return "ソースなし";
	const frameCount = racer.courseChangeEvidence.frameToFinalCourseChangedCount;
	const exhibitionCount = racer.courseChangeEvidence.exhibitionToFinalCourseChangedCount;
	return `枠番 ${frameCount ?? "不明"} / 展示 ${exhibitionCount ?? "不明"}`;
}

function hasDerivedFile(manifest: BoatExManifest | null, part: string): boolean {
	return (manifest?.files ?? []).some((file) => String(file.path ?? "").includes(part));
}

function findDateIndexEntry(dateIndex: BoatExDateIndexFile | null, date: string): BoatExDateIndexEntry | undefined {
	return dateIndex?.dates.find((entry) => entry.date === date);
}

function readinessLabel(entry: BoatExDateIndexEntry | undefined, key: keyof BoatExDateIndexEntry["readiness"]): string {
	return statusLabel(entry?.readiness?.[key] ?? "missing");
}

function SectionShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
	return (
		<section style={{ ...cardStyle, gap: "14px", padding: "18px" }}>
			<div>
				<p style={labelStyle}>{subtitle}</p>
				<p style={valueStyle}>{title}</p>
			</div>
			{children}
		</section>
	);
}

function PendingPanel({ status, reason, source }: { status: string; reason: string; source?: string }) {
	return (
		<section style={twoColumnGridStyle}>
			<article style={cardStyle}>
				<p style={labelStyle}>状態</p>
				<p style={valueStyle}>{statusLabel(status)}</p>
				<p style={textStyle}>{reason}</p>
			</article>
			<article style={cardStyle}>
				<p style={labelStyle}>出典ポリシー</p>
				<p style={valueStyle}>{source ?? "ソースに基づく情報のみ"}</p>
				<p style={textStyle}>このフェーズでは架空のスコア、推定ランキング、高確度ラベルを表示しません。</p>
			</article>
		</section>
	);
}

function VenueEvidenceSection({ venueEvidence }: { venueEvidence: BoatExVenueEvidenceFile | null }) {
	if (!venueEvidence) return <p style={textStyle}>EX会場エビデンスがありません。固定値は使用しません。</p>;

	return (
		<>
			<div style={tableWrapStyle}>
				<table style={tableStyle}>
					<thead>
						<tr>
							<th style={thStyle}>会場</th>
							<th style={thStyle}>レース数</th>
							<th style={thStyle}>結果</th>
							<th style={thStyle}>展示</th>
							<th style={thStyle}>天候</th>
							<th style={thStyle}>払戻</th>
							<th style={thStyle}>会場傾向</th>
							<th style={thStyle}>荒れ指数</th>
							<th style={thStyle}>当日フロー</th>
							<th style={thStyle}>注意事項</th>
						</tr>
					</thead>
					<tbody>
						{venueEvidence.venues.map((venue) => (
							<tr key={venue.venueCode}>
								<td style={tdStyle}>
									<strong>{venue.venueName}</strong>
									<br />
									<span>{venue.venueCode}</span>
								</td>
								<td style={tdStyle}>{venue.raceCount}</td>
								<td style={tdStyle}>
									{countLabel(venue.availability.officialResultCount, venue.raceCount)}
									<br />
									{statusLabel(venue.coverage.result)}
								</td>
								<td style={tdStyle}>
									{countLabel(venue.availability.officialExhibitionCount, venue.raceCount)}
									<br />
									{statusLabel(venue.coverage.exhibition)}
								</td>
								<td style={tdStyle}>
									{countLabel(venue.availability.weatherCount, venue.raceCount)}
									<br />
									{statusLabel(venue.coverage.weather)}
								</td>
								<td style={tdStyle}>
									平均 {yenLabel(venue.resultEvidence.averageTrifectaPayout)}
									<br />
									最大 {yenLabel(venue.resultEvidence.maxTrifectaPayout)}
								</td>
								<td style={tdStyle}>{venueReadinessLabel(venue, "venueBias")}</td>
								<td style={tdStyle}>{venueReadinessLabel(venue, "roughIndex")}</td>
								<td style={tdStyle}>{venueReadinessLabel(venue, "todayFlow")}</td>
								<td style={tdStyle}>{venue.warnings.length > 0 ? venue.warnings.join(" / ") : "なし"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<section style={{ ...cardGridStyle, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
				{venueEvidence.venues.map((venue) => (
					<article key={`venue-card-${venue.venueCode}`} style={cardStyle}>
						<p style={labelStyle}>{venue.venueCode}</p>
						<p style={valueStyle}>{venue.venueName}</p>
						<p style={textStyle}>レース数: {venue.raceCount}</p>
						<p style={textStyle}>結果: {countLabel(venue.availability.officialResultCount, venue.raceCount)}</p>
						<p style={textStyle}>展示: {countLabel(venue.availability.officialExhibitionCount, venue.raceCount)}</p>
						<p style={textStyle}>天候: {countLabel(venue.availability.weatherCount, venue.raceCount)}</p>
						<p style={textStyle}>会場傾向: {venueReadinessLabel(venue, "venueBias")}</p>
					</article>
				))}
			</section>
		</>
	);
}

function RacerEvidenceSection({ racerEvidence }: { racerEvidence: BoatExRacerEvidenceFile | null }) {
	if (!racerEvidence) return <p style={textStyle}>EX選手エビデンスがありません。固定値は使用しません。</p>;
	const topRacers = racerEvidence.racers.slice(0, 50);

	return (
		<>
			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1460px" }}>
					<thead>
						<tr>
							<th style={thStyle}>選手</th>
							<th style={thStyle}>登録番号</th>
							<th style={thStyle}>支部</th>
							<th style={thStyle}>級別</th>
							<th style={thStyle}>出走数</th>
							<th style={thStyle}>平均ST</th>
							<th style={thStyle}>平均展示タイム</th>
							<th style={thStyle}>進入変更</th>
							<th style={thStyle}>結果エビデンス</th>
							<th style={thStyle}>選手プロファイル</th>
							<th style={thStyle}>進入変更</th>
							<th style={thStyle}>注意事項</th>
						</tr>
					</thead>
					<tbody>
						{topRacers.map((racer) => (
							<tr key={racer.racerKey}>
								<td style={tdStyle}>
									<strong>{racer.racerName}</strong>
									<br />
									<span>{statusLabel(racer.identityStatus)}</span>
								</td>
								<td style={tdStyle}>{racer.registrationNumber ?? "なし"}</td>
								<td style={tdStyle}>{racer.branch ?? "なし"}</td>
								<td style={tdStyle}>{racer.className ?? "なし"}</td>
								<td style={tdStyle}>{racer.appearanceCount}</td>
								<td style={tdStyle}>{numberLabel(racer.startEvidence.averageST, 3)}</td>
								<td style={tdStyle}>{numberLabel(racer.exhibitionEvidence.averageExhibitionTime, 2)}</td>
								<td style={tdStyle}>{courseChangeLabel(racer)}</td>
								<td style={tdStyle}>
									結果 {racer.resultEvidence.availableCount}
									<br />
									1着 {racer.resultEvidence.winCount} / 3着内 {racer.resultEvidence.top3Count}
								</td>
								<td style={tdStyle}>{racerReadinessLabel(racer, "racerProfile")}</td>
								<td style={tdStyle}>{racerReadinessLabel(racer, "courseChangePattern")}</td>
								<td style={tdStyle}>{racer.warnings.length > 0 ? racer.warnings.join(" / ") : "なし"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<section style={{ ...cardGridStyle, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
				{topRacers.map((racer) => (
					<article key={`racer-card-${racer.racerKey}`} style={cardStyle}>
						<p style={labelStyle}>{racer.registrationNumber ?? statusLabel(racer.identityStatus)}</p>
						<p style={valueStyle}>{racer.racerName}</p>
						<p style={textStyle}>支部 / 級別: {racer.branch ?? "なし"} / {racer.className ?? "なし"}</p>
						<p style={textStyle}>出走数: {racer.appearanceCount}</p>
						<p style={textStyle}>平均ST: {numberLabel(racer.startEvidence.averageST, 3)}</p>
						<p style={textStyle}>平均展示タイム: {numberLabel(racer.exhibitionEvidence.averageExhibitionTime, 2)}</p>
						<p style={textStyle}>進入変更: {courseChangeLabel(racer)}</p>
						<p style={textStyle}>選手プロファイル: {racerReadinessLabel(racer, "racerProfile")}</p>
						<p style={textStyle}>進入変更傾向: {racerReadinessLabel(racer, "courseChangePattern")}</p>
						<p style={textStyle}>展示信頼性: {racerReadinessLabel(racer, "exhibitionReliability")}</p>
					</article>
				))}
			</section>
		</>
	);
}

function WeatherSection({ venueEvidence }: { venueEvidence: BoatExVenueEvidenceFile | null }) {
	if (!venueEvidence) return <p style={textStyle}>天候エビデンスがありません。固定値は使用しません。</p>;

	return (
		<div style={tableWrapStyle}>
			<table style={{ ...tableStyle, minWidth: "1180px" }}>
				<thead>
					<tr>
						<th style={thStyle}>会場</th>
						<th style={thStyle}>天候件数</th>
						<th style={thStyle}>平均風速</th>
						<th style={thStyle}>最大風速</th>
						<th style={thStyle}>平均波高</th>
						<th style={thStyle}>最大波高</th>
						<th style={thStyle}>状態</th>
					</tr>
				</thead>
				<tbody>
					{venueEvidence.venues.map((venue) => (
						<tr key={`weather-${venue.venueCode}`}>
							<td style={tdStyle}>{venue.venueName}</td>
							<td style={tdStyle}>{countLabel(venue.availability.weatherCount, venue.raceCount)}</td>
							<td style={tdStyle}>{numberLabel(venue.weatherEvidence.windSpeedAverageMps, 2)} m/s</td>
							<td style={tdStyle}>{numberLabel(venue.weatherEvidence.windSpeedMaxMps, 2)} m/s</td>
							<td style={tdStyle}>{numberLabel(venue.weatherEvidence.waveHeightAverageCm, 2)} cm</td>
							<td style={tdStyle}>{numberLabel(venue.weatherEvidence.waveHeightMaxCm, 2)} cm</td>
							<td style={tdStyle}>{statusLabel(venue.coverage.weather)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function boatNumberCountLabel(counts: Record<"1" | "2" | "3" | "4" | "5" | "6", number>): string {
	return ["1", "2", "3", "4", "5", "6"].map((boatNumber) => `${boatNumber}:${counts[boatNumber as keyof typeof counts]}`).join(" / ");
}

function boatNumberRateLabel(rates: Record<"1" | "2" | "3" | "4" | "5" | "6", number | null>): string {
	return ["1", "2", "3", "4", "5", "6"].map((boatNumber) => {
		const rate = rates[boatNumber as keyof typeof rates];
		return `${boatNumber}:${rate === null ? "該当なし" : `${numberLabel(rate * 100, 1)}%`}`;
	}).join(" / ");
}

function VenueBiasSection({ venueBias }: { venueBias: BoatExVenueBiasV1File | null }) {
	if (!venueBias) return <p style={textStyle}>会場傾向エビデンスがありません。固定値は使用しません。</p>;

	return (
		<>
			<section style={metricGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>状態</p>
					<p style={metricValueStyle}>{statusLabel(venueBias.status)}</p>
					<p style={textStyle}>ソースに基づく会場傾向データです。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>対象期間</p>
					<p style={valueStyle}>{venueBias.dateRange.from} から {venueBias.dateRange.to}</p>
					<p style={textStyle}>利用可能な日付: {venueBias.dateRange.dateCount}日</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>レース数 / 会場数</p>
					<p style={metricValueStyle}>{venueBias.summary.raceCount} / {venueBias.summary.venueCount}</p>
					<p style={textStyle}>対象期間内の全履歴レコードと重複しない会場IDです。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>準備状況</p>
					<p style={metricValueStyle}>{statusLabel(venueBias.readiness.status)}</p>
					<p style={textStyle}>{venueBias.readiness.reason}</p>
				</article>
			</section>
			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1480px" }}>
					<thead>
						<tr>
							<th style={thStyle}>会場</th>
							<th style={thStyle}>日数</th>
							<th style={thStyle}>レース数</th>
							<th style={thStyle}>結果</th>
							<th style={thStyle}>展示</th>
							<th style={thStyle}>1着艇番件数</th>
							<th style={thStyle}>1着艇番比率</th>
							<th style={thStyle}>3着内艇番件数</th>
							<th style={thStyle}>3着内艇番比率</th>
							<th style={thStyle}>準備状況</th>
						</tr>
					</thead>
					<tbody>
						{venueBias.venues.map((venue) => (
							<tr key={venue.venueId}>
								<td style={tdStyle}>{venue.venueName} ({venue.venueId})</td>
								<td style={tdStyle}>{venue.dateCount}</td>
								<td style={tdStyle}>{venue.raceCount}</td>
								<td style={tdStyle}>{venue.resultAvailableRaceCount}</td>
								<td style={tdStyle}>{venue.exhibitionAvailableRaceCount}</td>
								<td style={tdStyle}>{boatNumberCountLabel(venue.firstPlaceBoatNumberCounts)}</td>
								<td style={tdStyle}>{boatNumberRateLabel(venue.firstPlaceBoatNumberRates)}</td>
								<td style={tdStyle}>{boatNumberCountLabel(venue.top3BoatNumberCounts)}</td>
								<td style={tdStyle}>{boatNumberRateLabel(venue.top3BoatNumberRates)}</td>
								<td style={tdStyle}>{statusLabel(venue.readiness.status)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

function RoughIndexSection({ roughIndex }: { roughIndex: BoatExRoughIndexV1File | null }) {
	if (!roughIndex) return <p style={textStyle}>荒れ指数エビデンスがありません。固定値は使用しません。</p>;

	return (
		<>
			<section style={metricGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>状態</p>
					<p style={metricValueStyle}>{statusLabel(roughIndex.status)}</p>
					<p style={textStyle}>履歴・結果・払戻に基づく荒れ指数ファイルの状態です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>準備状況</p>
					<p style={metricValueStyle}>{statusLabel(roughIndex.readiness.status)}</p>
					<p style={textStyle}>{roughIndex.readiness.reason}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>対象期間</p>
					<p style={valueStyle}>{roughIndex.dateRange.from} から {roughIndex.dateRange.to}</p>
					<p style={textStyle}>ソースに基づく日付: {roughIndex.dateRange.dateCount}日</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>レース数 / 会場数</p>
					<p style={metricValueStyle}>{roughIndex.summary.raceCount} / {roughIndex.summary.venueCount}</p>
					<p style={textStyle}>履歴レース数と重複しない会場数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>払戻充足数</p>
					<p style={metricValueStyle}>{roughIndex.summary.payoutAvailableRaceCount}</p>
					<p style={textStyle}>必要最小件数: {roughIndex.thresholds.minPayoutRaceCount}レース</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>高額払戻しの基準</p>
					<p style={metricValueStyle}>{yenLabel(roughIndex.thresholds.trifectaHighPayoutThreshold)}</p>
					<p style={textStyle}>払戻エビデンスがないため、比率・荒れ指数は出力しません。</p>
				</article>
			</section>

			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1320px" }}>
					<thead>
						<tr>
							<th style={thStyle}>会場</th>
							<th style={thStyle}>日数</th>
							<th style={thStyle}>レース数</th>
							<th style={thStyle}>結果</th>
							<th style={thStyle}>払戻</th>
							<th style={thStyle}>3連単</th>
							<th style={thStyle}>基準超過</th>
							<th style={thStyle}>準備状況</th>
						</tr>
					</thead>
					<tbody>
						{roughIndex.venues.map((venue) => (
							<tr key={venue.venueId}>
								<td style={tdStyle}>{venue.venueName} ({venue.venueId})</td>
								<td style={tdStyle}>{venue.dateCount}</td>
								<td style={tdStyle}>{venue.raceCount}</td>
								<td style={tdStyle}>{venue.resultAvailableRaceCount}</td>
								<td style={tdStyle}>{venue.payoutAvailableRaceCount}</td>
								<td style={tdStyle}>{venue.trifectaAvailableRaceCount}</td>
								<td style={tdStyle}>{venue.trifectaOver10000RaceCount}</td>
								<td style={tdStyle}>
									{statusLabel(venue.readiness.status)}
									<br />
									<span>{venue.readiness.reason}</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{roughIndex.warnings.length > 0 ? (
				<section style={cardStyle}>
					<p style={labelStyle}>注意事項</p>
					<ul style={noteListStyle}>
						{roughIndex.warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</section>
			) : null}
		</>
	);
}

function TodayFlowSection({ todayFlow }: { todayFlow: BoatExTodayFlowV1File | null }) {
	if (!todayFlow) return <p style={textStyle}>当日フローエビデンスがありません。固定値は使用しません。</p>;

	return (
		<>
			<section style={metricGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>状態</p>
					<p style={metricValueStyle}>{statusLabel(todayFlow.status)}</p>
					<p style={textStyle}>ソースに基づく当日フローファイルの状態です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>準備状況</p>
					<p style={metricValueStyle}>{statusLabel(todayFlow.readiness.status)}</p>
					<p style={textStyle}>{todayFlow.readiness.reason}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>対象日</p>
					<p style={valueStyle}>{todayFlow.targetDate ?? "なし"}</p>
					<p style={textStyle}>ソースに基づく日付: {todayFlow.dateRange?.dateCount ?? 0}日</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>レース数 / 会場数</p>
					<p style={metricValueStyle}>{todayFlow.summary.raceCount} / {todayFlow.summary.venueCount}</p>
					<p style={textStyle}>対象日のレースレコードと会場数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>結果充足数</p>
					<p style={metricValueStyle}>{todayFlow.summary.resultAvailableRaceCount}</p>
					<p style={textStyle}>3連単結果: {todayFlow.summary.trifectaAvailableRaceCount}件</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>払戻充足数</p>
					<p style={metricValueStyle}>{todayFlow.summary.payoutAvailableRaceCount}</p>
					<p style={textStyle}>高額払戻しはソースで確認できる場合のみ表示します。</p>
				</article>
			</section>

			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1480px" }}>
					<thead>
						<tr>
							<th style={thStyle}>会場</th>
							<th style={thStyle}>レース数</th>
							<th style={thStyle}>結果</th>
							<th style={thStyle}>1着艇番推移</th>
							<th style={thStyle}>直近の1着艇番</th>
							<th style={thStyle}>イン勝ち</th>
							<th style={thStyle}>アウト勝ち</th>
							<th style={thStyle}>払戻レース</th>
							<th style={thStyle}>高額払戻レース</th>
							<th style={thStyle}>補足</th>
						</tr>
					</thead>
					<tbody>
						{todayFlow.venues.map((venue) => (
							<tr key={venue.venueCode}>
								<td style={tdStyle}>{venue.venueName} ({venue.venueCode})</td>
								<td style={tdStyle}>{venue.raceCount}</td>
								<td style={tdStyle}>{venue.resultAvailableRaceCount}</td>
								<td style={tdStyle}>{venue.firstPlaceBoatSequence.map((race) => `第${race.raceNo}R:${race.firstPlaceBoat ?? "-"}`).join(" / ")}</td>
								<td style={tdStyle}>{venue.recentFirstPlaceBoats.join(" / ") || "なし"}</td>
								<td style={tdStyle}>{venue.insideWinCount}</td>
								<td style={tdStyle}>{venue.outsideWinCount}</td>
								<td style={tdStyle}>{venue.payoutAvailableRaceCount}</td>
								<td style={tdStyle}>{venue.highPayoutRaceCount}</td>
								<td style={tdStyle}>{venue.notes.join(" ") || "-"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{todayFlow.warnings.length > 0 ? (
				<section style={cardStyle}>
					<p style={labelStyle}>注意事項</p>
					<ul style={noteListStyle}>
						{todayFlow.warnings.map((warning) => <li key={warning}>{warning}</li>)}
					</ul>
				</section>
			) : null}
		</>
	);
}

function PredictionStructureSection({ predictionStructure }: { predictionStructure: BoatExPredictionStructureV1File | null }) {
	if (!predictionStructure) return <p style={textStyle}>予測構造エビデンスがありません。固定値は使用しません。</p>;

	return (
		<>
			<section style={metricGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>状態</p>
					<p style={metricValueStyle}>{statusLabel(predictionStructure.status)}</p>
					<p style={textStyle}>ソースに基づくカバレッジマップの状態です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>準備状況</p>
					<p style={metricValueStyle}>{statusLabel(predictionStructure.readiness.status)}</p>
					<p style={textStyle}>{predictionStructure.readiness.reason}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>対象日</p>
					<p style={valueStyle}>{predictionStructure.targetDate}</p>
					<p style={textStyle}>ソースに基づく日付: {predictionStructure.dateRange.dateCount}日</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>レース数 / 会場数</p>
					<p style={metricValueStyle}>{predictionStructure.summary.raceCount} / {predictionStructure.summary.venueCount}</p>
					<p style={textStyle}>対象日のカバレッジのみを表示します。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>結果 / 展示</p>
					<p style={metricValueStyle}>{predictionStructure.summary.resultAvailableRaceCount} / {predictionStructure.summary.exhibitionAvailableRaceCount}</p>
					<p style={textStyle}>結果・展示のカバレッジ件数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>天候 / 選手</p>
					<p style={metricValueStyle}>{predictionStructure.summary.weatherAvailableRaceCount} / {predictionStructure.summary.racerAvailableRaceCount}</p>
					<p style={textStyle}>天候・選手のカバレッジ件数です。</p>
				</article>
			</section>

			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1360px" }}>
					<thead><tr>
						<th style={thStyle}>会場</th><th style={thStyle}>レース数</th><th style={thStyle}>公式</th><th style={thStyle}>結果</th><th style={thStyle}>展示</th><th style={thStyle}>天候</th><th style={thStyle}>モーター</th><th style={thStyle}>ボート</th><th style={thStyle}>選手</th><th style={thStyle}>注意事項</th>
					</tr></thead>
					<tbody>{predictionStructure.venues.map((venue) => (
						<tr key={venue.venueCode}>
							<td style={tdStyle}>{venue.venueName} ({venue.venueCode})</td><td style={tdStyle}>{venue.raceCount}</td><td style={tdStyle}>{venue.officialRaceCount}</td><td style={tdStyle}>{venue.resultAvailableRaceCount}</td><td style={tdStyle}>{venue.exhibitionAvailableRaceCount}</td><td style={tdStyle}>{venue.weatherAvailableRaceCount}</td><td style={tdStyle}>{venue.motorAvailableRaceCount}</td><td style={tdStyle}>{venue.boatAvailableRaceCount}</td><td style={tdStyle}>{venue.racerAvailableRaceCount}</td><td style={tdStyle}>{venue.warnings.join(" ") || "-"}</td>
						</tr>
					))}</tbody>
				</table>
			</div>

			{predictionStructure.warnings.length > 0 ? <section style={cardStyle}><p style={labelStyle}>注意事項</p><ul style={noteListStyle}>{predictionStructure.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
		</>
	);
}

type ExAnalysisVenueRow = {
	venueCode: string;
	venueName: string;
	venueBias: BoatExVenueBiasV1File["venues"][number] | null;
	roughIndex: BoatExRoughIndexV1File["venues"][number] | null;
	todayFlow: BoatExTodayFlowV1File["venues"][number] | null;
	predictionStructure: BoatExPredictionStructureV1File["venues"][number] | null;
	ambiguousSources: string[];
};

function buildExAnalysisVenueRows(
	venueBias: BoatExVenueBiasV1File | null,
	roughIndex: BoatExRoughIndexV1File | null,
	todayFlow: BoatExTodayFlowV1File | null,
	predictionStructure: BoatExPredictionStructureV1File | null,
): ExAnalysisVenueRow[] {
	const rows = new Map<string, ExAnalysisVenueRow>();
	const rowFor = (venueCode: string, venueName: string) => {
		const key = `${venueCode}\u0000${venueName}`;
		const existing = rows.get(key);
		if (existing) return existing;

		const row: ExAnalysisVenueRow = {
			venueCode,
			venueName,
			venueBias: null,
			roughIndex: null,
			todayFlow: null,
			predictionStructure: null,
			ambiguousSources: [],
		};
		rows.set(key, row);
		return row;
	};

	const addUnique = <T,>(
		label: string,
		entries: T[],
		getCode: (entry: T) => string,
		getName: (entry: T) => string,
		assign: (row: ExAnalysisVenueRow, entry: T | null) => void,
	) => {
		const seen = new Set<string>();
		for (const entry of entries) {
			const venueCode = getCode(entry);
			const venueName = getName(entry);
			const key = `${venueCode}\u0000${venueName}`;
			const row = rowFor(venueCode, venueName);
			if (seen.has(key)) {
				assign(row, null);
				if (!row.ambiguousSources.includes(label)) row.ambiguousSources.push(label);
				continue;
			}
			seen.add(key);
			assign(row, entry);
		}
	};

	addUnique("会場傾向", venueBias?.venues ?? [], (venue) => venue.venueId, (venue) => venue.venueName, (row, venue) => {
		row.venueBias = venue;
	});
	addUnique("荒れ指数", roughIndex?.venues ?? [], (venue) => venue.venueId, (venue) => venue.venueName, (row, venue) => {
		row.roughIndex = venue;
	});
	addUnique("当日フロー", todayFlow?.venues ?? [], (venue) => venue.venueCode, (venue) => venue.venueName, (row, venue) => {
		row.todayFlow = venue;
	});
	addUnique("予測構造", predictionStructure?.venues ?? [], (venue) => venue.venueCode, (venue) => venue.venueName, (row, venue) => {
		row.predictionStructure = venue;
	});

	return [...rows.values()].sort((left, right) => left.venueName.localeCompare(right.venueName, "ja"));
}

function ExAnalysisHubSection({
	venueBias,
	roughIndex,
	todayFlow,
	predictionStructure,
}: {
	venueBias: BoatExVenueBiasV1File | null;
	roughIndex: BoatExRoughIndexV1File | null;
	todayFlow: BoatExTodayFlowV1File | null;
	predictionStructure: BoatExPredictionStructureV1File | null;
}) {
	const venueRows = buildExAnalysisVenueRows(venueBias, roughIndex, todayFlow, predictionStructure);
	const targetDates = [...new Set([
		todayFlow?.targetDate,
		predictionStructure?.targetDate,
		venueBias?.dateRange.to,
		roughIndex?.dateRange.to,
	].filter((date): date is string => Boolean(date)))];
	const sourceFiles = [
		...(venueBias?.sourceFiles.map((path) => `会場傾向: ${path}`) ?? []),
		...(roughIndex?.sourceFiles.map((path) => `荒れ指数: ${path}`) ?? []),
		...(todayFlow?.sourceFiles.map((source) => `当日フロー: ${source.sourcePath}`) ?? []),
		...(predictionStructure?.sourceFiles.map((source) => `予測構造: ${source.sourcePath}`) ?? []),
	];
	const warnings = [
		...(venueBias?.warnings.map((warning) => `会場傾向: ${warning}`) ?? []),
		...(roughIndex?.warnings.map((warning) => `荒れ指数: ${warning}`) ?? []),
		...(todayFlow?.warnings.map((warning) => `当日フロー: ${warning}`) ?? []),
		...(predictionStructure?.warnings.map((warning) => `予測構造: ${warning}`) ?? []),
	];

	if (!venueBias && !roughIndex && !todayFlow && !predictionStructure) {
		return <p style={textStyle}>EX分析に使用できる派生エビデンスがありません。固定値は使用しません。</p>;
	}

	return (
		<>
			<section style={metricGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>EX分析 v1</p>
					<p style={metricValueStyle}>ソースに基づく照合</p>
					<p style={textStyle}>投票推奨、予測、合成スコアは生成しません。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>対象日 / 期間終端</p>
					<p style={valueStyle}>{targetDates.join(" / ") || "なし"}</p>
					<p style={textStyle}>複数の値がある場合は、各派生ファイルの値をそのまま併記します。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>参照会場数</p>
					<p style={metricValueStyle}>{venueRows.length}</p>
					<p style={textStyle}>会場コードと会場名の完全一致時だけ同じ行に表示します。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>当日レース / 結果 / 払戻</p>
					<p style={metricValueStyle}>{todayFlow ? `${todayFlow.summary.raceCount} / ${todayFlow.summary.resultAvailableRaceCount} / ${todayFlow.summary.payoutAvailableRaceCount}` : "なし"}</p>
					<p style={textStyle}>当日フローのsource-backed件数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>予測材料カバレッジ</p>
					<p style={metricValueStyle}>{predictionStructure ? `${predictionStructure.summary.officialRaceCount} / ${predictionStructure.summary.exhibitionAvailableRaceCount} / ${predictionStructure.summary.racerAvailableRaceCount}` : "なし"}</p>
					<p style={textStyle}>公式 / 展示 / 選手のカバレッジ件数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>注意事項</p>
					<p style={metricValueStyle}>{warnings.length}</p>
					<p style={textStyle}>各派生ファイルに記録されたwarningの合計です。</p>
				</article>
			</section>

			<section style={cardGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>会場傾向</p>
					<p style={valueStyle}>{venueBias ? statusLabel(venueBias.readiness.status) : "なし"}</p>
					<p style={textStyle}>{venueBias ? `期間: ${venueBias.dateRange.from} から ${venueBias.dateRange.to} / 会場: ${venueBias.summary.venueCount} / レース: ${venueBias.summary.raceCount}` : "派生ファイルなし"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>荒れ指数</p>
					<p style={valueStyle}>{roughIndex ? statusLabel(roughIndex.readiness.status) : "なし"}</p>
					<p style={textStyle}>{roughIndex ? `期間: ${roughIndex.dateRange.from} から ${roughIndex.dateRange.to} / 会場: ${roughIndex.summary.venueCount} / 払戻: ${roughIndex.summary.payoutAvailableRaceCount}` : "派生ファイルなし"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>当日フロー</p>
					<p style={valueStyle}>{todayFlow ? statusLabel(todayFlow.readiness.status) : "なし"}</p>
					<p style={textStyle}>{todayFlow ? `対象日: ${todayFlow.targetDate ?? "なし"} / 会場: ${todayFlow.summary.venueCount} / レース: ${todayFlow.summary.raceCount}` : "派生ファイルなし"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>予測構造</p>
					<p style={valueStyle}>{predictionStructure ? statusLabel(predictionStructure.readiness.status) : "なし"}</p>
					<p style={textStyle}>{predictionStructure ? `対象日: ${predictionStructure.targetDate} / 会場: ${predictionStructure.summary.venueCount} / レース: ${predictionStructure.summary.raceCount}` : "派生ファイルなし"}</p>
				</article>
			</section>

			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1480px" }}>
					<thead>
						<tr>
							<th style={thStyle}>会場</th>
							<th style={thStyle}>会場傾向</th>
							<th style={thStyle}>荒れ指数</th>
							<th style={thStyle}>当日フロー</th>
							<th style={thStyle}>予測構造</th>
							<th style={thStyle}>照合状態</th>
						</tr>
					</thead>
					<tbody>
						{venueRows.map((venue) => (
							<tr key={`${venue.venueCode}-${venue.venueName}`}>
								<td style={tdStyle}>{venue.venueName} ({venue.venueCode})</td>
								<td style={tdStyle}>{venue.venueBias ? `日数 ${venue.venueBias.dateCount} / レース ${venue.venueBias.raceCount} / 結果 ${venue.venueBias.resultAvailableRaceCount}` : "なし"}</td>
								<td style={tdStyle}>{venue.roughIndex ? `日数 ${venue.roughIndex.dateCount} / レース ${venue.roughIndex.raceCount} / 払戻 ${venue.roughIndex.payoutAvailableRaceCount}` : "なし"}</td>
								<td style={tdStyle}>{venue.todayFlow ? `レース ${venue.todayFlow.raceCount} / 結果 ${venue.todayFlow.resultAvailableRaceCount} / 払戻 ${venue.todayFlow.payoutAvailableRaceCount}` : "なし"}</td>
								<td style={tdStyle}>{venue.predictionStructure ? `公式 ${venue.predictionStructure.officialRaceCount} / 展示 ${venue.predictionStructure.exhibitionAvailableRaceCount} / 選手 ${venue.predictionStructure.racerAvailableRaceCount}` : "なし"}</td>
								<td style={tdStyle}>{venue.ambiguousSources.length > 0 ? `同一ソース内で重複: ${venue.ambiguousSources.join(" / ")}` : "会場コード・会場名の完全一致"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<section style={twoColumnGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>ソースファイル</p>
					<ul style={noteListStyle}>
						{sourceFiles.length > 0 ? sourceFiles.map((source) => <li key={source}>{source}</li>) : <li>なし</li>}
					</ul>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>警告</p>
					<ul style={noteListStyle}>
						{warnings.length > 0 ? warnings.map((warning) => <li key={warning}>{warning}</li>) : <li>なし</li>}
					</ul>
				</article>
			</section>
		</>
	);
}

export function BoatExPage() {
	const [activeSection, setActiveSection] = useState<BoatExSectionKey>("overview");
	const [loadState, setLoadState] = useState<LoadState>({
		status: "loading",
		manifest: null,
		derivedManifest: null,
		dateIndex: null,
		venueEvidence: null,
		racerEvidence: null,
		venueBias: null,
		roughIndex: null,
		todayFlow: null,
		predictionStructure: null,
		message: "EXエビデンスを確認しています。",
	});

	useEffect(() => {
		let isMounted = true;

		async function loadEvidence() {
			try {
				const manifestResponse = await fetch(withBasePath("data/boatrace-ex/manifest.generated.json"), {
					cache: "no-store",
				});
				if (!manifestResponse.ok) throw new Error(`manifest fetch failed: ${manifestResponse.status}`);
				const manifest = await manifestResponse.json() as BoatExManifest;
				const latestHistory = findLatestHistoryFile(manifest);
				let dateIndex: BoatExDateIndexFile | null = null;
				let indexMissing = false;

				try {
					const dateIndexResponse = await fetch(withBasePath("data/boatrace-ex/index.generated.json"), {
						cache: "no-store",
					});
					if (!dateIndexResponse.ok) throw new Error(`date index fetch failed: ${dateIndexResponse.status}`);
					dateIndex = await dateIndexResponse.json() as BoatExDateIndexFile;
				} catch {
					indexMissing = true;
				}

				const targetDate = dateIndex?.latestDate ?? latestHistory?.date;
				if (!targetDate) throw new Error("latest EX date is missing");

				const [derivedManifestResponse, venueResponse, racerResponse, venueBiasResponse, roughIndexResponse, todayFlowResponse, predictionStructureResponse] = await Promise.all([
					fetch(withBasePath("data/boatrace-ex/derived/manifest.generated.json"), { cache: "no-store" }),
					fetch(withBasePath(`data/boatrace-ex/derived/venue-evidence/${targetDate}.json`), {
						cache: "no-store",
					}),
					fetch(withBasePath(`data/boatrace-ex/derived/racer-evidence/${targetDate}.json`), {
						cache: "no-store",
					}),
					fetch(withBasePath("data/boatrace-ex/derived/venue-bias/latest.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/rough-index/latest.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/today-flow/latest.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/prediction-structure/latest.json"), { cache: "no-store" }),
				]);

				if (!derivedManifestResponse.ok) throw new Error(`derived manifest fetch failed: ${derivedManifestResponse.status}`);
				if (!venueResponse.ok) throw new Error(`venue evidence fetch failed: ${venueResponse.status}`);
				if (!racerResponse.ok) throw new Error(`racer evidence fetch failed: ${racerResponse.status}`);
				if (!venueBiasResponse.ok) throw new Error(`venue bias fetch failed: ${venueBiasResponse.status}`);
				if (!roughIndexResponse.ok) throw new Error(`rough index fetch failed: ${roughIndexResponse.status}`);
				if (!todayFlowResponse.ok) throw new Error(`today flow fetch failed: ${todayFlowResponse.status}`);
				if (!predictionStructureResponse.ok) throw new Error(`prediction structure fetch failed: ${predictionStructureResponse.status}`);

				const derivedManifest = await derivedManifestResponse.json() as BoatExManifest;
				const venueEvidence = await venueResponse.json() as BoatExVenueEvidenceFile;
				const racerEvidence = await racerResponse.json() as BoatExRacerEvidenceFile;
				const venueBias = await venueBiasResponse.json() as BoatExVenueBiasV1File;
				const roughIndex = await roughIndexResponse.json() as BoatExRoughIndexV1File;
				const todayFlow = await todayFlowResponse.json() as BoatExTodayFlowV1File;
				const predictionStructure = await predictionStructureResponse.json() as BoatExPredictionStructureV1File;

				if (isMounted) {
					setLoadState({
						status: "ready",
						manifest,
						derivedManifest,
						dateIndex,
					venueEvidence,
					racerEvidence,
					venueBias,
					roughIndex,
					todayFlow,
					predictionStructure,
						message: indexMissing ? "EX日付indexがありません。manifestの最新日付を使用します。" : "EXセクションを表示できます。",
					});
				}
			} catch {
				if (isMounted) {
					setLoadState({
						status: "missing",
						manifest: null,
						derivedManifest: null,
						dateIndex: null,
					venueEvidence: null,
					racerEvidence: null,
					venueBias: null,
					roughIndex: null,
					todayFlow: null,
					predictionStructure: null,
						message: "EXエビデンスがありません。",
					});
				}
			}
		}

		void loadEvidence();

		return () => {
			isMounted = false;
		};
	}, []);

	const latestHistory = useMemo(() => findLatestHistoryFile(loadState.manifest), [loadState.manifest]);
	const venueEvidence = loadState.venueEvidence;
	const racerEvidence = loadState.racerEvidence;
	const venueBias = loadState.venueBias;
	const roughIndex = loadState.roughIndex;
	const todayFlow = loadState.todayFlow;
	const predictionStructure = loadState.predictionStructure;
	const latestDate = loadState.dateIndex?.latestDate ?? venueEvidence?.date ?? racerEvidence?.date ?? latestHistory?.date ?? "なし";
	const dateIndexEntry = findDateIndexEntry(loadState.dateIndex, latestDate);
	const availableDateCount = loadState.dateIndex?.summary.dateCount ?? "日付indexなし";
	const availableDates = loadState.dateIndex?.availableDates.join(", ") || "日付indexなし";
	const records = venueEvidence?.summary.recordCount ?? "なし";
	const venues = venueEvidence?.summary.venueCount ?? "なし";
	const historyDays = venueEvidence?.summary.historyDays ?? racerEvidence?.summary.historyDays ?? "なし";
	const analysisStatus = venueEvidence?.summary.analysisStatus ?? racerEvidence?.summary.analysisStatus ?? "pending";
	const derivedManifestFiles = loadState.derivedManifest?.files?.length ?? "なし";
	const venueEvidenceAvailable = hasDerivedFile(loadState.derivedManifest, "/venue-evidence/");
	const racerEvidenceAvailable = hasDerivedFile(loadState.derivedManifest, "/racer-evidence/");
	const venueBiasAvailable = hasDerivedFile(loadState.derivedManifest, "/venue-bias/");
	const roughIndexAvailable = hasDerivedFile(loadState.derivedManifest, "/rough-index/");
	const todayFlowAvailable = hasDerivedFile(loadState.derivedManifest, "/today-flow/");
	const predictionStructureAvailable = hasDerivedFile(loadState.derivedManifest, "/prediction-structure/");

	function renderActiveSection() {
		switch (activeSection) {
			case "overview":
				return (
					<SectionShell title="概要" subtitle="全体サマリー">
						<section style={metricGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>最新日付</p>
								<p style={metricValueStyle}>{latestDate}</p>
								<p style={textStyle}>Phase 6Aの日付indexを優先し、ない場合はmanifestの最新日付を使用します。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>利用可能日数</p>
								<p style={metricValueStyle}>{availableDateCount}</p>
								<p style={textStyle}>{availableDates}</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>履歴レコード</p>
								<p style={metricValueStyle}>{records}</p>
								<p style={textStyle}>派生エビデンスに使用する履歴レースレコードです。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>会場数</p>
								<p style={metricValueStyle}>{venues}</p>
								<p style={textStyle}>会場エビデンスの件数です。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>選手数</p>
								<p style={metricValueStyle}>{racerEvidence?.summary.racerCount ?? "なし"}</p>
								<p style={textStyle}>選手エビデンスの件数です。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>出走回数</p>
								<p style={metricValueStyle}>{racerEvidence?.summary.appearanceCount ?? "なし"}</p>
								<p style={textStyle}>ソースに基づく選手の出走回数です。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>派生ファイル</p>
								<p style={metricValueStyle}>{derivedManifestFiles}</p>
								<p style={textStyle}>派生manifestのエントリー数です。</p>
							</article>
						</section>
						<section style={cardGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>注意事項</p>
								<ul style={noteListStyle}>
									<li>ソースに基づくエビデンスのみを表示します。</li>
									<li>架空の完了状態、スコア、推定ランキングは表示しません。</li>
									<li>会場傾向の準備状況: {statusLabel(venueBias?.readiness.status ?? analysisStatus)}。</li>
								</ul>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>Phase 6A 準備状況</p>
								<ul style={noteListStyle}>
									<li>複数日分析: {readinessLabel(dateIndexEntry, "multiDayAnalysis")}</li>
									<li>会場傾向: {readinessLabel(dateIndexEntry, "venueBias")}</li>
									<li>選手プロファイル: {readinessLabel(dateIndexEntry, "racerProfile")}</li>
									<li>予測シグナル: {readinessLabel(dateIndexEntry, "predictionSignals")}</li>
								</ul>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>日次パイプライン</p>
								<p style={valueStyle}>手動実行可能</p>
								<ul style={noteListStyle}>
									<li>日付index: {loadState.dateIndex ? "表示可能" : "EX日付indexなし"}</li>
									<li>最新日付: {latestDate}</li>
									<li>日数: {availableDateCount}</li>
									<li>次の工程: workflow統合は準備中</li>
								</ul>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>PCダッシュボード</p>
								<p style={valueStyle}>デスクトップ優先レイアウト</p>
								<p style={textStyle}>カード、表、セクションは広めのグリッドで表示し、EXページを高密度な分析ダッシュボードとして構成しています。</p>
							</article>
						</section>
					</SectionShell>
				);
			case "identity":
				return (
					<SectionShell title="選手・出走者データ" subtitle="選手情報">
						<section style={metricGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>選手数</p>
								<p style={metricValueStyle}>{racerEvidence?.summary.racerCount ?? "なし"}</p>
								<p style={textStyle}>登録番号がある場合は主キーとして使用します。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>出走回数</p>
								<p style={metricValueStyle}>{racerEvidence?.summary.appearanceCount ?? "なし"}</p>
								<p style={textStyle}>選手プロファイル、ST、展示のラベルは履歴不足のままです。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>進入変更</p>
								<p style={metricValueStyle}>ソースに基づく情報</p>
								<p style={textStyle}>最終進入の欠損は傾向として補わず、ソースなしとして表示します。</p>
							</article>
						</section>
						<RacerEvidenceSection racerEvidence={racerEvidence} />
					</SectionShell>
				);
			case "data-coverage":
				return (
					<SectionShell title="データ充足状況" subtitle="自動更新・出典">
						<section style={metricGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>履歴レコード</p>
								<p style={metricValueStyle}>{records}</p>
								<p style={textStyle}>Phase 3の履歴ソースです。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>日付index</p>
								<p style={metricValueStyle}>{loadState.dateIndex ? "表示可能" : "なし"}</p>
								<p style={textStyle}>最新日付 {latestDate} / 日数 {availableDateCount}</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>日次パイプライン</p>
								<p style={metricValueStyle}>手動</p>
								<p style={textStyle}>実行環境は準備済みです。workflow統合は準備中です。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>会場エビデンス</p>
								<p style={metricValueStyle}>{venueEvidenceAvailable ? "表示可能" : "なし"}</p>
								<p style={textStyle}>Phase 4の派生エビデンスです。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>選手エビデンス</p>
								<p style={metricValueStyle}>{racerEvidenceAvailable ? "表示可能" : "なし"}</p>
								<p style={textStyle}>Phase 5の派生エビデンスです。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>派生manifest</p>
								<p style={metricValueStyle}>{derivedManifestFiles}</p>
								<p style={textStyle}>会場、選手、会場傾向のエビデンスを含む想定です。</p>
							</article>
						</section>
						<section style={cardStyle}>
							<p style={labelStyle}>ソースファイル</p>
							<ul style={noteListStyle}>
								<li>日付index: {loadState.dateIndex ? "表示可能" : "EX日付indexなし"}</li>
								<li>荒れ指数: {roughIndexAvailable ? "表示可能" : "なし"}</li>
								<li>当日フロー: {todayFlowAvailable ? "表示可能" : "なし"}</li>
								<li>予測構造: {predictionStructureAvailable ? "表示可能" : "なし"}</li>
								{(loadState.derivedManifest?.sourceFiles ?? []).map((source) => (
									<li key={`${source.sourceName}-${source.sourcePath}`}>
										{source.sourceName}: {statusLabel(source.sourceStatus)} / {statusLabel(source.coverageStatus)}
									</li>
								))}
							</ul>
						</section>
					</SectionShell>
				);
			case "trend-lab":
				return (
					<SectionShell title="傾向分析ラボ" subtitle="計画データ">
						<PendingPanel
							status="pending"
							reason="スコア、傾向、シグナルの生成には複数日の履歴蓄積が必要です。"
							source="Phase 6: 複数日履歴、Phase 7: 会場傾向、Phase 8: 荒れ指数、Phase 9: 当日フロー、Phase 10: 予測シグナル。"
						/>
					</SectionShell>
				);
			case "trifecta-ranking":
				return (
					<SectionShell title="3連単ランキング" subtitle="3連単 v1">
						<PendingPanel
							status="pending"
							reason="複数日のofficialResult.trifectaと払戻の蓄積後に3連単ランキングを生成します。"
							source="計画中のソース: officialResult.trifecta / payout / raceKey。"
						/>
					</SectionShell>
				);
			case "rough-index":
				return (
					<SectionShell title="荒れ指数" subtitle="結果・払戻 v1">
						<PendingPanel
							status={roughIndex?.readiness.status ?? "insufficient-history"}
							reason={roughIndex?.readiness.reason ?? "荒れ指数エビデンスがありません。"}
							source="ソースに基づく履歴・結果・払戻の事実のみを表示します。合成された荒れ指数スコアは生成しません。"
						/>
						<RoughIndexSection roughIndex={roughIndex} />
					</SectionShell>
				);
			case "race-transition":
				return (
					<SectionShell title="レース推移" subtitle="推移 v1">
						<PendingPanel
							status="pending"
							reason="レース間の推移とイン・アウトの反復傾向は、後続の検証済みフェーズで扱います。"
						/>
					</SectionShell>
				);
			case "weather":
				return (
					<SectionShell title="天候・水面" subtitle="風・波の事実">
						<WeatherSection venueEvidence={venueEvidence} />
					</SectionShell>
				);
			case "venue-bias":
				return (
					<SectionShell title="会場傾向" subtitle="会場傾向 v1">
						<PendingPanel
							status={venueBias?.readiness.status ?? "insufficient-history"}
							reason={venueBias?.readiness.reason ?? "会場傾向エビデンスがありません。"}
							source="件数と比率は履歴に基づく事実です。スコア、ランキング、推奨は生成しません。"
						/>
						<VenueBiasSection venueBias={venueBias} />
					</SectionShell>
				);
			case "today-flow":
				return (
					<SectionShell title="当日フロー" subtitle="当日フロー v1">
						<PendingPanel
							status={todayFlow?.readiness.status ?? "insufficient-history"}
							reason={todayFlow?.readiness.reason ?? "当日フローエビデンスがありません。"}
							source="ソースに基づく当日・結果の事実のみを表示します。予測や合成フロースコアは生成しません。"
						/>
						<TodayFlowSection todayFlow={todayFlow} />
					</SectionShell>
				);
			case "prediction-structure":
				return (
					<SectionShell title="予測構造ラボ" subtitle="カバレッジマップ v1">
						<PendingPanel
							status={predictionStructure?.readiness.status ?? "insufficient-history"}
							reason={predictionStructure?.readiness.reason ?? "予測構造エビデンスがありません。"}
							source="ソースに基づく予測材料のカバレッジだけを表示します。投票推奨、予測、合成スコアは生成しません。"
						/>
						<PredictionStructureSection predictionStructure={predictionStructure} />
					</SectionShell>
				);
			case "ex-analysis":
				return (
					<SectionShell title="EX分析" subtitle="既存派生データの照合">
						<ExAnalysisHubSection
							venueBias={venueBias}
							roughIndex={roughIndex}
							todayFlow={todayFlow}
							predictionStructure={predictionStructure}
						/>
					</SectionShell>
				);
			default:
				return null;
		}
	}

	return (
		<PageShell
			eyebrow="BOATRACE EX DATA LABO"
			title="KURARI BOAT EX"
			description="BOATRACE EX データラボ / ソースに基づく分析"
			contentMaxWidth="1880px"
			contentPaddingInline="24px"
			heroMaxWidth="1880px"
		>
			<section style={dashboardRowStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>状態</p>
					<p style={valueStyle}>{loadState.message}</p>
					<p style={textStyle}>
						下のカードでEXページ内のセクションを切り替えます。URLハッシュの経路は変更しません。
					</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>日付</p>
					<p style={metricValueStyle}>{latestDate}</p>
					<p style={textStyle}>{loadState.dateIndex ? "最新index" : "manifestの代替値"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>日数</p>
					<p style={metricValueStyle}>{availableDateCount}</p>
					<p style={textStyle}>利用可能な日付</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>レコード</p>
					<p style={metricValueStyle}>{records}</p>
					<p style={textStyle}>ソースに基づく情報</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>選手数</p>
					<p style={metricValueStyle}>{racerEvidence?.summary.racerCount ?? "なし"}</p>
					<p style={textStyle}>選手識別エビデンス</p>
				</article>
			</section>

			<section style={sectionMenuStyle} aria-label="BOATRACE EX セクション">
				{sectionCards.map((section) => {
					const isActive = activeSection === section.key;
					return (
						<button
							key={section.key}
							type="button"
							onClick={() => setActiveSection(section.key)}
							style={{
								...menuCardStyle,
								borderColor: isActive ? boatTheme.colors.aquaDeep : boatTheme.colors.line,
								background: isActive ? "rgba(223, 245, 255, 0.98)" : "rgba(255, 255, 255, 0.96)",
								boxShadow: isActive ? "0 18px 44px rgba(24, 115, 152, 0.16)" : boatTheme.shadow.soft,
							}}
							aria-pressed={isActive}
						>
							<p style={labelStyle}>{statusLabel(section.status)}</p>
							<p style={menuTitleStyle}>{section.title}</p>
							<p style={menuSubtitleStyle}>{section.subtitle}</p>
						</button>
					);
				})}
			</section>

			{renderActiveSection()}
		</PageShell>
	);
}
