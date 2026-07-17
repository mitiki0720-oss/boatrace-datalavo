import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import type {
	BoatExRacerEvidenceFile,
	BoatExRacerEvidenceItem,
	BoatExVenueEvidenceFile,
	BoatExVenueEvidenceItem,
} from "../lib/boatExTypes";
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
	venueEvidence: BoatExVenueEvidenceFile | null;
	racerEvidence: BoatExRacerEvidenceFile | null;
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
	return status || "unknown";
}

function countLabel(value: number | undefined, total: number): string {
	return `${value ?? 0}/${total}`;
}

function numberLabel(value: number | null | undefined, digits = 2): string {
	if (typeof value !== "number") return "未取得";
	return value.toFixed(digits).replace(/\.?0+$/u, "");
}

function yenLabel(value: number | null | undefined): string {
	if (typeof value !== "number") return "未取得";
	return `${value.toLocaleString("ja-JP")}円`;
}

function venueReadinessLabel(venue: BoatExVenueEvidenceItem, key: "venueBias" | "roughIndex" | "todayFlow"): string {
	return venue.derivedReadiness[key]?.status ?? "pending";
}

function racerReadinessLabel(
	racer: BoatExRacerEvidenceItem,
	key: "racerProfile" | "courseChangePattern" | "exhibitionReliability" | "startTimingPattern",
): string {
	return racer.derivedReadiness[key]?.status ?? "pending";
}

function courseChangeLabel(racer: BoatExRacerEvidenceItem): string {
	if (racer.courseChangeEvidence.sourceStatus === "missing") return "source missing";
	const frameCount = racer.courseChangeEvidence.frameToFinalCourseChangedCount;
	const exhibitionCount = racer.courseChangeEvidence.exhibitionToFinalCourseChangedCount;
	return `frame ${frameCount ?? "unknown"} / exhibition ${exhibitionCount ?? "unknown"}`;
}

