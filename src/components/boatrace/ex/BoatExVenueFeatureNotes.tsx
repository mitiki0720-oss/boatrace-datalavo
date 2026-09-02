import { useEffect, useMemo, useState } from "react";
import { boatTheme } from "../../../lib/theme";
import {
	BOAT_VENUE_FEATURE_INSIGHTS_STORAGE_KEY,
	buildBoatVenueFeatureMaterial,
	loadBoatVenueFeatureIndex,
	loadBoatVenueFeatureNote,
	loadBoatVenueUserInsights,
	type BoatVenueFeatureIndex,
	type BoatVenueFeatureNote,
	type BoatVenueUserInsight,
} from "../../../lib/boatVenueFeatures";
import { BoatVenueFeatureMarkdown } from "../venueFeatures/BoatVenueFeatureMarkdown";

const shellStyle = {
	display: "grid",
	gap: "16px",
	minWidth: 0,
	maxWidth: "100%",
	paddingTop: "18px",
	borderTop: `1px solid ${boatTheme.colors.line}`,
};

const panelStyle = {
	display: "grid",
	gap: "12px",
	minWidth: 0,
	maxWidth: "100%",
	padding: "16px",
	borderRadius: "8px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(247, 253, 255, 0.88)",
};

const labelStyle = {
	margin: 0,
	fontSize: "0.78rem",
	fontWeight: 800,
	letterSpacing: "0.08em",
	color: boatTheme.colors.aquaDeep,
	textTransform: "uppercase" as const,
};

const titleStyle = {
	margin: 0,
	fontSize: "1.1rem",
	fontWeight: 850,
	color: boatTheme.colors.navy,
};

const textStyle = {
	margin: 0,
	lineHeight: 1.7,
	color: boatTheme.colors.muted,
	overflowWrap: "anywhere" as const,
};

const metadataStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "8px",
};

const chipStyle = {
	padding: "5px 8px",
	borderRadius: "6px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.9)",
	color: boatTheme.colors.ink,
	fontSize: "0.78rem",
};

const selectStyle = {
	width: "min(100%, 360px)",
	minHeight: "42px",
	padding: "8px 10px",
	borderRadius: "6px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "#fff",
	color: boatTheme.colors.ink,
	font: "inherit",
};

const summaryGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
	gap: "10px",
	minWidth: 0,
	maxWidth: "100%",
};

const materialStyle = {
	margin: 0,
	padding: "12px",
	maxHeight: "320px",
	overflow: "auto",
	whiteSpace: "pre-wrap" as const,
	wordBreak: "break-word" as const,
	borderRadius: "6px",
	background: "#102f44",
	color: "#e9faff",
	fontSize: "0.78rem",
	lineHeight: 1.65,
};

