import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import type { BoatExVenueEvidenceFile, BoatExVenueEvidenceItem } from "../lib/boatExTypes";
import { boatTheme } from "../lib/theme";

type BoatExManifestFile = {
	path?: string;
	kind?: string;
	date?: string;
	sourceStatus?: string;
	coverageStatus?: string;
};

type BoatExManifest = {
	schemaVersion?: number;
	kind?: string;
	generatedAt?: string;
	files?: BoatExManifestFile[];
};

type LoadState = {
	status: "loading" | "ready" | "missing";
	manifest: BoatExManifest | null;
	evidence: BoatExVenueEvidenceFile | null;
	message: string;
};

const cardGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: "14px",
};

const cardStyle = {
	padding: "18px",
	borderRadius: "8px",
	background: "rgba(255, 255, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "8px",
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
	fontSize: "1.15rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const textStyle = {
	margin: 0,
	lineHeight: 1.75,
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
	minWidth: "920px",
	borderCollapse: "collapse" as const,
	fontSize: "0.92rem",
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
	padding: "12px 10px",
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
	if (!status) return "unknown";
	return status;
}

function countLabel(value: number | undefined, total: number): string {
	return `${value ?? 0}/${total}`;
}

function yenLabel(value: number | null | undefined): string {
	if (typeof value !== "number") return "未取得";
	return `${value.toLocaleString("ja-JP")}円`;
}

function readinessLabel(venue: BoatExVenueEvidenceItem, key: "venueBias" | "roughIndex" | "todayFlow"): string {
	return venue.derivedReadiness[key]?.status ?? "pending";
}

export function BoatExPage() {
	const [loadState, setLoadState] = useState<LoadState>({
		status: "loading",
		manifest: null,
		evidence: null,
		message: "EX venue evidence を確認しています。",
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
				if (!latestHistory?.date) throw new Error("latest history date is missing");

				const evidenceResponse = await fetch(withBasePath(`data/boatrace-ex/derived/venue-evidence/${latestHistory.date}.json`), {
					cache: "no-store",
				});
				if (!evidenceResponse.ok) throw new Error(`venue evidence fetch failed: ${evidenceResponse.status}`);
				const evidence = await evidenceResponse.json() as BoatExVenueEvidenceFile;

				if (isMounted) {
					setLoadState({
						status: "ready",
						manifest,
						evidence,
						message: "Phase 4 venue evidence v0 を表示しています。",
					});
				}
			} catch {
				if (isMounted) {
					setLoadState({
						status: "missing",
						manifest: null,
						evidence: null,
						message: "EX venue evidence 未取得",
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
	const evidence = loadState.evidence;
	const latestDate = evidence?.date ?? latestHistory?.date ?? "未取得";
	const records = evidence?.summary.recordCount ?? "未取得";
	const venues = evidence?.summary.venueCount ?? "未取得";
	const historyDays = evidence?.summary.historyDays ?? "未取得";
	const analysisStatus = evidence?.summary.analysisStatus ?? "pending";

	return (
		<PageShell
			eyebrow="BOATRACE EX DATA LABO"
			title="KURARI BOAT EX"
			description="BOATRACE EX DATA LABO / source-backed analysis"
		>
			<section style={cardGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>STATUS</p>
					<p style={valueStyle}>{loadState.message}</p>
					<p style={textStyle}>source-backed evidence only。存在しない会場クセ、荒れ指数、今日の流れは補完しません。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>LATEST DATE</p>
					<p style={valueStyle}>{latestDate}</p>
					<p style={textStyle}>Phase 3 history manifest の最新日付を使用します。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>RECORDS</p>
					<p style={valueStyle}>{records}</p>
					<p style={textStyle}>venue evidence に集計された履歴レコード数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>VENUES</p>
					<p style={valueStyle}>{venues}</p>
					<p style={textStyle}>source-backed evidence を持つ会場数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>HISTORY DAYS</p>
					<p style={valueStyle}>{historyDays}</p>
					<p style={textStyle}>multi-day分析には不足しています。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>ANALYSIS STATUS</p>
					<p style={valueStyle}>{analysisStatus}</p>
					<p style={textStyle}>venue-bias / rough-index / today-flow は保留します。</p>
				</article>
			</section>

			<section style={cardStyle}>
				<p style={labelStyle}>SAFETY NOTE</p>
				<ul style={noteListStyle}>
					<li>fake補完は禁止です。未取得値は未取得、pending、insufficient-historyとして表示します。</li>
					<li>会場クセ、荒れ指数、今日の流れは accumulated history が増えるまで確定しません。</li>
					<li>このページは Phase 3 history / coverage 由来の集計だけを表示します。</li>
				</ul>
			</section>

			<section style={{ ...cardStyle, gap: "14px" }}>
				<div>
					<p style={labelStyle}>VENUE EVIDENCE</p>
					<p style={valueStyle}>Phase 4 evidence v0</p>
				</div>
				{evidence ? (
					<div style={tableWrapStyle}>
						<table style={tableStyle}>
							<thead>
								<tr>
									<th style={thStyle}>会場</th>
									<th style={thStyle}>R数</th>
									<th style={thStyle}>結果</th>
									<th style={thStyle}>展示</th>
									<th style={thStyle}>天候</th>
									<th style={thStyle}>払戻</th>
									<th style={thStyle}>venueBias</th>
									<th style={thStyle}>roughIndex</th>
									<th style={thStyle}>todayFlow</th>
									<th style={thStyle}>warnings</th>
								</tr>
							</thead>
							<tbody>
								{evidence.venues.map((venue) => (
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
											最高 {yenLabel(venue.resultEvidence.maxTrifectaPayout)}
										</td>
										<td style={tdStyle}>{readinessLabel(venue, "venueBias")}</td>
										<td style={tdStyle}>{readinessLabel(venue, "roughIndex")}</td>
										<td style={tdStyle}>{readinessLabel(venue, "todayFlow")}</td>
										<td style={tdStyle}>{venue.warnings.length > 0 ? venue.warnings.join(" / ") : "なし"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p style={textStyle}>EX venue evidence 未取得。static値では埋めません。</p>
				)}
			</section>

			{evidence ? (
				<section style={cardGridStyle}>
					{evidence.venues.map((venue) => (
						<article key={`card-${venue.venueCode}`} style={cardStyle}>
							<p style={labelStyle}>{venue.venueCode}</p>
							<p style={valueStyle}>{venue.venueName}</p>
							<p style={textStyle}>R数: {venue.raceCount}</p>
							<p style={textStyle}>結果: {countLabel(venue.availability.officialResultCount, venue.raceCount)}</p>
							<p style={textStyle}>展示: {countLabel(venue.availability.officialExhibitionCount, venue.raceCount)}</p>
							<p style={textStyle}>天候: {countLabel(venue.availability.weatherCount, venue.raceCount)}</p>
							<p style={textStyle}>venueBias: {readinessLabel(venue, "venueBias")}</p>
							<p style={textStyle}>roughIndex: {readinessLabel(venue, "roughIndex")}</p>
							<p style={textStyle}>todayFlow: {readinessLabel(venue, "todayFlow")}</p>
						</article>
					))}
				</section>
			) : null}
		</PageShell>
	);
}