export function BoatExPage() {
	const [loadState, setLoadState] = useState<LoadState>({
		status: "loading",
		manifest: null,
		venueEvidence: null,
		racerEvidence: null,
		message: "EX evidence を確認しています。",
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

				const [venueResponse, racerResponse] = await Promise.all([
					fetch(withBasePath(`data/boatrace-ex/derived/venue-evidence/${latestHistory.date}.json`), {
						cache: "no-store",
					}),
					fetch(withBasePath(`data/boatrace-ex/derived/racer-evidence/${latestHistory.date}.json`), {
						cache: "no-store",
					}),
				]);

				if (!venueResponse.ok) throw new Error(`venue evidence fetch failed: ${venueResponse.status}`);
				if (!racerResponse.ok) throw new Error(`racer evidence fetch failed: ${racerResponse.status}`);

				const venueEvidence = await venueResponse.json() as BoatExVenueEvidenceFile;
				const racerEvidence = await racerResponse.json() as BoatExRacerEvidenceFile;

				if (isMounted) {
					setLoadState({
						status: "ready",
						manifest,
						venueEvidence,
						racerEvidence,
						message: "Phase 5 racer evidence v0 を表示しています。",
					});
				}
			} catch {
				if (isMounted) {
					setLoadState({
						status: "missing",
						manifest: null,
						venueEvidence: null,
						racerEvidence: null,
						message: "EX evidence 未取得",
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
	const latestDate = venueEvidence?.date ?? racerEvidence?.date ?? latestHistory?.date ?? "未取得";
	const records = venueEvidence?.summary.recordCount ?? "未取得";
	const venues = venueEvidence?.summary.venueCount ?? "未取得";
	const historyDays = venueEvidence?.summary.historyDays ?? racerEvidence?.summary.historyDays ?? "未取得";
	const analysisStatus = venueEvidence?.summary.analysisStatus ?? racerEvidence?.summary.analysisStatus ?? "pending";
	const topRacers = [...(racerEvidence?.racers ?? [])].slice(0, 50);

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
					<p style={textStyle}>source-backed evidence only。存在しない会場クセ、荒れ指数、選手特徴は補完しません。</p>
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
					<p style={textStyle}>venue-bias / racer-profile / predictionSignals は保留します。</p>
				</article>
			</section>

			<section style={cardStyle}>
				<p style={labelStyle}>SAFETY NOTE</p>
				<ul style={noteListStyle}>
					<li>fake補完は禁止です。未取得値は未取得、missing、pending、insufficient-historyとして表示します。</li>
					<li>1日分では選手特徴、進入変化、展示信用、ST傾向を断定しません。</li>
					<li>このページは Phase 3 history / coverage と Phase 4/5 derived evidence 由来の集計だけを表示します。</li>
				</ul>
			</section>

			<section style={{ ...cardStyle, gap: "14px" }}>
				<div>
					<p style={labelStyle}>VENUE EVIDENCE</p>
					<p style={valueStyle}>Phase 4 evidence v0</p>
				</div>
				{venueEvidence ? (
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
											最高 {yenLabel(venue.resultEvidence.maxTrifectaPayout)}
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
				) : (
					<p style={textStyle}>EX venue evidence 未取得。static値では埋めません。</p>
				)}
			</section>

			<section style={cardGridStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>RACERS</p>
					<p style={valueStyle}>{racerEvidence?.summary.racerCount ?? "未取得"}</p>
					<p style={textStyle}>racer evidence に集計された選手数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>APPEARANCES</p>
					<p style={valueStyle}>{racerEvidence?.summary.appearanceCount ?? "未取得"}</p>
					<p style={textStyle}>出走枠単位のsource-backed evidence数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>RACER STATUS</p>
					<p style={valueStyle}>{racerEvidence?.summary.analysisStatus ?? "pending"}</p>
					<p style={textStyle}>選手特徴は accumulated evidence が増えるまで断定しません。</p>
				</article>
			</section>

			<section style={cardStyle}>
				<p style={labelStyle}>RACER SAFETY NOTE</p>
				<ul style={noteListStyle}>
					<li>進入変化型、展示信用型、ST安定型などの確定ラベルは表示しません。</li>
					<li>final courseが無い場合、進入変化 evidence は source missing として表示します。</li>
					<li>predictionSignals は Phase 5 v0 では pending です。</li>
				</ul>
			</section>

			<section style={{ ...cardStyle, gap: "14px" }}>
				<div>
					<p style={labelStyle}>RACER EVIDENCE</p>
					<p style={valueStyle}>Phase 5 evidence v0</p>
				</div>
				{racerEvidence ? (
					<div style={tableWrapStyle}>
						<table style={{ ...tableStyle, minWidth: "1120px" }}>
							<thead>
								<tr>
									<th style={thStyle}>選手</th>
									<th style={thStyle}>登録番号</th>
									<th style={thStyle}>支部</th>
									<th style={thStyle}>級別</th>
									<th style={thStyle}>出走数</th>
									<th style={thStyle}>平均ST</th>
									<th style={thStyle}>展示平均</th>
									<th style={thStyle}>進入変化</th>
									<th style={thStyle}>着順Evidence</th>
									<th style={thStyle}>racerProfile</th>
									<th style={thStyle}>courseChange</th>
									<th style={thStyle}>warnings</th>
								</tr>
							</thead>
							<tbody>
								{topRacers.map((racer) => (
									<tr key={racer.racerKey}>
										<td style={tdStyle}>
											<strong>{racer.racerName}</strong>
											<br />
											<span>{racer.identityStatus}</span>
										</td>
										<td style={tdStyle}>{racer.registrationNumber ?? "未取得"}</td>
										<td style={tdStyle}>{racer.branch ?? "未取得"}</td>
										<td style={tdStyle}>{racer.className ?? "未取得"}</td>
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
				) : (
					<p style={textStyle}>EX racer evidence 未取得。static値では埋めません。</p>
				)}
			</section>

			{racerEvidence ? (
				<section style={cardGridStyle}>
					{topRacers.slice(0, 50).map((racer) => (
						<article key={`racer-card-${racer.racerKey}`} style={cardStyle}>
							<p style={labelStyle}>{racer.registrationNumber ?? racer.identityStatus}</p>
							<p style={valueStyle}>{racer.racerName}</p>
							<p style={textStyle}>支部/級別: {racer.branch ?? "未取得"} / {racer.className ?? "未取得"}</p>
							<p style={textStyle}>出走数: {racer.appearanceCount}</p>
							<p style={textStyle}>平均ST: {numberLabel(racer.startEvidence.averageST, 3)}</p>
							<p style={textStyle}>展示平均: {numberLabel(racer.exhibitionEvidence.averageExhibitionTime, 2)}</p>
							<p style={textStyle}>進入変化: {courseChangeLabel(racer)}</p>
							<p style={textStyle}>racerProfile: {racerReadinessLabel(racer, "racerProfile")}</p>
							<p style={textStyle}>courseChangePattern: {racerReadinessLabel(racer, "courseChangePattern")}</p>
							<p style={textStyle}>exhibitionReliability: {racerReadinessLabel(racer, "exhibitionReliability")}</p>
						</article>
					))}
				</section>
			) : null}
		</PageShell>
	);
}