function formatDate(value: string | undefined): string {
	if (!value) return "未設定";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

function sectionSummary(note: BoatVenueFeatureNote | null, patterns: string[]): string {
	const section = note?.sections.find((item) => patterns.some((pattern) => item.title.includes(pattern)));
	return section?.body.replace(/\s+/g, " ").trim().slice(0, 260) || "該当セクションは未登録です。";
}

function insightText(insight: BoatVenueUserInsight | undefined): string {
	if (!insight) return "この会場のMY ANALYSISは未登録です。";
	return [
		insight.summary,
		...(insight.notes ?? []),
	].filter(Boolean).join(" / ");
}

export function BoatExVenueFeatureNotes() {
	const [index, setIndex] = useState<BoatVenueFeatureIndex | null>(null);
	const [selectedSlug, setSelectedSlug] = useState("");
	const [selectedNote, setSelectedNote] = useState<BoatVenueFeatureNote | null>(null);
	const [insights, setInsights] = useState<BoatVenueUserInsight[]>([]);
	const [copyStatus, setCopyStatus] = useState("");

	useEffect(() => {
		let cancelled = false;
		void loadBoatVenueFeatureIndex().then((loaded) => {
			if (cancelled) return;
			setIndex(loaded);
			const initial = loaded.items.find((item) => item.status === "ready") ?? loaded.items[0];
			setSelectedSlug(initial?.slug ?? "");
		});
		setInsights(loadBoatVenueUserInsights());
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		setSelectedNote(null);
		setCopyStatus("");
		if (selectedSlug) {
			void loadBoatVenueFeatureNote(selectedSlug, index).then((note) => {
				if (!cancelled) setSelectedNote(note);
			});
		}
		return () => {
			cancelled = true;
		};
	}, [index, selectedSlug]);

	const selectedItem = index?.items.find((item) => item.slug === selectedSlug) ?? null;
	const selectedInsights = useMemo(
		() => insights.filter((item) => item.venueName === selectedItem?.venueName),
		[insights, selectedItem?.venueName],
	);
	const material = useMemo(() => buildBoatVenueFeatureMaterial(selectedNote, { maxLength: 1800 }), [selectedNote]);
	const summaries = [
		["基本特徴", ["基本", "スペック", "まとめ"]],
		["コース / 進入", ["コース", "進入"]],
		["水面 / 風 / 波", ["水面", "風", "波"]],
		["展示チェック", ["展示"]],
	] as const;

	const copyMaterial = async () => {
		if (!material) return;
		try {
			await navigator.clipboard.writeText(material);
			setCopyStatus("Prediction素材をコピーしました。");
		} catch {
			setCopyStatus("コピーできませんでした。素材プレビューから選択してください。");
		}
	};

	return (
		<section style={shellStyle} aria-label="会場特徴ノート">
			<div>
				<p style={labelStyle}>会場特徴ノート</p>
				<h3 style={titleStyle}>手入力ノートとPrediction連携素材</h3>
				<p style={textStyle}>EX統計とは別のmanual-noteです。水面・風・コース傾向と自分分析を混同せず表示します。</p>
			</div>

			<section style={panelStyle}>
				<label htmlFor="boat-ex-venue-feature" style={labelStyle}>会場選択</label>
				<select id="boat-ex-venue-feature" value={selectedSlug} onChange={(event) => setSelectedSlug(event.target.value)} style={selectStyle}>
					{(index?.items ?? []).map((item) => (
						<option key={item.slug} value={item.slug}>{item.venueName} / {item.status ?? "unknown"}</option>
					))}
				</select>
				{index?.warnings?.length ? <p style={textStyle}>{index.warnings.join(" / ")}</p> : null}
				<div style={metadataStyle}>
					<span style={chipStyle}>{selectedItem?.waterType || "water type 未設定"}</span>
					<span style={chipStyle}>source: {selectedItem?.sourceType ?? "未設定"}</span>
					<span style={chipStyle}>updated: {formatDate(selectedItem?.updatedAt)}</span>
					{(selectedItem?.tags ?? []).map((tag) => <span key={tag} style={chipStyle}>{tag}</span>)}
				</div>
				<p style={textStyle}>{selectedNote?.excerpt || selectedItem?.excerpt || "Markdownノートは未登録です。"}</p>
			</section>

			<div style={summaryGridStyle}>
				{summaries.map(([title, patterns]) => (
					<section key={title} style={panelStyle}>
						<p style={labelStyle}>{title}</p>
						<p style={textStyle}>{sectionSummary(selectedNote, [...patterns])}</p>
					</section>
				))}
			</div>

			<section style={panelStyle}>
				<p style={labelStyle}>Full Markdown</p>
				<h3 style={titleStyle}>{selectedItem?.title ?? "会場特徴ノート"}</h3>
				{selectedNote ? <BoatVenueFeatureMarkdown markdown={selectedNote.markdown} /> : <p style={textStyle}>Markdownノートは未登録です。</p>}
			</section>

			<section style={{ ...panelStyle, borderLeft: `4px solid ${boatTheme.colors.mint}` }}>
				<p style={labelStyle}>MY ANALYSIS / USER INSIGHT</p>
				<h3 style={titleStyle}>自分分析はmanual-noteと分離</h3>
				<p style={textStyle}>{insightText(selectedInsights[0])}</p>
				<p style={textStyle}>登録件数: {selectedInsights.length} / source: localStorage `{BOAT_VENUE_FEATURE_INSIGHTS_STORAGE_KEY}`</p>
			</section>

			<details style={panelStyle}>
				<summary style={{ ...titleStyle, cursor: "pointer" }}>Prediction material preview</summary>
				<pre style={materialStyle}>{material || "会場特徴ノートは未登録です。"}</pre>
				<button type="button" onClick={copyMaterial} disabled={!material} style={{ ...selectStyle, width: "fit-content", cursor: material ? "pointer" : "not-allowed", fontWeight: 800 }}>
					素材をコピー
				</button>
				{copyStatus ? <p style={textStyle}>{copyStatus}</p> : null}
			</details>
		</section>
	);
}
