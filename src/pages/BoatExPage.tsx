import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import type {
	BoatExDateIndexEntry,
	BoatExDateIndexFile,
	BoatExRacerEvidenceFile,
	BoatExRacerEvidenceItem,
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
	message: string;
};

const sectionCards: Array<{
	key: BoatExSectionKey;
	title: string;
	subtitle: string;
	status: "ready" | "available" | "pending" | "insufficient-history";
}> = [
	{ key: "overview", title: "OVERVIEW", subtitle: "Whole summary", status: "ready" },
	{ key: "identity", title: "IDENTITY", subtitle: "Racer source", status: "available" },
	{ key: "data-coverage", title: "DATA COVERAGE", subtitle: "Auto update / source", status: "available" },
	{ key: "trend-lab", title: "TREND LAB", subtitle: "Roadmap data", status: "pending" },
	{ key: "trifecta-ranking", title: "Trifecta Ranking", subtitle: "3-ren-tan v1", status: "pending" },
	{ key: "rough-index", title: "Rough Index", subtitle: "Result return v1", status: "insufficient-history" },
	{ key: "race-transition", title: "Race Transition", subtitle: "Transition v1", status: "pending" },
	{ key: "weather", title: "WEATHER", subtitle: "Wind / wave facts", status: "available" },
	{ key: "venue-bias", title: "Venue Bias", subtitle: "Venue bias v1", status: "insufficient-history" },
	{ key: "today-flow", title: "Today Flow", subtitle: "Today flow meter v1", status: "insufficient-history" },
	{ key: "prediction-structure", title: "Prediction Structure LAB", subtitle: "Coverage map v1", status: "pending" },
	{ key: "ex-analysis", title: "EX ANALYSIS", subtitle: "Venue / racer matchup", status: "pending" },
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
	return status || "unknown";
}

function countLabel(value: number | undefined, total: number): string {
	return `${value ?? 0}/${total}`;
}

function numberLabel(value: number | null | undefined, digits = 2): string {
	if (typeof value !== "number") return "missing";
	return value.toFixed(digits).replace(/\.?0+$/u, "");
}

function yenLabel(value: number | null | undefined): string {
	if (typeof value !== "number") return "missing";
	return `${value.toLocaleString("ja-JP")} yen`;
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

function hasDerivedFile(manifest: BoatExManifest | null, part: string): boolean {
	return (manifest?.files ?? []).some((file) => String(file.path ?? "").includes(part));
}

function findDateIndexEntry(dateIndex: BoatExDateIndexFile | null, date: string): BoatExDateIndexEntry | undefined {
	return dateIndex?.dates.find((entry) => entry.date === date);
}

function readinessLabel(entry: BoatExDateIndexEntry | undefined, key: keyof BoatExDateIndexEntry["readiness"]): string {
	return entry?.readiness?.[key] ?? "index missing";
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
				<p style={labelStyle}>STATUS</p>
				<p style={valueStyle}>{status}</p>
				<p style={textStyle}>{reason}</p>
			</article>
			<article style={cardStyle}>
				<p style={labelStyle}>SOURCE POLICY</p>
				<p style={valueStyle}>{source ?? "source-backed only"}</p>
				<p style={textStyle}>No fake score, no inferred ranking, and no high-confidence label is shown in this phase.</p>
			</article>
		</section>
	);
}

function VenueEvidenceSection({ venueEvidence }: { venueEvidence: BoatExVenueEvidenceFile | null }) {
	if (!venueEvidence) return <p style={textStyle}>EX venue evidence missing. Static fallback values are not used.</p>;

	return (
		<>
			<div style={tableWrapStyle}>
				<table style={tableStyle}>
					<thead>
						<tr>
							<th style={thStyle}>Venue</th>
							<th style={thStyle}>Races</th>
							<th style={thStyle}>Result</th>
							<th style={thStyle}>Exhibition</th>
							<th style={thStyle}>Weather</th>
							<th style={thStyle}>Payout</th>
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
									Average {yenLabel(venue.resultEvidence.averageTrifectaPayout)}
									<br />
									Max {yenLabel(venue.resultEvidence.maxTrifectaPayout)}
								</td>
								<td style={tdStyle}>{venueReadinessLabel(venue, "venueBias")}</td>
								<td style={tdStyle}>{venueReadinessLabel(venue, "roughIndex")}</td>
								<td style={tdStyle}>{venueReadinessLabel(venue, "todayFlow")}</td>
								<td style={tdStyle}>{venue.warnings.length > 0 ? venue.warnings.join(" / ") : "none"}</td>
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
						<p style={textStyle}>Races: {venue.raceCount}</p>
						<p style={textStyle}>Result: {countLabel(venue.availability.officialResultCount, venue.raceCount)}</p>
						<p style={textStyle}>Exhibition: {countLabel(venue.availability.officialExhibitionCount, venue.raceCount)}</p>
						<p style={textStyle}>Weather: {countLabel(venue.availability.weatherCount, venue.raceCount)}</p>
						<p style={textStyle}>venueBias: {venueReadinessLabel(venue, "venueBias")}</p>
					</article>
				))}
			</section>
		</>
	);
}

