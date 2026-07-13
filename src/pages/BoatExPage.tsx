import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
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

type BoatExCoverage = {
	totals?: {
		venues?: number;
		races?: number;
	};
};

type LoadState = {
	status: "loading" | "ready" | "missing";
	manifest: BoatExManifest | null;
	coverage: BoatExCoverage | null;
	message: string;
};

const cardGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: "14px",
};

const cardStyle = {
	padding: "18px",
	borderRadius: "22px",
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
	letterSpacing: "0.12em",
	color: boatTheme.colors.aquaDeep,
	textTransform: "uppercase" as const,
};

const valueStyle = {
	margin: 0,
	fontSize: "1.18rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const textStyle = {
	margin: 0,
	lineHeight: 1.8,
	color: boatTheme.colors.muted,
};

const noteListStyle = {
	margin: 0,
	paddingLeft: "1.1rem",
	lineHeight: 1.8,
	color: boatTheme.colors.muted,
};

function findLatestHistoryFile(manifest: BoatExManifest | null): BoatExManifestFile | undefined {
	return [...(manifest?.files ?? [])]
		.filter((file) => file.kind === "history" && file.date)
		.sort((left, right) => String(right.date).localeCompare(String(left.date)))
		[0];
}

export function BoatExPage() {
	const [loadState, setLoadState] = useState<LoadState>({
		status: "loading",
		manifest: null,
		coverage: null,
		message: "EX manifest を確認しています。",
	});

	useEffect(() => {
		let isMounted = true;

		async function loadManifest() {
			try {
				const manifestResponse = await fetch(withBasePath("data/boatrace-ex/manifest.generated.json"), {
					cache: "no-store",
				});

				if (!manifestResponse.ok) {
					throw new Error(`manifest fetch failed: ${manifestResponse.status}`);
				}

				const manifest = await manifestResponse.json() as BoatExManifest;
				const latestHistory = findLatestHistoryFile(manifest);
				let coverage: BoatExCoverage | null = null;

				if (latestHistory?.date) {
					const coverageResponse = await fetch(withBasePath(`data/boatrace-ex/coverage/${latestHistory.date}.json`), {
						cache: "no-store",
					});

					if (coverageResponse.ok) {
						coverage = await coverageResponse.json() as BoatExCoverage;
					}
				}

				if (isMounted) {
					setLoadState({
						status: "ready",
						manifest,
						coverage,
						message: "Phase 3 history v0 を確認済みです。",
					});
				}
			} catch {
				if (isMounted) {
					setLoadState({
						status: "missing",
						manifest: null,
						coverage: null,
						message: "EX manifest 未取得",
					});
				}
			}
		}

		void loadManifest();

		return () => {
			isMounted = false;
		};
	}, []);

	const latestHistory = useMemo(() => findLatestHistoryFile(loadState.manifest), [loadState.manifest]);
	const latestDate = latestHistory?.date ?? "未取得";
	const records = loadState.coverage?.totals?.races ?? "未取得";
	const venues = loadState.coverage?.totals?.venues ?? "未取得";
	const hasManifest = loadState.status === "ready" && Boolean(loadState.manifest);

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
					<p style={textStyle}>
						未実装の派生分析を実装済みのようには表示しません。公式generated JSONから作ったPhase 3 history v0の存在だけを表示します。
					</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>LATEST DATE</p>
					<p style={valueStyle}>{latestDate}</p>
					<p style={textStyle}>manifest内の最新history dateです。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>RECORDS</p>
					<p style={valueStyle}>{records}</p>
					<p style={textStyle}>coverage totals の races 件数です。</p>
				</article>
				<article style={cardStyle}>
					<p style={labelStyle}>VENUES</p>
					<p style={valueStyle}>{venues}</p>
					<p style={textStyle}>coverage totals の venues 件数です。</p>
				</article>
			</section>

			<section style={cardStyle}>
				<p style={labelStyle}>NEXT PHASE</p>
				<p style={valueStyle}>Phase 4で追加予定</p>
				<ul style={noteListStyle}>
					<li>venue-bias</li>
					<li>rough-index</li>
					<li>today-flow</li>
					<li>predictionSignals</li>
				</ul>
			</section>

			<section style={cardStyle}>
				<p style={labelStyle}>SOURCE SAFETY</p>
				<ul style={noteListStyle}>
					<li>fake補完は禁止。存在しないデータは推測表示しません。</li>
					<li>history v0は公式generated JSON由来のsource-backed dataだけを扱います。</li>
					<li>{hasManifest ? "coverage / manifest を確認済みです。" : "coverage / manifest は未取得です。"}</li>
				</ul>
			</section>
		</PageShell>
	);
}
