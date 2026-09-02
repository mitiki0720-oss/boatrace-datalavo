import { useEffect, useMemo, useState } from "react";
import { BoatExVenueFeatureNotes } from "../components/boatrace/ex/BoatExVenueFeatureNotes";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import type {
	BoatExDateIndexEntry,
	BoatExDateIndexFile,
	BoatExHistoricalSourceCoverageFile,
	BoatExNameIdentityBridgeAuditFile,
	BoatExRacerEvidenceRegistryLinkageAuditFile,
	BoatExRacerEvidenceFile,
	BoatExRacerEvidenceItem,
	BoatExRacerFeaturesFile,
	BoatExRacerIdentityUnresolvedAuditFile,
	BoatExCurrentDayPredictionCoverageFile,
	BoatExRegisteredRacerIdentityRegistryFile,
	BoatExRegisteredRegistrationQualityAuditFile,
	BoatExRegistrationProvenanceAuditFile,
	BoatExPredictionStructureV1File,
	BoatExStructuredTicketsDateFile,
	BoatExStructuredTicketsHistoryIndexFile,
	BoatExStructuredTicketsHistorySummaryFile,
	BoatExHistoricalRaceAnalysisDateFile,
	BoatExHistoricalRaceAnalysisIndexFile,
	BoatExHistoricalRaceAnalysisSummaryFile,
	BoatExRaceAnalysisFile,
	BoatExRaceAnalysisItem,
	BoatExRoughIndexV1File,
	BoatExTodayFlowV1File,
	BoatExTabCompletenessAuditFile,
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
	| "race-analysis"
	| "ex-analysis";

type BoatExManifestFile = {
	path?: string;
	kind?: string;
	date?: string;
	generatedAt?: string;
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

type BoatExWeatherWaterHistoryVenue = {
	venueCode: string;
	venueName: string;
	dateCount: number;
	raceCount: number;
	weatherAvailableRaceCount: number;
	weatherCoverageRate: number;
	windSpeedAverageMps: number | null;
	windSpeedMaxMps: number | null;
	waveHeightAverageCm: number | null;
	waveHeightMaxCm: number | null;
	weatherConditionCounts: Record<string, number>;
	windDirectionCounts: Record<string, number>;
	windSpeedBandCounts: Record<string, number>;
	waveHeightBandCounts: Record<string, number>;
	conditionProfiles: {
		weather: Array<{ key: string; raceCount: number; readiness: string }>;
		windDirection: Array<{ key: string; raceCount: number; readiness: string }>;
		windSpeedBand: Array<{ key: string; raceCount: number; readiness: string }>;
		waveHeightBand: Array<{ key: string; raceCount: number; readiness: string }>;
	};
	readiness: { status: string };
};

type BoatExWeatherWaterHistoryFile = {
	dateRange: { from: string; to: string; dateCount: number };
	summary: { raceCount: number; venueCount: number; weatherAvailableRaceCount: number };
	venues: BoatExWeatherWaterHistoryVenue[];
};

type LoadState = {
	status: "loading" | "ready" | "missing";
	manifest: BoatExManifest | null;
	derivedManifest: BoatExManifest | null;
	dateIndex: BoatExDateIndexFile | null;
	venueEvidence: BoatExVenueEvidenceFile | null;
	weatherWaterHistory: BoatExWeatherWaterHistoryFile | null;
	racerEvidence: BoatExRacerEvidenceFile | null;
	racerFeatures: BoatExRacerFeaturesFile | null;
	racerIdentityUnresolvedAudit: BoatExRacerIdentityUnresolvedAuditFile | null;
	currentDayPredictionCoverage: BoatExCurrentDayPredictionCoverageFile | null;
	venueBias: BoatExVenueBiasV1File | null;
	roughIndex: BoatExRoughIndexV1File | null;
	todayFlow: BoatExTodayFlowV1File | null;
	predictionStructure: BoatExPredictionStructureV1File | null;
	structuredTicketsHistorySummary: BoatExStructuredTicketsHistorySummaryFile | null;
	structuredTicketsHistoryIndex: BoatExStructuredTicketsHistoryIndexFile | null;
	raceAnalysis: BoatExRaceAnalysisFile | null;
	historicalRaceAnalysisSummary: BoatExHistoricalRaceAnalysisSummaryFile | null;
	historicalRaceAnalysisIndex: BoatExHistoricalRaceAnalysisIndexFile | null;
	historicalSourceCoverage: BoatExHistoricalSourceCoverageFile | null;
	registeredIdentityRegistry: BoatExRegisteredRacerIdentityRegistryFile | null;
	registryLinkageAudit: BoatExRacerEvidenceRegistryLinkageAuditFile | null;
	registrationQualityAudit: BoatExRegisteredRegistrationQualityAuditFile | null;
	registrationProvenanceAudit: BoatExRegistrationProvenanceAuditFile | null;
	nameIdentityBridgeAudit: BoatExNameIdentityBridgeAuditFile | null;
	tabCompletenessAudit: BoatExTabCompletenessAuditFile | null;
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
	{ key: "trend-lab", title: "傾向分析ラボ", subtitle: "結果・払戻カバレッジ", status: "available" },
	{ key: "trifecta-ranking", title: "3連単ランキング", subtitle: "結果・払戻カバレッジ", status: "available" },
	{ key: "rough-index", title: "荒れ指数", subtitle: "結果・払戻 v1", status: "ready" },
	{ key: "race-transition", title: "レース推移", subtitle: "当日結果フロー", status: "available" },
	{ key: "weather", title: "天候・水面", subtitle: "風・波の事実", status: "available" },
	{ key: "venue-bias", title: "会場傾向", subtitle: "会場傾向 v1", status: "available" },
	{ key: "today-flow", title: "当日フロー", subtitle: "当日フロー v1", status: "available" },
	{ key: "prediction-structure", title: "予測構造ラボ", subtitle: "カバレッジマップ v1", status: "insufficient-history" },
	{ key: "race-analysis", title: "全レース分析", subtitle: "最新日・履歴全体の全レース詳細", status: "ready" },
	{ key: "ex-analysis", title: "EX分析", subtitle: "会場・選手の照合", status: "available" },
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
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
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
		verified: "公式登録番号あり",
		"name-linked": "名前完全一致・一意リンク",
		unverified: "登録番号未解決",
		ambiguous: "曖昧候補を除外",
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

function jstDateString(now = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);
}

type BoatExMaterialStatus = {
	label: string;
	latestDate: string;
	dateCount: number | string;
	count: number | string;
	status: string;
	sourceType: string;
	updatedAt: string;
};

function materialStatusFromManifest(
	manifest: BoatExManifest | null,
	label: string,
	pathFragment: string,
): BoatExMaterialStatus {
	const files = (manifest?.files ?? []).filter((file) => file.path?.includes(pathFragment));
	const dates = [...new Set(files.map((file) => file.date).filter((date): date is string => Boolean(date)))].sort();
	const latest = [...files].sort((left, right) => String(right.date ?? "").localeCompare(String(left.date ?? "")))[0];
	return {
		label,
		latestDate: latest?.date ?? "未取得",
		dateCount: dates.length || "未取得",
		count: latest?.recordCount ?? latest?.racerCount ?? "未取得",
		status: latest?.coverageStatus ?? latest?.sourceStatus ?? "未取得",
		sourceType: latest?.sourceStatus ?? "source-backed",
		updatedAt: latest?.generatedAt ?? manifest?.generatedAt ?? "未取得",
	};
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

async function fetchOptionalJson<T>(path: string): Promise<T | null> {
	const response = await fetch(withBasePath(path), { cache: "no-store" });
	return response.ok ? await response.json() as T : null;
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

function RegistryLinkageDetails({ racer }: { racer: BoatExRacerEvidenceItem }) {
	if (!racer.registrationNumber && racer.resolvedRegistrationNo && racer.identityLinkMethod === "exact-normalized-name-unique") {
		return (
			<>
				<strong>名前完全一致・一意の補助リンク</strong>
				<br />
				<span>公式登録番号: 未収録（変更しません）</span>
				<br />
				<span>参照登録番号: {racer.resolvedRegistrationNo}</span>
				<br />
				<span>照合方法: exact-normalized-name-unique</span>
				<br />
				<span>ソース: {racer.identityRegistrySource}</span>
			</>
		);
	}

	if (!racer.registrationNumber) {
		return <span>登録番号未解決: 名前だけでは紐づけません</span>;
	}

	if (!racer.identityRegistryMatched) {
		return <span>登録番号あり / レジストリ未リンク</span>;
	}

	return (
		<>
			<strong>登録番号完全一致リンク</strong>
			<br />
			<span>キー: {racer.identityRegistryKey}</span>
			<br />
			<span>ソース: {racer.identityRegistrySource}</span>
			<br />
			<span>正式名: {racer.canonicalRacerName}</span>
			<br />
			<span>履歴: {racer.registryAppearanceCount}件 / {racer.registryFirstSeenDate} - {racer.registryLastSeenDate}</span>
			<br />
			<span>会場: {racer.registryVenueCount} / 出典: {racer.registryProvenanceCount}</span>
		</>
	);
}

function RegisteredIdentityRegistrySection({
	registry,
	linkageAudit,
	qualityAudit,
	provenanceAudit,
	nameIdentityBridgeAudit,
}: {
	registry: BoatExRegisteredRacerIdentityRegistryFile | null;
	linkageAudit: BoatExRacerEvidenceRegistryLinkageAuditFile | null;
	qualityAudit: BoatExRegisteredRegistrationQualityAuditFile | null;
	provenanceAudit: BoatExRegistrationProvenanceAuditFile | null;
	nameIdentityBridgeAudit: BoatExNameIdentityBridgeAuditFile | null;
}) {
	const summary = registry?.summary;
	const linkage = linkageAudit?.counts;
	const quality = qualityAudit?.summary;
	const provenance = provenanceAudit?.after;
	const nameBridge = nameIdentityBridgeAudit?.counts;

	return (
		<section style={{ ...cardStyle, gap: "14px" }}>
			<div>
				<p style={labelStyle}>登録番号identityレジストリ</p>
				<p style={valueStyle}>登録番号の完全一致で参照する選手identity</p>
				<p style={textStyle}>名前だけの統合、推測補完、未解決行のlookupは行いません。</p>
			</div>
			<section style={metricGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>安全なidentity</p>
					<p style={metricValueStyle}>{summary?.identityCount ?? "未読込"}</p>
					<p style={textStyle}>登録番号を主キーにしたidentity数</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>登録番号あり出走</p>
					<p style={metricValueStyle}>{quality?.registeredAppearanceCount ?? summary?.sourceAppearanceCount ?? "未読込"}</p>
					<p style={textStyle}>公式出典が完備された対象</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>選手エビデンスリンク</p>
					<p style={metricValueStyle}>{linkage?.linked ?? "未読込"}</p>
					<p style={textStyle}>レジストリ未リンク {linkage?.unlinkedRegistered ?? "未読込"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>登録番号未解決</p>
					<p style={metricValueStyle}>{linkage?.unresolvedExcluded ?? summary?.unresolvedExcludedCount ?? "未読込"}</p>
					<p style={textStyle}>安全なレジストリには入れず、名前だけでは紐づけない</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>名前完全一致・一意リンク</p>
					<p style={metricValueStyle}>{nameBridge?.exactUniqueNameLinked ?? linkage?.nameLinked ?? "未読込"}</p>
					<p style={textStyle}>公式登録番号を変えず、補助フィールドだけを追加</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>曖昧名を除外</p>
					<p style={metricValueStyle}>{nameBridge?.ambiguousSkipped ?? linkage?.ambiguousNameSkipped ?? "未読込"}</p>
					<p style={textStyle}>候補が複数の名前はリンクしない</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>衝突 / alias候補</p>
					<p style={metricValueStyle}>{quality?.collisionCount ?? summary?.collisionCount ?? "未読込"} / {quality?.aliasCandidateCount ?? summary?.aliasCandidateCount ?? "未読込"}</p>
					<p style={textStyle}>衝突、別名候補は安全な対象として扱わない</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>出典の完全性</p>
					<p style={metricValueStyle}>{provenance?.provenanceCompleteCount ?? quality?.provenanceCompleteCount ?? "未読込"} / {provenance?.provenanceMissingCount ?? quality?.provenanceMissingCount ?? "未読込"}</p>
					<p style={textStyle}>完備 / 欠損</p>
				</article>
			</section>
			<section style={twoColumnGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>対象範囲</p>
					<p style={textStyle}>初回確認: {summary?.firstSeenDate ?? "未読込"}</p>
					<p style={textStyle}>最終確認: {summary?.lastSeenDate ?? "未読込"}</p>
					<p style={textStyle}>レジストリ欠損: {linkage?.registryMissing ?? "未読込"} / 衝突: {linkage?.collision ?? "未読込"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>出典 / 監査</p>
					<ul style={noteListStyle}>
						<li><code>/data/boatrace-ex/identity/registered-racers.generated.json</code></li>
						<li><code>/data/boatrace-ex/audit/registered-racer-identity-registry-{registry?.summary.lastSeenDate ?? "latest"}.generated.json</code></li>
						<li><code>/data/boatrace-ex/audit/racer-evidence-registry-linkage-{linkageAudit?.auditDate ?? "latest"}.generated.json</code></li>
						<li><code>/data/boatrace-ex/audit/registered-registration-quality-{qualityAudit?.auditDate ?? "latest"}.generated.json</code></li>
						<li><code>/data/boatrace-ex/audit/registration-provenance-{provenanceAudit?.auditDate ?? "latest"}.generated.json</code></li>
						<li><code>/data/boatrace-ex/audit/name-identity-bridge-{nameIdentityBridgeAudit?.auditDate ?? "latest"}.generated.json</code></li>
					</ul>
				</article>
			</section>
		</section>
	);
}

function RacerEvidenceSection({ racerEvidence }: { racerEvidence: BoatExRacerEvidenceFile | null }) {
	if (!racerEvidence) return <p style={textStyle}>EX選手エビデンスがありません。固定値は使用しません。</p>;
	const topRacers = racerEvidence.racers.slice(0, 50);

	return (
		<>
			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1680px" }}>
					<thead>
						<tr>
							<th style={thStyle}>選手</th>
							<th style={thStyle}>登録番号</th>
							<th style={thStyle}>登録identity link</th>
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
								<td style={tdStyle}><RegistryLinkageDetails racer={racer} /></td>
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
						<div style={textStyle}><RegistryLinkageDetails racer={racer} /></div>
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

function RacerFeaturesSection({
	features,
	audit,
}: {
	features: BoatExRacerFeaturesFile | null;
	audit: BoatExRacerIdentityUnresolvedAuditFile | null;
}) {
	const summary = features?.summary;
	const currentDay = audit?.currentDay;
	const unresolved = audit?.unresolved;

	return (
		<section style={{ ...cardStyle, gap: "14px" }}>
			<div>
				<p style={labelStyle}>選手特徴量</p>
				<p style={valueStyle}>登録番号完全一致の履歴参照</p>
				<p style={textStyle}>履歴、当地、枠番、ST、決まり手、条件別、直近出走を表示します。名前だけでは接続せず、推測補完もしません。</p>
			</div>
			<section style={metricGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>特徴量選手数</p>
					<p style={metricValueStyle}>{summary?.racerCount ?? "未読込"}</p>
					<p style={textStyle}>登録番号完全一致の安全な対象</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>履歴出走</p>
					<p style={metricValueStyle}>{summary?.historyStartCount ?? "未読込"}</p>
					<p style={textStyle}>特徴量に利用したsource-backed出走</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>少標本</p>
					<p style={metricValueStyle}>{summary?.lowSampleRacerCount ?? "未読込"}</p>
					<p style={textStyle}>標本量が小さい選手は低標本として明示</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>当日完全一致リンク</p>
					<p style={metricValueStyle}>{currentDay?.exactRegistryLinkedCount ?? "未読込"}</p>
					<p style={textStyle}>当日枠 {currentDay?.slotCount ?? "未読込"} / 登録番号欠損 {currentDay?.registrationMissingCount ?? "未読込"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>履歴の未解決出走</p>
					<p style={metricValueStyle}>{unresolved?.appearanceCount ?? "未読込"}</p>
					<p style={textStyle}>安全な特徴量には含めず、監査だけに保持</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>履歴期間</p>
					<p style={metricValueStyle}>{summary?.dateRange.dateCount ?? "未読込"}日</p>
					<p style={textStyle}>{summary?.dateRange.first ?? "未読込"} ～ {summary?.dateRange.last ?? "未読込"}</p>
				</article>
			</section>
			<p style={textStyle}>出典: <code>/data/boatrace-ex/derived/racer-features/latest.json</code> / <code>/data/boatrace-ex/audit/racer-identity-unresolved-audit-latest.generated.json</code></p>
		</section>
	);
}

function CurrentDayPredictionCoverageSection({ coverage }: { coverage: BoatExCurrentDayPredictionCoverageFile | null }) {
	if (!coverage) return <p style={textStyle}>当日予想用coverageは未読込です。履歴EXとは別の通常素材を確認してください。</p>;
	const weatherLabel = `${coverage.weatherAvailableRaceCount}/${coverage.raceCount}R`;
	const windLabel = `${coverage.windAvailableRaceCount}/${coverage.raceCount}R`;
	const waveLabel = `${coverage.waveAvailableRaceCount}/${coverage.raceCount}R`;

	return (
		<section style={{ ...cardStyle, gap: "14px" }}>
			<div>
				<p style={labelStyle}>当日予想用coverage</p>
				<p style={valueStyle}>通常素材の当日完全性</p>
				<p style={textStyle}>履歴EXの結果・払戻分析とは別に、出走表、登録番号、展示、気象、モーター、ボートの当日状態を表示します。</p>
			</div>
			<section style={metricGridStyle}>
				<article style={cardStyle}><p style={labelStyle}>対象日</p><p style={metricValueStyle}>{coverage.targetDate}</p><p style={textStyle}>会場 {coverage.venueCount} / レース {coverage.raceCount}</p></article>
				<article style={cardStyle}><p style={labelStyle}>出走表</p><p style={metricValueStyle}>{coverage.entriesCompleteRaceCount}/{coverage.raceCount}R</p><p style={textStyle}>6艇が揃ったレース数</p></article>
				<article style={cardStyle}><p style={labelStyle}>登録番号</p><p style={metricValueStyle}>{coverage.registrationPresentCount}/{coverage.slotCount}</p><p style={textStyle}>exactリンク {coverage.exactRegistryLinkedCount}/{coverage.slotCount}</p></article>
				<article style={cardStyle}><p style={labelStyle}>展示タイム</p><p style={metricValueStyle}>{coverage.exhibitionDisplayTimeCompleteRaceCount}/{coverage.raceCount}R</p><p style={textStyle}>一部 {coverage.exhibitionDisplayTimePartialRaceCount} / 未取得 {coverage.exhibitionDisplayTimeMissingRaceCount}</p></article>
				<article style={cardStyle}><p style={labelStyle}>天候 / 風 / 波</p><p style={metricValueStyle}>{weatherLabel}</p><p style={textStyle}>風 {windLabel} / 波 {waveLabel}</p></article>
				<article style={cardStyle}><p style={labelStyle}>モーター / ボート</p><p style={metricValueStyle}>{coverage.motorAvailableSlotCount}/{coverage.slotCount}</p><p style={textStyle}>ボート {coverage.boatAvailableSlotCount}/{coverage.slotCount}</p></article>
				<article style={cardStyle}><p style={labelStyle}>結果 / 払戻</p><p style={metricValueStyle}>{coverage.resultStatus}</p><p style={textStyle}>結果 {coverage.resultAvailableRaceCount} / 払戻 {coverage.payoutAvailableRaceCount}</p></article>
				<article style={cardStyle}><p style={labelStyle}>当日lifecycle</p><p style={metricValueStyle}>レース前 {coverage.preRaceCount}</p><p style={textStyle}>展示済み {coverage.exhibitionReadyCount} / 一部 {coverage.exhibitionPartialCount}</p></article>
				<article style={cardStyle}><p style={labelStyle}>結果系lifecycle</p><p style={metricValueStyle}>結果+払戻 {coverage.resultAndPayoutCount}</p><p style={textStyle}>結果のみ {coverage.resultOnlyCount} / 部分 {coverage.partialResultCount}</p></article>
				<article style={cardStyle}><p style={labelStyle}>race-analysis</p><p style={metricValueStyle}>{coverage.raceAnalysisAvailableRaceCount}/{coverage.raceCount}R</p><p style={textStyle}>未生成 {coverage.raceAnalysisMissingRaceCount} / 不整合 {coverage.inconsistentStatusCount}</p></article>
			</section>
			<p style={textStyle}>当日EX race-analysis / today-flow は結果・払戻が確定後に生成します。レース前に未取得でも、このcoverageは利用可能です。</p>
			<p style={textStyle}>出典: <code>/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json</code></p>
		</section>
	);
}

function DailyWeatherSection({ venueEvidence }: { venueEvidence: BoatExVenueEvidenceFile | null }) {
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

function WeatherHistorySection({ weatherWaterHistory }: { weatherWaterHistory: BoatExWeatherWaterHistoryFile | null }) {
	if (!weatherWaterHistory) return <p style={textStyle}>履歴天候・水面エビデンスがありません。固定値は使用しません。</p>;
	const { dateRange, summary, venues } = weatherWaterHistory;
	return (
		<>
			<section style={metricGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>履歴対象期間</p>
					<p style={valueStyle}>{dateRange.from} から {dateRange.to}</p>
					<p style={textStyle}>{dateRange.dateCount}日分の `history/races` を再集計しています。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>履歴レース / 会場</p>
					<p style={metricValueStyle}>{summary.raceCount} / {summary.venueCount}</p>
					<p style={textStyle}>天候あり {summary.weatherAvailableRaceCount}R。日次venue evidenceではありません。</p>
				</article>
			</section>
			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1540px" }}>
					<thead><tr>
						<th style={thStyle}>会場</th><th style={thStyle}>日数 / レース</th><th style={thStyle}>天候coverage</th>
						<th style={thStyle}>平均 / 最大風速</th><th style={thStyle}>平均 / 最大波高</th><th style={thStyle}>風速帯</th>
						<th style={thStyle}>波高帯</th><th style={thStyle}>天候 / 風向</th><th style={thStyle}>状態</th>
					</tr></thead>
					<tbody>{venues.map((venue) => (
						<tr key={`weather-history-${venue.venueCode}`}>
							<td style={tdStyle}>{venue.venueName}</td>
							<td style={tdStyle}>{venue.dateCount}日 / {venue.raceCount}R</td>
							<td style={tdStyle}>{venue.weatherAvailableRaceCount}/{venue.raceCount}R</td>
							<td style={tdStyle}>{numberLabel(venue.windSpeedAverageMps, 2)} / {numberLabel(venue.windSpeedMaxMps, 2)} m/s</td>
							<td style={tdStyle}>{numberLabel(venue.waveHeightAverageCm, 2)} / {numberLabel(venue.waveHeightMaxCm, 2)} cm</td>
							<td style={tdStyle}>{Object.entries(venue.windSpeedBandCounts).map(([band, count]) => `${band}:${count}`).join(" / ")}</td>
							<td style={tdStyle}>{Object.entries(venue.waveHeightBandCounts).map(([band, count]) => `${band}:${count}`).join(" / ")}</td>
							<td style={tdStyle}>{Object.entries(venue.weatherConditionCounts).map(([name, count]) => `${name}:${count}`).join(" / ") || "未取得"}<br />{Object.entries(venue.windDirectionCounts).map(([name, count]) => `${name}:${count}`).join(" / ") || "未取得"}</td>
							<td style={tdStyle}>{statusLabel(venue.readiness.status)}</td>
						</tr>
					))}</tbody>
				</table>
			</div>
			<section style={metricGridStyle}>
				{(["weather", "windDirection", "windSpeedBand", "waveHeightBand"] as const).map((dimension) => (
					<article key={dimension} style={cardStyle}>
						<p style={labelStyle}>{dimension === "weather" ? "天候別" : dimension === "windDirection" ? "風向別" : dimension === "windSpeedBand" ? "風速帯別" : "波高帯別"}</p>
						<p style={textStyle}>{weatherWaterHistory.venues.flatMap((venue) => venue.conditionProfiles?.[dimension] ?? []).slice(0, 12).map((item) => `${item.key}:${item.raceCount}R (${item.readiness})`).join(" / ") || "未取得"}</p>
					</article>
				))}
			</section>
		</>
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

function analysisStatusLabel(status: string) {
	if (status === "available" || status === "complete") return "取得済み";
	if (status === "not-supported") return "対象外";
	if (status === "missing") return "未取得";
	return statusLabel(status);
}

function LatestRaceAnalysisSection({ raceAnalysis }: { raceAnalysis: BoatExRaceAnalysisFile | null }) {
	const [selectedRaceKey, setSelectedRaceKey] = useState<string | null>(null);
	if (!raceAnalysis) return <p style={textStyle}>全レース分析エビデンスを読み込めません。</p>;
	const selectedRace = raceAnalysis.races.find((race) => race.raceKey === selectedRaceKey) ?? raceAnalysis.races[0] ?? null;
	if (!selectedRace) return <p style={textStyle}>最新日のレース記録がありません。</p>;
	const summary = raceAnalysis.summary;
	return (
		<>
			<section style={metricGridStyle}>
				<article style={cardStyle}><p style={labelStyle}>対象日 / レース数</p><p style={metricValueStyle}>{summary.targetDate} / {summary.latestRaceCount}R</p><p style={textStyle}>最新日historyの全レースを表示対象にします。</p></article>
				<article style={cardStyle}><p style={labelStyle}>結果 / 払戻</p><p style={metricValueStyle}>{summary.resultAvailableRaceCount} / {summary.payoutAvailableRaceCount}</p><p style={textStyle}>公式結果と3連単払戻の取得済み件数です。</p></article>
				<article style={cardStyle}><p style={labelStyle}>展示 / 天候</p><p style={metricValueStyle}>{summary.exhibitionAvailableRaceCount} / {summary.weatherAvailableRaceCount}</p><p style={textStyle}>展示と天候・風・波の取得済み件数です。</p></article>
				<article style={cardStyle}><p style={labelStyle}>選手リンク</p><p style={metricValueStyle}>{summary.officialRegistrationLinkedCount} / {summary.nameLinkedCount}</p><p style={textStyle}>公式登録番号 / 完全一致補助リンク。未解決 {summary.unresolvedRacerCount}。</p></article>
			</section>
			<section style={{ ...cardStyle, gap: "12px" }}>
				<p style={labelStyle}>最新日 全レース</p>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", maxHeight: "520px", overflowY: "auto" }}>
					{raceAnalysis.races.map((race) => {
						const isSelected = selectedRace.raceKey === race.raceKey;
						return <button key={race.raceKey} type="button" onClick={() => setSelectedRaceKey(race.raceKey)} style={{ textAlign: "left", border: `1px solid ${isSelected ? boatTheme.colors.aquaDeep : boatTheme.colors.line}`, borderRadius: "6px", padding: "10px", background: isSelected ? "rgba(223, 245, 255, 0.98)" : "#fff", cursor: "pointer" }}>
							<strong>{race.venueName} {race.raceNo}R</strong>
							<span style={{ display: "block", fontSize: "12px", color: boatTheme.colors.muted, marginTop: "4px" }}>締切 {race.closingTime ?? "未取得"} / 結果 {analysisStatusLabel(race.resultStatus)}</span>
							<span style={{ display: "block", fontSize: "12px", color: boatTheme.colors.muted, marginTop: "2px" }}>払戻 {analysisStatusLabel(race.payoutStatus)} / 展示 {analysisStatusLabel(race.exhibitionStatus)} / 天候 {analysisStatusLabel(race.weatherStatus)}</span>
							<span style={{ display: "block", fontSize: "12px", color: boatTheme.colors.muted, marginTop: "2px" }}>公式 {race.racerLinkageSummary.officialRegistrationLinkedCount} / 名前 {race.racerLinkageSummary.nameLinkedCount} / 未解決 {race.racerLinkageSummary.unresolvedCount}</span>
						</button>;
					})}
				</div>
			</section>
			<section style={twoColumnGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>選択レース</p>
					<p style={valueStyle}>{selectedRace.venueName} {selectedRace.raceNo}R {selectedRace.raceTitle ?? ""}</p>
					<p style={textStyle}>締切: {selectedRace.closingTime ?? "未取得"} / 開催区分: {selectedRace.dayPart ?? "未取得"} / 公式レース: {analysisStatusLabel(selectedRace.sourceStatus)}</p>
					<p style={textStyle}>結果: {selectedRace.officialResult.finishOrder.length ? selectedRace.officialResult.finishOrder.join("-") : "未取得"} / 3連単: {selectedRace.officialResult.trifecta ?? "未取得"} / 払戻: {selectedRace.officialResult.trifectaPayoutYen?.toLocaleString("ja-JP") ?? "未取得"}{selectedRace.officialResult.trifectaPayoutYen !== null ? "円" : ""}</p>
					<p style={textStyle}>天候: {selectedRace.weather ? `${selectedRace.weather.weather ?? "未取得"} / 風 ${selectedRace.weather.windDirection ?? "未取得"} ${selectedRace.weather.windSpeed ?? ""} / 波 ${selectedRace.weather.waveHeight ?? "未取得"} / 水温 ${selectedRace.weather.waterTemperature ?? "未取得"}` : "未取得"}</p>
					<p style={textStyle}>展示: {selectedRace.exhibition.length > 0 ? selectedRace.exhibition.map((entry) => `${entry.lane}号艇 ${entry.exhibitionTime ?? "--"} / ST ${entry.startTiming ?? "--"}`).join(" | ") : "未取得"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>分析可能性と不足理由</p>
					<ul style={noteListStyle}>{selectedRace.analysisNotes.map((note) => <li key={note}>{note}</li>)}</ul>
					<p style={textStyle}>結果 {analysisStatusLabel(selectedRace.resultStatus)} / 払戻 {analysisStatusLabel(selectedRace.payoutStatus)} / 展示 {analysisStatusLabel(selectedRace.exhibitionStatus)} / 天候 {analysisStatusLabel(selectedRace.weatherStatus)} / 水面 {analysisStatusLabel(selectedRace.waterStatus)}</p>
					<p style={textStyle}>選手リンク: 公式 {selectedRace.racerLinkageSummary.officialRegistrationLinkedCount}、名前完全一致 {selectedRace.racerLinkageSummary.nameLinkedCount}、未解決 {selectedRace.racerLinkageSummary.unresolvedCount}</p>
				</article>
			</section>
			<section style={{ ...cardStyle, gap: "10px" }}>
				<p style={labelStyle}>出走選手</p>
				<div style={tableWrapStyle}><table style={{ ...tableStyle, minWidth: "900px" }}><thead><tr><th style={thStyle}>艇番</th><th style={thStyle}>選手</th><th style={thStyle}>公式登録番号</th><th style={thStyle}>完全一致参照番号</th><th style={thStyle}>リンク状態</th><th style={thStyle}>支部 / 級別</th><th style={thStyle}>モーター / ボート</th></tr></thead><tbody>{selectedRace.racers.map((racer) => <tr key={`${selectedRace.raceKey}-${racer.lane}`}><td style={tdStyle}>{racer.lane ?? "--"}</td><td style={tdStyle}>{racer.racerName || "未取得"}</td><td style={tdStyle}>{racer.officialRegistrationNo ?? "なし"}</td><td style={tdStyle}>{racer.resolvedRegistrationNo ?? "なし"}</td><td style={tdStyle}>{racer.linkageStatus === "official-registration" ? "公式登録番号" : racer.linkageStatus === "exact-name-linked" ? "名前完全一致" : "未解決"}</td><td style={tdStyle}>{racer.branch ?? "未取得"} / {racer.className ?? "未取得"}</td><td style={tdStyle}>{racer.motorNo ?? "--"} / {racer.boatNo ?? "--"}</td></tr>)}</tbody></table></div>
			</section>
			<section style={cardStyle}><p style={labelStyle}>source path / audit path</p><ul style={noteListStyle}>{Object.entries(selectedRace.sourcePaths).map(([label, sourcePath]) => <li key={label}>{label}: <code>{sourcePath}</code></li>)}</ul></section>
		</>
	);
}

function HistoricalRaceAnalysisSection({ summary, historyIndex }: { summary: BoatExHistoricalRaceAnalysisSummaryFile | null; historyIndex: BoatExHistoricalRaceAnalysisIndexFile | null }) {
	const [selectedDate, setSelectedDate] = useState("");
	const [selectedVenueCode, setSelectedVenueCode] = useState("all");
	const [selectedRaceNo, setSelectedRaceNo] = useState("all");
	const [selectedRaceKey, setSelectedRaceKey] = useState<string | null>(null);
	const [dateFile, setDateFile] = useState<BoatExHistoricalRaceAnalysisDateFile | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		if (historyIndex?.latestDate && !historyIndex.dates.some((entry) => entry.date === selectedDate)) setSelectedDate(historyIndex.latestDate);
	}, [historyIndex, selectedDate]);

	useEffect(() => {
		const entry = historyIndex?.dates.find((candidate) => candidate.date === selectedDate);
		if (!entry) return;
		let cancelled = false;
		setDateFile(null);
		setLoadError(null);
		setSelectedVenueCode("all");
		setSelectedRaceNo("all");
		setSelectedRaceKey(null);
		void fetch(withBasePath(entry.path.replace(/^public\//, "")), { cache: "no-store" })
			.then(async (response) => {
				if (!response.ok) throw new Error(`history shard fetch failed: ${response.status}`);
				return await response.json() as BoatExHistoricalRaceAnalysisDateFile;
			})
			.then((payload) => { if (!cancelled) setDateFile(payload); })
			.catch(() => { if (!cancelled) setLoadError("履歴レース分析を読み込めません。"); });
		return () => { cancelled = true; };
	}, [historyIndex, selectedDate]);

	if (!summary || !historyIndex) return <p style={textStyle}>履歴全レース分析の summary または index がありません。</p>;
	const venues = [...new Map((dateFile?.races ?? []).map((race) => [race.venueCode, race.venueName])).entries()];
	const filteredRaces = (dateFile?.races ?? []).filter((race) => (selectedVenueCode === "all" || race.venueCode === selectedVenueCode) && (selectedRaceNo === "all" || String(race.raceNo) === selectedRaceNo));
	const selectedRace = filteredRaces.find((race) => race.raceKey === selectedRaceKey) ?? filteredRaces[0] ?? null;
	return (
		<>
			<section style={metricGridStyle}>
				<article style={cardStyle}><p style={labelStyle}>履歴期間 / 日数</p><p style={metricValueStyle}>{summary.dateRange.firstDate} ～ {summary.dateRange.latestDate}</p><p style={textStyle}>{summary.dateRange.dateCount} 日を日付 shard として保持します。</p></article>
				<article style={cardStyle}><p style={labelStyle}>履歴全レース</p><p style={metricValueStyle}>{summary.summary.raceCount}R</p><p style={textStyle}>選択日だけを読み込み、全履歴を一度に描画しません。</p></article>
				<article style={cardStyle}><p style={labelStyle}>結果 / 払戻</p><p style={metricValueStyle}>{summary.summary.resultAvailableRaceCount} / {summary.summary.payoutAvailableRaceCount}</p><p style={textStyle}>公式結果・3連単払戻の source-backed 件数です。</p></article>
				<article style={cardStyle}><p style={labelStyle}>選手リンク</p><p style={metricValueStyle}>{summary.summary.officialRegistrationLinkedCount} / {summary.summary.nameLinkedCount}</p><p style={textStyle}>公式登録番号 / exact-name link。未解決 {summary.summary.unresolvedRacerCount}。</p></article>
			</section>
			<section style={{ ...cardStyle, gap: "12px" }}>
				<p style={labelStyle}>履歴フィルター</p>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
					<label style={textStyle}>日付<select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} style={{ display: "block", width: "100%", marginTop: "4px" }}>{historyIndex.dates.map((entry) => <option key={entry.date} value={entry.date}>{entry.date} ({entry.raceCount}R / {entry.venueCount}会場)</option>)}</select></label>
					<label style={textStyle}>会場<select value={selectedVenueCode} onChange={(event) => setSelectedVenueCode(event.target.value)} disabled={!dateFile} style={{ display: "block", width: "100%", marginTop: "4px" }}><option value="all">全会場</option>{venues.map(([venueCode, venueName]) => <option key={venueCode} value={venueCode}>{venueName} ({venueCode})</option>)}</select></label>
					<label style={textStyle}>R<select value={selectedRaceNo} onChange={(event) => setSelectedRaceNo(event.target.value)} disabled={!dateFile} style={{ display: "block", width: "100%", marginTop: "4px" }}><option value="all">全R</option>{[...new Set((dateFile?.races ?? []).filter((race) => selectedVenueCode === "all" || race.venueCode === selectedVenueCode).map((race) => race.raceNo))].sort((left, right) => left - right).map((raceNo) => <option key={raceNo} value={raceNo}>{raceNo}R</option>)}</select></label>
				</div>
				<p style={textStyle}>index: {historyIndex.dates.length} 日。選択中の日付だけを取得します。</p>
			</section>
			{loadError ? <p style={textStyle}>{loadError}</p> : null}
			{!dateFile && !loadError ? <p style={textStyle}>履歴日付 shard を読み込んでいます。</p> : null}
			{dateFile ? <section style={{ ...cardStyle, gap: "12px" }}>
				<p style={labelStyle}>{dateFile.date} / {filteredRaces.length} レース</p>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", maxHeight: "480px", overflowY: "auto" }}>
					{filteredRaces.map((race) => <button key={race.raceKey} type="button" onClick={() => setSelectedRaceKey(race.raceKey)} style={{ textAlign: "left", border: `1px solid ${selectedRace?.raceKey === race.raceKey ? boatTheme.colors.aquaDeep : boatTheme.colors.line}`, borderRadius: "6px", padding: "10px", background: selectedRace?.raceKey === race.raceKey ? "rgba(223, 245, 255, 0.98)" : "#fff", cursor: "pointer" }}><strong>{race.venueName} {race.raceNo}R</strong><span style={{ display: "block", fontSize: "12px", color: boatTheme.colors.muted, marginTop: "4px" }}>結果 {analysisStatusLabel(race.resultStatus)} / 払戻 {analysisStatusLabel(race.payoutStatus)}</span></button>)}
				</div>
			</section> : null}
			{selectedRace ? <section style={twoColumnGridStyle}>
				<article style={cardStyle}><p style={labelStyle}>選択レース</p><p style={valueStyle}>{selectedRace.venueName} {selectedRace.raceNo}R {selectedRace.raceTitle ?? ""}</p><p style={textStyle}>締切 {selectedRace.closingTime ?? "未取得"} / 結果 {selectedRace.officialResult.finishOrder.join("-") || "未取得"} / 3連単 {selectedRace.officialResult.trifecta ?? "未取得"} / 払戻 {selectedRace.officialResult.trifectaPayoutYen?.toLocaleString("ja-JP") ?? "未取得"}</p><p style={textStyle}>展示 {analysisStatusLabel(selectedRace.exhibitionStatus)} / 天候 {analysisStatusLabel(selectedRace.weatherStatus)} / 水面 {analysisStatusLabel(selectedRace.waterStatus)}</p></article>
				<article style={cardStyle}><p style={labelStyle}>選手 identity</p><p style={textStyle}>公式登録番号 {selectedRace.racerLinkageSummary.officialRegistrationLinkedCount} / exact-name link {selectedRace.racerLinkageSummary.nameLinkedCount} / 未解決 {selectedRace.racerLinkageSummary.unresolvedCount}</p><ul style={noteListStyle}>{selectedRace.racers.map((racer) => <li key={`${selectedRace.raceKey}:${racer.lane}`}>{racer.lane}号艇 {racer.racerName} - {racer.officialRegistrationNo ? `公式登録 ${racer.officialRegistrationNo}` : racer.resolvedRegistrationNo ? `exact-name ${racer.resolvedRegistrationNo}` : "未解決"}</li>)}</ul></article>
			</section> : null}
			{selectedRace ? <section style={cardStyle}><p style={labelStyle}>source path</p><ul style={noteListStyle}>{Object.entries(selectedRace.sourcePaths).map(([label, sourcePath]) => <li key={label}>{label}: <code>{sourcePath}</code></li>)}</ul></section> : null}
		</>
	);
}

function RaceAnalysisSection({ raceAnalysis, historicalSummary, historicalIndex }: { raceAnalysis: BoatExRaceAnalysisFile | null; historicalSummary: BoatExHistoricalRaceAnalysisSummaryFile | null; historicalIndex: BoatExHistoricalRaceAnalysisIndexFile | null }) {
	const [mode, setMode] = useState<"latest" | "history">("latest");
	return (
		<>
			<div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
				<button type="button" onClick={() => setMode("latest")} style={{ border: `1px solid ${mode === "latest" ? boatTheme.colors.aquaDeep : boatTheme.colors.line}`, borderRadius: "6px", padding: "8px 12px", background: mode === "latest" ? "rgba(223, 245, 255, 0.98)" : "#fff", cursor: "pointer" }}>最新日レース分析</button>
				<button type="button" onClick={() => setMode("history")} style={{ border: `1px solid ${mode === "history" ? boatTheme.colors.aquaDeep : boatTheme.colors.line}`, borderRadius: "6px", padding: "8px 12px", background: mode === "history" ? "rgba(223, 245, 255, 0.98)" : "#fff", cursor: "pointer" }}>履歴全レース分析</button>
			</div>
			{mode === "latest" ? <LatestRaceAnalysisSection raceAnalysis={raceAnalysis} /> : <HistoricalRaceAnalysisSection summary={historicalSummary} historyIndex={historicalIndex} />}
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

function StructuredTicketHistorySection({ summary, historyIndex }: { summary: BoatExStructuredTicketsHistorySummaryFile | null; historyIndex: BoatExStructuredTicketsHistoryIndexFile | null }) {
	const [selectedDate, setSelectedDate] = useState("");
	const [dateFile, setDateFile] = useState<BoatExStructuredTicketsDateFile | null>(null);
	useEffect(() => {
		if (historyIndex?.latestDate && !historyIndex.dates.some((entry) => entry.date === selectedDate)) setSelectedDate(historyIndex.latestDate);
	}, [historyIndex, selectedDate]);
	useEffect(() => {
		const entry = historyIndex?.dates.find((candidate) => candidate.date === selectedDate);
		if (!entry) return;
		let cancelled = false;
		setDateFile(null);
		void fetch(withBasePath(entry.path.replace(/^public\//, "")), { cache: "no-store" })
			.then(async (response) => { if (!response.ok) throw new Error("structured ticket shard fetch failed"); return await response.json() as BoatExStructuredTicketsDateFile; })
			.then((value) => { if (!cancelled) setDateFile(value); })
			.catch(() => { if (!cancelled) setDateFile(null); });
		return () => { cancelled = true; };
	}, [historyIndex, selectedDate]);
	if (!summary || !historyIndex) return <p style={textStyle}>構造化券種の履歴 summary がありません。</p>;
	const evaluated = (dateFile?.races ?? []).filter((race) => race.evaluation.evaluationStatus === "evaluated");
	return <>
		<section style={metricGridStyle}>
			<article style={cardStyle}><p style={labelStyle}>予想文あり</p><p style={metricValueStyle}>{summary.predictionTextAvailableRaceCount}</p><p style={textStyle}>履歴 {summary.historyRaceCount}R 中の source-backed 件数。</p></article>
			<article style={cardStyle}><p style={labelStyle}>構造化券種 / 券数</p><p style={metricValueStyle}>{summary.structuredTicketAvailableRaceCount} / {summary.structuredTicketCount}</p><p style={textStyle}>strict parser で読めたレース / 券数。</p></article>
			<article style={cardStyle}><p style={labelStyle}>評価: 的中 / 不的中</p><p style={metricValueStyle}>{summary.hitRaceCount} / {summary.missRaceCount}</p><p style={textStyle}>完全一致の着順だけで判定します。</p></article>
			<article style={cardStyle}><p style={labelStyle}>払戻連結 / 合計</p><p style={metricValueStyle}>{summary.payoutLinkedHitCount} / {summary.totalSourceBackedPayoutYen.toLocaleString("ja-JP")}</p><p style={textStyle}>公式3連単払戻がある的中だけを合算します。</p></article>
		</section>
		<section style={cardStyle}><p style={labelStyle}>strict parser</p><p style={textStyle}>{summary.parserRules.join(" ")}</p><p style={textStyle}>skip: {Object.entries(summary.skippedReasons).map(([reason, count]) => `${reason} ${count}`).join(" / ")}</p><p style={textStyle}>audit: <code>{summary.auditPaths[0]}</code></p></section>
		<section style={cardStyle}><label style={textStyle}>日付<select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} style={{ display: "block", marginTop: "4px" }}>{historyIndex.dates.map((entry) => <option key={entry.date} value={entry.date}>{entry.date} - 券種 {entry.structuredTicketAvailableRaceCount} / 評価 {entry.evaluatedPredictionRaceCount}</option>)}</select></label></section>
		{dateFile ? <section style={cardStyle}><p style={labelStyle}>{dateFile.date} の評価レース</p>{evaluated.length === 0 ? <p style={textStyle}>この日には strict structured ticket の評価レースがありません。</p> : <ul style={noteListStyle}>{evaluated.map((race) => <li key={`${race.date}:${race.venueCode}:${race.raceNo}`}>{race.venueName} {race.raceNo}R: {race.structuredTickets.map((ticket) => `${ticket.group} ${ticket.boatNumbers.join("-")}`).join(", ")} / 着順 {race.officialResult.finishOrder.join("-")} / {race.evaluation.hit ? "的中" : "不的中"} / 払戻 {race.evaluation.payoutYen?.toLocaleString("ja-JP") ?? "未連結"}<br /><code>{race.sourcePaths.prediction ?? race.sourcePaths.history}</code></li>)}</ul>}</section> : <p style={textStyle}>日別券種 shard を読み込んでいます。</p>}
	</>;
}

function ReadinessMatrixSection({ audit }: { audit: BoatExTabCompletenessAuditFile | null }) {
	if (!audit) return <p style={textStyle}>タブ充足状況監査を読み込めません。</p>;

	return (
		<section style={cardStyle}>
			<div>
				<p style={labelStyle}>readiness matrix</p>
				<p style={valueStyle}>各タブの出典・状態・理由</p>
				<p style={textStyle}>推測値ではなく、生成済みのsource-backedデータまたは監査結果を表示します。</p>
			</div>
			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "960px" }}>
					<thead>
						<tr>
							<th style={thStyle}>タブ</th>
							<th style={thStyle}>状態</th>
							<th style={thStyle}>理由</th>
							<th style={thStyle}>出典</th>
						</tr>
					</thead>
					<tbody>
						{audit.tabs.map((tab) => (
							<tr key={tab.key}>
								<td style={tdStyle}>{tab.key}</td>
								<td style={tdStyle}>{statusLabel(tab.status)}</td>
								<td style={tdStyle}>{tab.reason}</td>
								<td style={tdStyle}>{tab.sourcePaths.join("\n")}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
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
	historicalSourceCoverage,
}: {
	venueBias: BoatExVenueBiasV1File | null;
	roughIndex: BoatExRoughIndexV1File | null;
	todayFlow: BoatExTodayFlowV1File | null;
	predictionStructure: BoatExPredictionStructureV1File | null;
	historicalSourceCoverage: BoatExHistoricalSourceCoverageFile | null;
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
		...(historicalSourceCoverage?.warnings.map((warning) => `過去素材: ${warning}`) ?? []),
	];

	if (!venueBias && !roughIndex && !todayFlow && !predictionStructure && !historicalSourceCoverage) {
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
					<p style={labelStyle}>過去素材</p>
					<p style={metricValueStyle}>{historicalSourceCoverage?.sourceCount ?? "なし"}</p>
					<p style={textStyle}>{historicalSourceCoverage ? `${historicalSourceCoverage.dateFrom ?? "日付未解決"} から ${historicalSourceCoverage.dateTo ?? "日付未解決"} / ${historicalSourceCoverage.dateCount}日 / ${historicalSourceCoverage.venueCount}会場` : "過去素材indexなし"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>素材内訳</p>
					<p style={metricValueStyle}>{historicalSourceCoverage ? `${historicalSourceCoverage.reviewFileCount} / ${historicalSourceCoverage.dogImageCount}` : "なし"}</p>
					<p style={textStyle}>レビュー / 会場画像。未解決: {historicalSourceCoverage?.unresolvedSourceCount ?? "なし"}</p>
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
		weatherWaterHistory: null,
		racerEvidence: null,
		racerFeatures: null,
		racerIdentityUnresolvedAudit: null,
		currentDayPredictionCoverage: null,
		venueBias: null,
		roughIndex: null,
		todayFlow: null,
		predictionStructure: null,
		raceAnalysis: null,
		structuredTicketsHistorySummary: null,
		structuredTicketsHistoryIndex: null,
		historicalRaceAnalysisSummary: null,
		historicalRaceAnalysisIndex: null,
		historicalSourceCoverage: null,
		registeredIdentityRegistry: null,
		registryLinkageAudit: null,
		registrationQualityAudit: null,
		registrationProvenanceAudit: null,
		nameIdentityBridgeAudit: null,
		tabCompletenessAudit: null,
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

				const [derivedManifestResponse, venueResponse, racerResponse, venueBiasResponse, roughIndexResponse, todayFlowResponse, predictionStructureResponse, structuredTicketsHistorySummaryResponse, structuredTicketsHistoryIndexResponse, raceAnalysisResponse, historicalRaceAnalysisSummaryResponse, historicalRaceAnalysisIndexResponse, historicalSourceCoverageResponse, weatherWaterHistoryResponse, racerFeatures, racerIdentityUnresolvedAudit, currentDayPredictionCoverage, registeredIdentityRegistry, registryLinkageAudit, registrationQualityAudit, registrationProvenanceAudit, nameIdentityBridgeAudit, tabCompletenessAudit] = await Promise.all([
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
					fetch(withBasePath("data/boatrace-ex/derived/prediction-structure/history-summary.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/prediction-structure/history-index.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/race-analysis/latest.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/race-analysis/history-summary.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/race-analysis/history-index.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/history-coverage/latest.json"), { cache: "no-store" }),
					fetch(withBasePath("data/boatrace-ex/derived/weather-water-history/latest.json"), { cache: "no-store" }),
					fetchOptionalJson<BoatExRacerFeaturesFile>("data/boatrace-ex/derived/racer-features/latest.json"),
					fetchOptionalJson<BoatExRacerIdentityUnresolvedAuditFile>("data/boatrace-ex/audit/racer-identity-unresolved-audit-latest.generated.json"),
					fetchOptionalJson<BoatExCurrentDayPredictionCoverageFile>("data/boatrace-ex/derived/current-day-prediction-coverage/latest.json"),
					fetchOptionalJson<BoatExRegisteredRacerIdentityRegistryFile>("data/boatrace-ex/identity/registered-racers.generated.json"),
					fetchOptionalJson<BoatExRacerEvidenceRegistryLinkageAuditFile>(`data/boatrace-ex/audit/racer-evidence-registry-linkage-${targetDate}.generated.json`),
					fetchOptionalJson<BoatExRegisteredRegistrationQualityAuditFile>(`data/boatrace-ex/audit/registered-registration-quality-${targetDate}.generated.json`),
					fetchOptionalJson<BoatExRegistrationProvenanceAuditFile>(`data/boatrace-ex/audit/registration-provenance-${targetDate}.generated.json`),
					fetchOptionalJson<BoatExNameIdentityBridgeAuditFile>(`data/boatrace-ex/audit/name-identity-bridge-${targetDate}.generated.json`),
					fetchOptionalJson<BoatExTabCompletenessAuditFile>(`data/boatrace-ex/audit/tab-completeness-${targetDate}.generated.json`),
				]);

				if (!derivedManifestResponse.ok) throw new Error(`derived manifest fetch failed: ${derivedManifestResponse.status}`);
				if (!venueResponse.ok) throw new Error(`venue evidence fetch failed: ${venueResponse.status}`);
				if (!racerResponse.ok) throw new Error(`racer evidence fetch failed: ${racerResponse.status}`);
				if (!venueBiasResponse.ok) throw new Error(`venue bias fetch failed: ${venueBiasResponse.status}`);
				if (!roughIndexResponse.ok) throw new Error(`rough index fetch failed: ${roughIndexResponse.status}`);
				if (!todayFlowResponse.ok) throw new Error(`today flow fetch failed: ${todayFlowResponse.status}`);
				if (!predictionStructureResponse.ok) throw new Error(`prediction structure fetch failed: ${predictionStructureResponse.status}`);
				if (!structuredTicketsHistorySummaryResponse.ok) throw new Error(`structured ticket history summary fetch failed: ${structuredTicketsHistorySummaryResponse.status}`);
				if (!structuredTicketsHistoryIndexResponse.ok) throw new Error(`structured ticket history index fetch failed: ${structuredTicketsHistoryIndexResponse.status}`);
				if (!raceAnalysisResponse.ok) throw new Error(`race analysis fetch failed: ${raceAnalysisResponse.status}`);
				if (!historicalRaceAnalysisSummaryResponse.ok) throw new Error(`historical race analysis summary fetch failed: ${historicalRaceAnalysisSummaryResponse.status}`);
				if (!historicalRaceAnalysisIndexResponse.ok) throw new Error(`historical race analysis index fetch failed: ${historicalRaceAnalysisIndexResponse.status}`);
				if (!historicalSourceCoverageResponse.ok) throw new Error(`historical source coverage fetch failed: ${historicalSourceCoverageResponse.status}`);
				if (!weatherWaterHistoryResponse.ok) throw new Error(`weather water history fetch failed: ${weatherWaterHistoryResponse.status}`);

				const derivedManifest = await derivedManifestResponse.json() as BoatExManifest;
				const venueEvidence = await venueResponse.json() as BoatExVenueEvidenceFile;
				const racerEvidence = await racerResponse.json() as BoatExRacerEvidenceFile;
				const venueBias = await venueBiasResponse.json() as BoatExVenueBiasV1File;
				const roughIndex = await roughIndexResponse.json() as BoatExRoughIndexV1File;
				const todayFlow = await todayFlowResponse.json() as BoatExTodayFlowV1File;
				const predictionStructure = await predictionStructureResponse.json() as BoatExPredictionStructureV1File;
				const structuredTicketsHistorySummary = await structuredTicketsHistorySummaryResponse.json() as BoatExStructuredTicketsHistorySummaryFile;
				const structuredTicketsHistoryIndex = await structuredTicketsHistoryIndexResponse.json() as BoatExStructuredTicketsHistoryIndexFile;
				const raceAnalysis = await raceAnalysisResponse.json() as BoatExRaceAnalysisFile;
				const historicalRaceAnalysisSummary = await historicalRaceAnalysisSummaryResponse.json() as BoatExHistoricalRaceAnalysisSummaryFile;
				const historicalRaceAnalysisIndex = await historicalRaceAnalysisIndexResponse.json() as BoatExHistoricalRaceAnalysisIndexFile;
				const historicalSourceCoverage = await historicalSourceCoverageResponse.json() as BoatExHistoricalSourceCoverageFile;
				const weatherWaterHistory = await weatherWaterHistoryResponse.json() as BoatExWeatherWaterHistoryFile;

				if (isMounted) {
					setLoadState({
						status: "ready",
						manifest,
						derivedManifest,
						dateIndex,
					venueEvidence,
					weatherWaterHistory,
					racerEvidence,
					racerFeatures,
					racerIdentityUnresolvedAudit,
					currentDayPredictionCoverage,
					venueBias,
					roughIndex,
					todayFlow,
					predictionStructure,
					structuredTicketsHistorySummary,
					structuredTicketsHistoryIndex,
					raceAnalysis,
					historicalRaceAnalysisSummary,
					historicalRaceAnalysisIndex,
					historicalSourceCoverage,
					registeredIdentityRegistry,
					registryLinkageAudit,
					registrationQualityAudit,
					registrationProvenanceAudit,
					nameIdentityBridgeAudit,
					tabCompletenessAudit,
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
					weatherWaterHistory: null,
					racerEvidence: null,
					racerFeatures: null,
					racerIdentityUnresolvedAudit: null,
					currentDayPredictionCoverage: null,
					venueBias: null,
					roughIndex: null,
					todayFlow: null,
					predictionStructure: null,
					structuredTicketsHistorySummary: null,
					structuredTicketsHistoryIndex: null,
					raceAnalysis: null,
					historicalRaceAnalysisSummary: null,
					historicalRaceAnalysisIndex: null,
					historicalSourceCoverage: null,
					registeredIdentityRegistry: null,
					registryLinkageAudit: null,
					registrationQualityAudit: null,
					registrationProvenanceAudit: null,
					nameIdentityBridgeAudit: null,
					tabCompletenessAudit: null,
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
	const weatherWaterHistory = loadState.weatherWaterHistory;
	const racerEvidence = loadState.racerEvidence;
	const racerFeatures = loadState.racerFeatures;
	const racerIdentityUnresolvedAudit = loadState.racerIdentityUnresolvedAudit;
	const currentDayPredictionCoverage = loadState.currentDayPredictionCoverage;
	const venueBias = loadState.venueBias;
	const roughIndex = loadState.roughIndex;
	const todayFlow = loadState.todayFlow;
	const predictionStructure = loadState.predictionStructure;
	const structuredTicketsHistorySummary = loadState.structuredTicketsHistorySummary;
	const structuredTicketsHistoryIndex = loadState.structuredTicketsHistoryIndex;
	const raceAnalysis = loadState.raceAnalysis;
	const historicalRaceAnalysisSummary = loadState.historicalRaceAnalysisSummary;
	const historicalRaceAnalysisIndex = loadState.historicalRaceAnalysisIndex;
	const historicalSourceCoverage = loadState.historicalSourceCoverage;
	const registeredIdentityRegistry = loadState.registeredIdentityRegistry;
	const registryLinkageAudit = loadState.registryLinkageAudit;
	const registrationQualityAudit = loadState.registrationQualityAudit;
	const registrationProvenanceAudit = loadState.registrationProvenanceAudit;
	const nameIdentityBridgeAudit = loadState.nameIdentityBridgeAudit;
	const tabCompletenessAudit = loadState.tabCompletenessAudit;
	const historicalSourceDateRange = historicalSourceCoverage?.dateFrom && historicalSourceCoverage.dateTo
		? `${historicalSourceCoverage.dateFrom} ～ ${historicalSourceCoverage.dateTo}`
		: "日付未解決";
	const historicalSourceWarning = historicalSourceCoverage?.warnings[0] ?? "日付または会場が未解決の素材があります";
	const latestDate = loadState.dateIndex?.latestDate ?? venueEvidence?.date ?? racerEvidence?.date ?? latestHistory?.date ?? "なし";
	const dateIndexEntry = findDateIndexEntry(loadState.dateIndex, latestDate);
	const availableDateCount = loadState.dateIndex?.summary.dateCount ?? "日付indexなし";
	const availableDates = loadState.dateIndex?.availableDates ?? [];
	const earliestDate = availableDates[0] ?? "なし";
	const latestDateIsStale = typeof latestDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(latestDate) && latestDate < jstDateString();
	const materialStatuses: BoatExMaterialStatus[] = [
		{ label: "history/races", latestDate, dateCount: availableDateCount, count: loadState.dateIndex?.summary.historyDateCount ?? "未取得", status: "ready", sourceType: "source-backed", updatedAt: loadState.dateIndex?.generatedAt ?? "未取得" },
		{ label: "coverage", latestDate, dateCount: loadState.dateIndex?.summary.coverageDateCount ?? "未取得", count: venueEvidence?.summary.recordCount ?? "未取得", status: dateIndexEntry?.coverage.status ?? "未取得", sourceType: "source-backed", updatedAt: loadState.dateIndex?.generatedAt ?? "未取得" },
		materialStatusFromManifest(loadState.derivedManifest, "venue-evidence", "/venue-evidence/"),
		materialStatusFromManifest(loadState.derivedManifest, "racer-evidence", "/racer-evidence/"),
		materialStatusFromManifest(loadState.derivedManifest, "venue-bias", "/venue-bias/"),
		materialStatusFromManifest(loadState.derivedManifest, "rough-index", "/rough-index/"),
		materialStatusFromManifest(loadState.derivedManifest, "racer-features", "/racer-features/"),
		{ label: "registered-racer identity", latestDate: registeredIdentityRegistry?.summary.lastSeenDate ?? "未取得", dateCount: registeredIdentityRegistry?.summary.identityCount ?? "未取得", count: registeredIdentityRegistry?.summary.identityCount ?? "未取得", status: registeredIdentityRegistry ? "ready" : "未取得", sourceType: "official registrationNo", updatedAt: registeredIdentityRegistry?.generatedAt ?? "未取得" },
		{ label: "current-day prediction coverage", latestDate: currentDayPredictionCoverage?.targetDate ?? "未取得", dateCount: "当日", count: currentDayPredictionCoverage?.raceCount ?? "未取得", status: currentDayPredictionCoverage ? "available" : "未取得", sourceType: "official current-day", updatedAt: currentDayPredictionCoverage?.generatedAt ?? "未取得" },
		{ label: "weather/wind/wave", latestDate: weatherWaterHistory?.dateRange.to ?? "未取得", dateCount: weatherWaterHistory?.dateRange.dateCount ?? "未取得", count: weatherWaterHistory?.summary.weatherAvailableRaceCount ?? "未取得", status: weatherWaterHistory ? "ready" : "未取得", sourceType: "source-backed", updatedAt: loadState.derivedManifest?.generatedAt ?? "未取得" },
		{ label: "race-analysis", latestDate: raceAnalysis?.targetDate ?? "未取得", dateCount: historicalRaceAnalysisSummary?.dateRange.dateCount ?? "未取得", count: historicalRaceAnalysisSummary?.summary.raceCount ?? "未取得", status: raceAnalysis?.summary.readiness?.status ?? "未取得", sourceType: "source-backed availability", updatedAt: raceAnalysis?.generatedAt ?? "未取得" },
	];
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
	const raceAnalysisAvailable = hasDerivedFile(loadState.derivedManifest, "/race-analysis/");

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
								<p style={labelStyle}>EX分析済み日数</p>
								<p style={metricValueStyle}>{availableDateCount}</p>
								<p style={textStyle}>期間: {earliestDate} 〜 {latestDate}</p>
								<p style={textStyle}>最新: {latestDate}</p>
								<details>
									<summary>日付一覧を表示</summary>
									<p style={{ ...textStyle, maxHeight: "120px", overflowY: "auto", marginTop: "8px" }}>{availableDates.join(", ") || "日付indexなし"}</p>
								</details>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>登録identity数</p>
								<p style={metricValueStyle}>{registeredIdentityRegistry?.summary.identityCount ?? "未読込"}</p>
								<p style={textStyle}>公式出典が完備された登録番号identity</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>登録番号あり出走</p>
								<p style={metricValueStyle}>{registrationQualityAudit?.summary.registeredAppearanceCount ?? registeredIdentityRegistry?.summary.sourceAppearanceCount ?? "未読込"}</p>
								<p style={textStyle}>登録番号の完全一致でレジストリ化された出走</p>
							</article>
							<article style={cardStyle}>
							<p style={labelStyle}>エビデンスリンク済み</p>
							<p style={metricValueStyle}>{registryLinkageAudit?.counts.linked ?? "未読込"}</p>
							<p style={textStyle}>未リンク {registryLinkageAudit?.counts.unlinkedRegistered ?? "未読込"}</p>
						</article>
						<article style={cardStyle}>
							<p style={labelStyle}>名前完全一致・一意リンク</p>
							<p style={metricValueStyle}>{nameIdentityBridgeAudit?.counts.exactUniqueNameLinked ?? registryLinkageAudit?.counts.nameLinked ?? "未読込"}</p>
							<p style={textStyle}>公式登録番号を保持した補助リンク</p>
						</article>
						<article style={cardStyle}>
							<p style={labelStyle}>曖昧名を除外</p>
							<p style={metricValueStyle}>{nameIdentityBridgeAudit?.counts.ambiguousSkipped ?? registryLinkageAudit?.counts.ambiguousNameSkipped ?? "未読込"}</p>
							<p style={textStyle}>複数候補の名前は未解決のまま保持</p>
						</article>
							<article style={cardStyle}>
								<p style={labelStyle}>登録番号未解決</p>
								<p style={metricValueStyle}>{registryLinkageAudit?.counts.unresolvedExcluded ?? registeredIdentityRegistry?.summary.unresolvedExcludedCount ?? "未読込"}</p>
								<p style={textStyle}>名前だけでは紐づけず、安全なレジストリから除外</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>衝突 / alias候補</p>
								<p style={metricValueStyle}>{registrationQualityAudit?.summary.collisionCount ?? registeredIdentityRegistry?.summary.collisionCount ?? "未読込"} / {registrationQualityAudit?.summary.aliasCandidateCount ?? registeredIdentityRegistry?.summary.aliasCandidateCount ?? "未読込"}</p>
								<p style={textStyle}>安全なレジストリには入れない監査対象</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>出典 完備 / 欠損</p>
								<p style={metricValueStyle}>{registrationProvenanceAudit?.after.provenanceCompleteCount ?? registrationQualityAudit?.summary.provenanceCompleteCount ?? "未読込"} / {registrationProvenanceAudit?.after.provenanceMissingCount ?? registrationQualityAudit?.summary.provenanceMissingCount ?? "未読込"}</p>
								<p style={textStyle}>出典に基づく登録番号provenance</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>過去素材日数</p>
								<p style={metricValueStyle}>{historicalSourceCoverage?.dateCount ?? "なし"}</p>
								<p style={textStyle}>{historicalSourceDateRange}</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>過去素材数</p>
								<p style={metricValueStyle}>{historicalSourceCoverage?.sourceCount ?? "なし"}</p>
								<p style={textStyle}>レビュー / 会場画像 / 生成済み / EX派生素材</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>過去素材会場</p>
								<p style={metricValueStyle}>{historicalSourceCoverage?.venueCount ?? "なし"}</p>
								<p style={textStyle}>索引化できた会場数</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>未解決素材</p>
								<p style={metricValueStyle}>{historicalSourceCoverage?.unresolvedSourceCount ?? "なし"}</p>
								<p style={textStyle}>{historicalSourceWarning}</p>
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
						{latestDateIsStale ? <section style={{ ...cardStyle, borderColor: "#c97123", background: "#fff8e8" }}>
							<p style={labelStyle}>EX履歴更新の確認が必要です</p>
							<p style={valueStyle}>BOAT EX履歴データが古い可能性があります。</p>
							<p style={textStyle}>EX latestDate: {latestDate} / 現在日付: {jstDateString()}。履歴再生成を確認してください。</p>
						</section> : null}
						<section style={cardStyle}>
							<p style={labelStyle}>素材更新状況</p>
							<div style={tableWrapStyle}>
								<table style={{ ...tableStyle, minWidth: "1060px" }}>
									<thead><tr><th style={thStyle}>素材</th><th style={thStyle}>latestDate</th><th style={thStyle}>日数</th><th style={thStyle}>件数</th><th style={thStyle}>状態</th><th style={thStyle}>sourceType</th><th style={thStyle}>updatedAt</th></tr></thead>
									<tbody>{materialStatuses.map((item) => <tr key={item.label}><td style={tdStyle}>{item.label}</td><td style={tdStyle}>{item.latestDate}</td><td style={tdStyle}>{item.dateCount}</td><td style={tdStyle}>{item.count}</td><td style={tdStyle}>{statusLabel(item.status)}</td><td style={tdStyle}>{item.sourceType}</td><td style={tdStyle}>{item.updatedAt}</td></tr>)}</tbody>
								</table>
							</div>
						</section>
						<section style={twoColumnGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>履歴EX</p>
								<p style={valueStyle}>{venueBias?.dateRange.from ?? "未読込"} ～ {venueBias?.dateRange.to ?? "未読込"}</p>
								<p style={textStyle}>履歴レース {venueBias?.summary.raceCount ?? "未読込"} / 結果 {roughIndex?.summary.resultAvailableRaceCount ?? "未読込"} / 払戻 {roughIndex?.summary.payoutAvailableRaceCount ?? "未読込"}</p>
								<p style={textStyle}>会場傾向、荒れ指数、決まり手、履歴選手特徴に利用します。</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>当日EX race-analysis</p>
								<p style={valueStyle}>{currentDayPredictionCoverage?.resultStatus === "pre-race" ? "未取得 / レース前" : "結果系を確認中"}</p>
								<p style={textStyle}>結果・払戻の確定後に生成します。当日予想用coverageとは別の結果系データです。</p>
							</article>
						</section>
						<CurrentDayPredictionCoverageSection coverage={currentDayPredictionCoverage} />
						<ReadinessMatrixSection audit={tabCompletenessAudit} />
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
						<RegisteredIdentityRegistrySection
							registry={registeredIdentityRegistry}
							linkageAudit={registryLinkageAudit}
							qualityAudit={registrationQualityAudit}
							provenanceAudit={registrationProvenanceAudit}
							nameIdentityBridgeAudit={nameIdentityBridgeAudit}
						/>
						<RacerFeaturesSection features={racerFeatures} audit={racerIdentityUnresolvedAudit} />
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
					<SectionShell title="傾向分析ラボ" subtitle="結果・払戻カバレッジ">
						<PendingPanel
							status={venueBias?.readiness.status ?? "insufficient-history"}
							reason={venueBias?.readiness.reason ?? "会場傾向エビデンスがありません。"}
							source="会場傾向と荒れ指数の履歴結果・払戻カバレッジを表示します。予測シグナルや合成スコアは生成しません。"
						/>
						<VenueBiasSection venueBias={venueBias} />
						<RoughIndexSection roughIndex={roughIndex} />
					</SectionShell>
				);
			case "trifecta-ranking":
				return (
					<SectionShell title="3連単ランキング" subtitle="結果・払戻カバレッジ">
						<PendingPanel
							status={roughIndex?.readiness.status ?? "insufficient-history"}
							reason="3連単の結果・払戻事実を表示します。組み合わせの予測ランキングは構造化した予測票がないため生成しません。"
							source="officialResult.trifecta / officialResult.payout / public/data/boatrace-ex/derived/rough-index/latest.json"
						/>
						<RoughIndexSection roughIndex={roughIndex} />
						<TodayFlowSection todayFlow={todayFlow} />
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
					<SectionShell title="レース推移" subtitle="当日結果フロー">
						<PendingPanel
							status={todayFlow?.readiness.status ?? "insufficient-history"}
							reason={todayFlow?.readiness.reason ?? "当日フローエビデンスがありません。"}
							source="同日の着順、イン・アウト、払戻のsource-backed事実を表示します。遷移予測は生成しません。"
						/>
						<TodayFlowSection todayFlow={todayFlow} />
					</SectionShell>
				);
			case "weather":
				return (
					<SectionShell title="天候・水面" subtitle="風・波の事実">
						<div style={{ display: "grid", gap: "12px" }}>
							<p style={labelStyle}>当日coverage</p>
							<p style={textStyle}>日次の会場エビデンス。履歴分布とは区別して表示します。</p>
							<DailyWeatherSection venueEvidence={venueEvidence} />
						</div>
						<div style={{ display: "grid", gap: "12px" }}>
							<p style={labelStyle}>履歴天候・水面</p>
							<p style={textStyle}>全EX履歴から集計した会場別の風速帯・波高帯・天候・風向別サンプルです。</p>
							<WeatherHistorySection weatherWaterHistory={weatherWaterHistory} />
						</div>
					</SectionShell>
				);
			case "venue-bias":
				return (
					<SectionShell title="会場傾向" subtitle="会場傾向 v1">
						<div style={{ display: "grid", gap: "12px" }}>
							<p style={labelStyle}>EX会場統計</p>
							<PendingPanel
								status={venueBias?.readiness.status ?? "insufficient-history"}
								reason={venueBias?.readiness.reason ?? "会場傾向エビデンスがありません。"}
								source="件数と比率は履歴に基づく事実です。スコア、ランキング、推奨は生成しません。"
							/>
							<VenueBiasSection venueBias={venueBias} />
						</div>
						<BoatExVenueFeatureNotes />
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
						<StructuredTicketHistorySection summary={structuredTicketsHistorySummary} historyIndex={structuredTicketsHistoryIndex} />
					</SectionShell>
				);
			case "race-analysis":
				return (
					<SectionShell title="全レース分析" subtitle="最新日と履歴全体の会場別・R別ソース確認">
						<PendingPanel
							status={historicalRaceAnalysisSummary?.summary.readiness.status ?? raceAnalysis?.summary.readiness.status ?? "insufficient-history"}
							reason={historicalRaceAnalysisSummary?.summary.readiness.reason ?? raceAnalysis?.summary.readiness.reason ?? "全レース分析エビデンスがありません。"}
							source="history、公式結果・払戻、展示、天候、選手エビデンスの状態だけを表示します。予測、推奨、合成スコアは生成しません。"
						/>
						<RaceAnalysisSection raceAnalysis={raceAnalysis} historicalSummary={historicalRaceAnalysisSummary} historicalIndex={historicalRaceAnalysisIndex} />
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
							historicalSourceCoverage={historicalSourceCoverage}
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
					<p style={labelStyle}>EX分析済み日数</p>
					<p style={metricValueStyle}>{availableDateCount}</p>
					<p style={textStyle}>派生分析に利用できる日付</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>過去素材日数</p>
					<p style={metricValueStyle}>{historicalSourceCoverage?.dateCount ?? "なし"}</p>
					<p style={textStyle}>{historicalSourceDateRange}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>過去素材数</p>
					<p style={metricValueStyle}>{historicalSourceCoverage?.sourceCount ?? "なし"}</p>
					<p style={textStyle}>レビュー / 会場画像 / 生成済み / EX派生素材</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>過去素材会場</p>
					<p style={metricValueStyle}>{historicalSourceCoverage?.venueCount ?? "なし"}</p>
					<p style={textStyle}>索引化できた会場数</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>未解決素材</p>
					<p style={metricValueStyle}>{historicalSourceCoverage?.unresolvedSourceCount ?? "なし"}</p>
					<p style={textStyle}>{historicalSourceWarning}</p>
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