function RacerEvidenceSection({ racerEvidence }: { racerEvidence: BoatExRacerEvidenceFile | null }) {
	if (!racerEvidence) return <p style={textStyle}>EX racer evidence missing. Static fallback values are not used.</p>;
	const topRacers = racerEvidence.racers.slice(0, 50);

	return (
		<>
			<div style={tableWrapStyle}>
				<table style={{ ...tableStyle, minWidth: "1460px" }}>
					<thead>
						<tr>
							<th style={thStyle}>Racer</th>
							<th style={thStyle}>Reg no.</th>
							<th style={thStyle}>Branch</th>
							<th style={thStyle}>Class</th>
							<th style={thStyle}>Starts</th>
							<th style={thStyle}>Avg ST</th>
							<th style={thStyle}>Avg exhibition</th>
							<th style={thStyle}>Course change</th>
							<th style={thStyle}>Result evidence</th>
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
								<td style={tdStyle}>{racer.registrationNumber ?? "missing"}</td>
								<td style={tdStyle}>{racer.branch ?? "missing"}</td>
								<td style={tdStyle}>{racer.className ?? "missing"}</td>
								<td style={tdStyle}>{racer.appearanceCount}</td>
								<td style={tdStyle}>{numberLabel(racer.startEvidence.averageST, 3)}</td>
								<td style={tdStyle}>{numberLabel(racer.exhibitionEvidence.averageExhibitionTime, 2)}</td>
								<td style={tdStyle}>{courseChangeLabel(racer)}</td>
								<td style={tdStyle}>
									Results {racer.resultEvidence.availableCount}
									<br />
									Win {racer.resultEvidence.winCount} / Top3 {racer.resultEvidence.top3Count}
								</td>
								<td style={tdStyle}>{racerReadinessLabel(racer, "racerProfile")}</td>
								<td style={tdStyle}>{racerReadinessLabel(racer, "courseChangePattern")}</td>
								<td style={tdStyle}>{racer.warnings.length > 0 ? racer.warnings.join(" / ") : "none"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<section style={{ ...cardGridStyle, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
				{topRacers.map((racer) => (
					<article key={`racer-card-${racer.racerKey}`} style={cardStyle}>
						<p style={labelStyle}>{racer.registrationNumber ?? racer.identityStatus}</p>
						<p style={valueStyle}>{racer.racerName}</p>
						<p style={textStyle}>Branch / class: {racer.branch ?? "missing"} / {racer.className ?? "missing"}</p>
						<p style={textStyle}>Starts: {racer.appearanceCount}</p>
						<p style={textStyle}>Average ST: {numberLabel(racer.startEvidence.averageST, 3)}</p>
						<p style={textStyle}>Average exhibition: {numberLabel(racer.exhibitionEvidence.averageExhibitionTime, 2)}</p>
						<p style={textStyle}>Course change: {courseChangeLabel(racer)}</p>
						<p style={textStyle}>racerProfile: {racerReadinessLabel(racer, "racerProfile")}</p>
						<p style={textStyle}>courseChangePattern: {racerReadinessLabel(racer, "courseChangePattern")}</p>
						<p style={textStyle}>exhibitionReliability: {racerReadinessLabel(racer, "exhibitionReliability")}</p>
					</article>
				))}
			</section>
		</>
	);
}

function WeatherSection({ venueEvidence }: { venueEvidence: BoatExVenueEvidenceFile | null }) {
	if (!venueEvidence) return <p style={textStyle}>Weather evidence missing. Static fallback values are not used.</p>;

	return (
		<div style={tableWrapStyle}>
			<table style={{ ...tableStyle, minWidth: "1180px" }}>
				<thead>
					<tr>
						<th style={thStyle}>Venue</th>
						<th style={thStyle}>Weather count</th>
						<th style={thStyle}>Wind avg</th>
						<th style={thStyle}>Wind max</th>
						<th style={thStyle}>Wave avg</th>
						<th style={thStyle}>Wave max</th>
						<th style={thStyle}>Status</th>
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

export function BoatExPage() {
	const [activeSection, setActiveSection] = useState<BoatExSectionKey>("overview");
	const [loadState, setLoadState] = useState<LoadState>({
		status: "loading",
		manifest: null,
		derivedManifest: null,
		dateIndex: null,
		venueEvidence: null,
		racerEvidence: null,
		message: "Checking EX evidence.",
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

				const [derivedManifestResponse, venueResponse, racerResponse] = await Promise.all([
					fetch(withBasePath("data/boatrace-ex/derived/manifest.generated.json"), { cache: "no-store" }),
					fetch(withBasePath(`data/boatrace-ex/derived/venue-evidence/${targetDate}.json`), {
						cache: "no-store",
					}),
					fetch(withBasePath(`data/boatrace-ex/derived/racer-evidence/${targetDate}.json`), {
						cache: "no-store",
					}),
				]);

				if (!derivedManifestResponse.ok) throw new Error(`derived manifest fetch failed: ${derivedManifestResponse.status}`);
				if (!venueResponse.ok) throw new Error(`venue evidence fetch failed: ${venueResponse.status}`);
				if (!racerResponse.ok) throw new Error(`racer evidence fetch failed: ${racerResponse.status}`);

				const derivedManifest = await derivedManifestResponse.json() as BoatExManifest;
				const venueEvidence = await venueResponse.json() as BoatExVenueEvidenceFile;
				const racerEvidence = await racerResponse.json() as BoatExRacerEvidenceFile;

				if (isMounted) {
					setLoadState({
						status: "ready",
						manifest,
						derivedManifest,
						dateIndex,
						venueEvidence,
						racerEvidence,
						message: indexMissing ? "EX date index missing. Using manifest latest date." : "EX section navigation is ready.",
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
						message: "EX evidence missing.",
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
	const latestDate = loadState.dateIndex?.latestDate ?? venueEvidence?.date ?? racerEvidence?.date ?? latestHistory?.date ?? "missing";
	const dateIndexEntry = findDateIndexEntry(loadState.dateIndex, latestDate);
	const availableDateCount = loadState.dateIndex?.summary.dateCount ?? "index missing";
	const availableDates = loadState.dateIndex?.availableDates.join(", ") || "index missing";
	const records = venueEvidence?.summary.recordCount ?? "missing";
	const venues = venueEvidence?.summary.venueCount ?? "missing";
	const historyDays = venueEvidence?.summary.historyDays ?? racerEvidence?.summary.historyDays ?? "missing";
	const analysisStatus = venueEvidence?.summary.analysisStatus ?? racerEvidence?.summary.analysisStatus ?? "pending";
	const derivedManifestFiles = loadState.derivedManifest?.files?.length ?? "missing";
	const venueEvidenceAvailable = hasDerivedFile(loadState.derivedManifest, "/venue-evidence/");
	const racerEvidenceAvailable = hasDerivedFile(loadState.derivedManifest, "/racer-evidence/");

	function renderActiveSection() {
		switch (activeSection) {
			case "overview":
				return (
					<SectionShell title="Overview" subtitle="Whole summary">
						<section style={metricGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>LATEST DATE</p>
								<p style={metricValueStyle}>{latestDate}</p>
								<p style={textStyle}>Latest date from the Phase 6A date index, with manifest fallback.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>AVAILABLE DATES</p>
								<p style={metricValueStyle}>{availableDateCount}</p>
								<p style={textStyle}>{availableDates}</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>RECORDS</p>
								<p style={metricValueStyle}>{records}</p>
								<p style={textStyle}>History race records used by derived evidence.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>VENUES</p>
								<p style={metricValueStyle}>{venues}</p>
								<p style={textStyle}>Venue evidence count.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>RACERS</p>
								<p style={metricValueStyle}>{racerEvidence?.summary.racerCount ?? "missing"}</p>
								<p style={textStyle}>Racer evidence count.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>APPEARANCES</p>
								<p style={metricValueStyle}>{racerEvidence?.summary.appearanceCount ?? "missing"}</p>
								<p style={textStyle}>Source-backed racer appearances.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>DERIVED FILES</p>
								<p style={metricValueStyle}>{derivedManifestFiles}</p>
								<p style={textStyle}>Derived manifest entries.</p>
							</article>
						</section>
						<section style={cardGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>SAFETY NOTE</p>
								<ul style={noteListStyle}>
									<li>Source-backed evidence only.</li>
									<li>No fake completion, no fake score, and no inferred ranking.</li>
									<li>One history day means analysis remains {analysisStatus}.</li>
								</ul>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>PHASE 6A READINESS</p>
								<ul style={noteListStyle}>
									<li>Multi-day analysis: {readinessLabel(dateIndexEntry, "multiDayAnalysis")}</li>
									<li>Venue bias scoring: {readinessLabel(dateIndexEntry, "venueBias")}</li>
									<li>Racer profile scoring: {readinessLabel(dateIndexEntry, "racerProfile")}</li>
									<li>Prediction signals: {readinessLabel(dateIndexEntry, "predictionSignals")}</li>
								</ul>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>DAILY PIPELINE</p>
								<p style={valueStyle}>manual runner ready</p>
								<ul style={noteListStyle}>
									<li>date index: {loadState.dateIndex ? "available" : "EX date index missing"}</li>
									<li>latestDate: {latestDate}</li>
									<li>dateCount: {availableDateCount}</li>
									<li>next: workflow integration pending</li>
								</ul>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>PC DASHBOARD</p>
								<p style={valueStyle}>desktop-first layout</p>
								<p style={textStyle}>Cards, tables, and section content use wider grid tracks so the EX page reads as a dense desktop analysis dashboard.</p>
							</article>
						</section>
					</SectionShell>
				);
			case "identity":
				return (
					<SectionShell title="Identity" subtitle="Racer source">
						<section style={metricGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>RACERS</p>
								<p style={metricValueStyle}>{racerEvidence?.summary.racerCount ?? "missing"}</p>
								<p style={textStyle}>Registration numbers are used as primary keys when present.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>APPEARANCES</p>
								<p style={metricValueStyle}>{racerEvidence?.summary.appearanceCount ?? "missing"}</p>
								<p style={textStyle}>Racer-profile, ST, and exhibition labels remain insufficient-history.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>COURSE CHANGE</p>
								<p style={metricValueStyle}>source-backed</p>
								<p style={textStyle}>Final-course gaps are shown as source missing, not as a pattern.</p>
							</article>
						</section>
						<RacerEvidenceSection racerEvidence={racerEvidence} />
					</SectionShell>
				);
			case "data-coverage":
				return (
					<SectionShell title="Data Coverage" subtitle="Auto update / source">
						<section style={metricGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>HISTORY RECORDS</p>
								<p style={metricValueStyle}>{records}</p>
								<p style={textStyle}>Phase 3 history source.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>DATE INDEX</p>
								<p style={metricValueStyle}>{loadState.dateIndex ? "available" : "missing"}</p>
								<p style={textStyle}>latestDate {latestDate} / dateCount {availableDateCount}</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>DAILY PIPELINE</p>
								<p style={metricValueStyle}>manual</p>
								<p style={textStyle}>Runner is ready. Workflow integration is pending.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>VENUE EVIDENCE</p>
								<p style={metricValueStyle}>{venueEvidenceAvailable ? "available" : "missing"}</p>
								<p style={textStyle}>Phase 4 derived evidence.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>RACER EVIDENCE</p>
								<p style={metricValueStyle}>{racerEvidenceAvailable ? "available" : "missing"}</p>
								<p style={textStyle}>Phase 5 derived evidence.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>DERIVED MANIFEST</p>
								<p style={metricValueStyle}>{derivedManifestFiles}</p>
								<p style={textStyle}>Expected entries include venue evidence and racer evidence.</p>
							</article>
						</section>
						<section style={cardStyle}>
							<p style={labelStyle}>SOURCE FILES</p>
							<ul style={noteListStyle}>
								<li>date index: {loadState.dateIndex ? "available" : "EX date index missing"}</li>
								{(loadState.derivedManifest?.sourceFiles ?? []).map((source) => (
									<li key={`${source.sourceName}-${source.sourcePath}`}>
										{source.sourceName}: {source.sourceStatus} / {source.coverageStatus}
									</li>
								))}
							</ul>
						</section>
					</SectionShell>
				);
			case "trend-lab":
				return (
					<SectionShell title="Trend Lab" subtitle="Roadmap data">
						<PendingPanel
							status="pending"
							reason="Trend lab requires multi-day history accumulation before score, trend, or signal generation."
							source="Phase 6: multi-day history, Phase 7: venue bias, Phase 8: rough index, Phase 9: today flow, Phase 10: prediction signals."
						/>
					</SectionShell>
				);
			case "trifecta-ranking":
				return (
					<SectionShell title="Trifecta Ranking" subtitle="3-ren-tan v1">
						<PendingPanel
							status="pending"
							reason="Trifecta ranking will be generated after multi-day officialResult.trifecta and payout accumulation."
							source="Planned source: officialResult.trifecta / payout / raceKey."
						/>
					</SectionShell>
				);
			case "rough-index":
				return (
					<SectionShell title="Rough Index" subtitle="Result return v1">
						<PendingPanel
							status="insufficient-history"
							reason="Roughness scoring needs multi-day result and payout validation. One history day is not enough."
						/>
					</SectionShell>
				);
			case "race-transition":
				return (
					<SectionShell title="Race Transition" subtitle="Transition v1">
						<PendingPanel
							status="pending"
							reason="Race-to-race transitions and repeated inside/outside patterns are planned for a later validated phase."
						/>
					</SectionShell>
				);
			case "weather":
				return (
					<SectionShell title="Weather" subtitle="Wind / wave facts">
						<WeatherSection venueEvidence={venueEvidence} />
					</SectionShell>
				);
			case "venue-bias":
				return (
					<SectionShell title="Venue Bias" subtitle="Venue bias v1">
						<PendingPanel
							status="insufficient-history"
							reason="Venue bias is not confirmed from one history day. The table below shows source-backed venue evidence only."
						/>
						<VenueEvidenceSection venueEvidence={venueEvidence} />
					</SectionShell>
				);
			case "today-flow":
				return (
					<SectionShell title="Today Flow" subtitle="Today flow meter v1">
						<PendingPanel
							status="insufficient-history"
							reason="Today flow meter requires same-day sequence rules plus validated result, exhibition, and weather changes."
						/>
					</SectionShell>
				);
			case "prediction-structure":
				return (
					<SectionShell title="Prediction Structure LAB" subtitle="Coverage map v1">
						<section style={cardGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>OFFICIAL</p>
								<p style={valueStyle}>available / partial</p>
								<p style={textStyle}>Race, result, exhibition, weather, motor, boat, and racer fields are represented through history and evidence files.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>USER SOURCES</p>
								<p style={valueStyle}>not-supported</p>
								<p style={textStyle}>Prediction, summary, and review archives are not read in this EX phase.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>SIGNALS</p>
								<p style={valueStyle}>pending</p>
								<p style={textStyle}>Prediction signals are scheduled for a later phase.</p>
							</article>
						</section>
					</SectionShell>
				);
			case "ex-analysis":
				return (
					<SectionShell title="EX Analysis" subtitle="Venue / racer matchup">
						<section style={cardGridStyle}>
							<article style={cardStyle}>
								<p style={labelStyle}>VENUE EVIDENCE</p>
								<p style={valueStyle}>{venueEvidenceAvailable ? "available" : "missing"}</p>
								<p style={textStyle}>Venue table is source-backed and keeps venueBias insufficient-history.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>RACER EVIDENCE</p>
								<p style={valueStyle}>{racerEvidenceAvailable ? "available" : "missing"}</p>
								<p style={textStyle}>Racer table is source-backed and keeps racerProfile insufficient-history.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>COURSE CHANGE</p>
								<p style={valueStyle}>source-backed only</p>
								<p style={textStyle}>When final course is missing, course-change evidence is displayed as source missing.</p>
							</article>
							<article style={cardStyle}>
								<p style={labelStyle}>NEXT</p>
								<p style={valueStyle}>pending</p>
								<p style={textStyle}>Matchup analysis, prediction signals, and review diffs are later phases.</p>
							</article>
						</section>
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
			description="BOATRACE EX DATA LABO / source-backed analysis"
			contentMaxWidth="1880px"
			contentPaddingInline="24px"
			heroMaxWidth="1880px"
		>
			<section style={dashboardRowStyle}>
				<article style={cardStyle}>
					<p style={labelStyle}>STATUS</p>
					<p style={valueStyle}>{loadState.message}</p>
					<p style={textStyle}>
						Use the cards below to switch sections inside this EX page. The URL hash route stays unchanged.
					</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>DATE</p>
					<p style={metricValueStyle}>{latestDate}</p>
					<p style={textStyle}>{loadState.dateIndex ? "latest index" : "manifest fallback"}</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>DATES</p>
					<p style={metricValueStyle}>{availableDateCount}</p>
					<p style={textStyle}>available dates</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>RECORDS</p>
					<p style={metricValueStyle}>{records}</p>
					<p style={textStyle}>source-backed</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>RACERS</p>
					<p style={metricValueStyle}>{racerEvidence?.summary.racerCount ?? "missing"}</p>
					<p style={textStyle}>identity evidence</p>
				</article>
			</section>

			<section style={sectionMenuStyle} aria-label="BOATRACE EX sections">
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
							<p style={labelStyle}>{section.status}</p>
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
