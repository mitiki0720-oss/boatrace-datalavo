import { useEffect, useMemo, useState } from "react";
import { BoatVenueFeatureMarkdown } from "../components/boatrace/venueFeatures/BoatVenueFeatureMarkdown";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import {
	BOAT_VENUE_FEATURE_INSIGHTS_STORAGE_KEY,
	BOAT_VENUE_FEATURE_VENUES,
	buildBoatVenueFeatureMaterial,
	loadBoatVenueFeatureIndex,
	loadBoatVenueFeatureNote,
	loadBoatVenueUserInsights,
	type BoatVenueFeatureIndex,
	type BoatVenueFeatureItem,
	type BoatVenueFeatureNote,
	type BoatVenueFeatureStatus,
	type BoatVenueUserInsight,
} from "../lib/boatVenueFeatures";

type NoteViewMode = "summary" | "markdown" | "material";
type SortMode = "venue" | "updated" | "ready";

const venueFeaturesBackgroundUrl = withBasePath(
	"venue-features-page/backgrounds/venue-features-bg-water-analytics.png",
);

const statusText: Record<BoatVenueFeatureStatus, string> = {
	ready: "ready",
	draft: "draft",
	missing: "missing",
};

const waterOptions = ["淡水", "海水", "汽水", "不明"];

const toStatus = (value: string | undefined): BoatVenueFeatureStatus =>
	value === "ready" || value === "draft" || value === "missing" ? value : "missing";

const normalize = (value: string): string => value.replace(/\s+/g, "").toLowerCase();

const formatDate = (value: string | undefined): string => {
	if (!value) {
		return "更新日なし";
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
};

function mergeVenueItems(index: BoatVenueFeatureIndex | null): BoatVenueFeatureItem[] {
	const sourceItems = index?.items ?? [];
	const bySlug = new Map(sourceItems.map((item) => [item.slug, item]));
	const baseItems = BOAT_VENUE_FEATURE_VENUES.map((venue) => {
		const item = bySlug.get(venue.slug);
		return item ?? {
			venueName: venue.venueName,
			slug: venue.slug,
			title: `${venue.venueName}競艇場｜予想用会場特徴ノート`,
			file: "",
			status: "missing" as const,
			sourceType: "manual-note" as const,
			tags: [],
			waterType: "不明",
			excerpt: "Markdownノートを追加すると、ここに会場特徴の要約が表示されます。",
		};
	});
	const extraItems = sourceItems.filter((item) => !BOAT_VENUE_FEATURE_VENUES.some((venue) => venue.slug === item.slug));
	return [...baseItems, ...extraItems];
}

function getVenueOrder(slug: string): number {
	const index = BOAT_VENUE_FEATURE_VENUES.findIndex((venue) => venue.slug === slug);
	return index === -1 ? 999 : index;
}

function sortItems(items: BoatVenueFeatureItem[], sortMode: SortMode): BoatVenueFeatureItem[] {
	const readyRank = (item: BoatVenueFeatureItem) => toStatus(item.status) === "ready" ? 0 : toStatus(item.status) === "draft" ? 1 : 2;
	return [...items].sort((left, right) => {
		if (sortMode === "updated") {
			return new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime();
		}
		if (sortMode === "ready") {
			return readyRank(left) - readyRank(right) || getVenueOrder(left.slug) - getVenueOrder(right.slug);
		}
		return getVenueOrder(left.slug) - getVenueOrder(right.slug);
	});
}

function getSectionText(note: BoatVenueFeatureNote | null, patterns: string[], maxLength = 180): string {
	if (!note) {
		return "";
	}

	const section = note.sections.find((item) => patterns.some((pattern) => item.title.includes(pattern)));
	return section?.body.replace(/\s+/g, " ").trim().slice(0, maxLength) ?? "";
}

function getInsightRows(insights: BoatVenueUserInsight[], venueName: string): BoatVenueUserInsight[] {
	return insights.filter((item) => item.venueName === venueName);
}

function SpotlightImage({ slug, venueName, className }: { slug: string; venueName: string; className: string }) {
	const [failed, setFailed] = useState(false);
	const src = withBasePath(`races-page/venue-spotlights/${slug}-spotlight.png`);

	return (
		<div className={`${className} ${failed ? "is-fallback" : ""}`}>
			{failed ? (
				<div className="venue-features-image-fallback">
					<span>{venueName}</span>
				</div>
			) : (
				<img src={src} alt={`${venueName}の会場イメージ`} onError={() => setFailed(true)} />
			)}
		</div>
	);
}

export function VenueFeaturesPage() {
	const [index, setIndex] = useState<BoatVenueFeatureIndex | null>(null);
	const [selectedSlug, setSelectedSlug] = useState("biwako");
	const [selectedNote, setSelectedNote] = useState<BoatVenueFeatureNote | null>(null);
	const [query, setQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<BoatVenueFeatureStatus | "all">("all");
	const [waterFilter, setWaterFilter] = useState("all");
	const [tagFilter, setTagFilter] = useState("all");
	const [sortMode, setSortMode] = useState<SortMode>("venue");
	const [noteView, setNoteView] = useState<NoteViewMode>("summary");
	const [copyMessage, setCopyMessage] = useState("");
	const [insights, setInsights] = useState<BoatVenueUserInsight[]>([]);

	useEffect(() => {
		let cancelled = false;
		loadBoatVenueFeatureIndex().then((loadedIndex) => {
			if (cancelled) {
				return;
			}
			setIndex(loadedIndex);
			const firstReady = loadedIndex.items.find((item) => toStatus(item.status) === "ready");
			if (firstReady) {
				setSelectedSlug(firstReady.slug);
			}
		});
		setInsights(loadBoatVenueUserInsights());
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		setSelectedNote(null);
		setCopyMessage("");
		loadBoatVenueFeatureNote(selectedSlug, index).then((note) => {
			if (!cancelled) {
				setSelectedNote(note);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [index, selectedSlug]);

	const items = useMemo(() => mergeVenueItems(index), [index]);
	const selectedItem = items.find((item) => item.slug === selectedSlug) ?? items[0];
	const selectedStatus = toStatus(selectedItem?.status);
	const readyCount = items.filter((item) => toStatus(item.status) === "ready").length;
	const draftCount = items.filter((item) => toStatus(item.status) === "draft").length;
	const missingCount = items.filter((item) => toStatus(item.status) === "missing").length;
	const selectedInsights = useMemo(() => getInsightRows(insights, selectedItem?.venueName ?? ""), [insights, selectedItem]);
	const materialPreview = useMemo(() => buildBoatVenueFeatureMaterial(selectedNote, { maxLength: 1800 }), [selectedNote]);
	const tags = useMemo(() => Array.from(new Set(items.flatMap((item) => item.tags ?? []))).sort((left, right) => left.localeCompare(right, "ja")), [items]);
	const waterTypes = useMemo(() => {
		const values = new Set([...waterOptions, ...items.map((item) => item.waterType || "不明")]);
		return Array.from(values);
	}, [items]);
	const importantPoints = useMemo(() => [
		getSectionText(selectedNote, ["基本", "スペック", "まとめ"]),
		getSectionText(selectedNote, ["コース", "進入"]),
		getSectionText(selectedNote, ["水面", "風", "波"]),
		getSectionText(selectedNote, ["展示"]),
	].filter(Boolean), [selectedNote]);

	const filteredItems = useMemo(() => {
		const normalizedQuery = normalize(query);
		const filtered = items.filter((item) => {
			const status = toStatus(item.status);
			const waterType = item.waterType || "不明";
			const searchable = normalize(`${item.venueName} ${item.slug} ${item.title ?? ""} ${(item.tags ?? []).join(" ")} ${item.excerpt ?? ""}`);
			return (!normalizedQuery || searchable.includes(normalizedQuery)) &&
				(statusFilter === "all" || status === statusFilter) &&
				(waterFilter === "all" || waterType === waterFilter) &&
				(tagFilter === "all" || (item.tags ?? []).includes(tagFilter));
		});
		return sortItems(filtered, sortMode);
	}, [items, query, sortMode, statusFilter, tagFilter, waterFilter]);

	const handleCopyMaterial = async () => {
		if (!materialPreview) {
			return;
		}

		try {
			await navigator.clipboard.writeText(materialPreview);
			setCopyMessage("Prediction素材をコピーしました");
		} catch {
			setCopyMessage("コピーできませんでした。素材プレビューから選択してコピーしてください。");
		}
	};

	return (
		<PageShell
			eyebrow="VENUE FEATURES"
			title="会場特徴ノート / 予想用データベース"
			description="水面・風・コース傾向・展示チェックを、予想前に確認するための会場分析ノートです。"
			contentMaxWidth="2040px"
			contentPaddingInline="36px"
			heroMaxWidth="2040px"
			hideHero
		>
			<style>
				{`

#root:has(.venue-features-root) {
  position: relative;
  min-height: 100vh;
  background: transparent;
}

#root:has(.venue-features-root)::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(180deg, rgba(245, 253, 255, 0.20), rgba(236, 248, 255, 0.42)),
    radial-gradient(circle at 12% 10%, rgba(191, 244, 255, 0.24), transparent 34%),
    radial-gradient(circle at 88% 14%, rgba(226, 214, 255, 0.22), transparent 34%),
    url("${venueFeaturesBackgroundUrl}");
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}

#root:has(.venue-features-root)::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(245, 253, 255, 0.24), transparent 20%, transparent 80%, rgba(245, 253, 255, 0.24)),
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.18), transparent 44%);
}

.venue-features-root {
  position: relative;
  z-index: 1;
  width: 100%;
  display: grid;
  gap: 24px;
  color: #112f46;
}

					.venue-features-hero,
					.venue-features-panel,
					.venue-features-preview-card,
					.venue-features-note-panel {
						border: 1px solid rgba(125, 211, 252, 0.35);
						border-radius: 28px;
						background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(236, 252, 255, 0.91) 54%, rgba(246, 242, 255, 0.92));
						box-shadow: 0 18px 60px rgba(37, 77, 112, 0.12);
					}

					.venue-features-hero {
						position: relative;
						overflow: hidden;
						display: grid;
						grid-template-columns: minmax(0, 1fr) minmax(420px, 0.82fr);
						gap: 28px;
						padding: 34px;
						min-height: 380px;
					}

					.venue-features-hero::before {
						content: "";
						position: absolute;
						inset: 0;
						background:
							radial-gradient(circle at 12% 18%, rgba(125, 211, 252, 0.28), transparent 30%),
							radial-gradient(circle at 72% 12%, rgba(196, 181, 253, 0.22), transparent 34%),
							linear-gradient(120deg, rgba(224, 250, 255, 0.42), rgba(255, 255, 255, 0.18));
						pointer-events: none;
					}

					.venue-features-hero > * {
						position: relative;
						z-index: 1;
					}

					.venue-features-hero-copy {
						display: grid;
						align-content: center;
						gap: 18px;
					}

					.venue-features-kicker {
						margin: 0;
						font-size: 0.74rem;
						font-weight: 800;
						letter-spacing: 0.12em;
						color: #3867a4;
						text-transform: uppercase;
					}

					.venue-features-heading {
						margin: 0;
						font-size: clamp(2.25rem, 4vw, 4.6rem);
						line-height: 1.06;
						color: #0d2d44;
						letter-spacing: 0;
					}

					.venue-features-subtitle,
					.venue-features-text {
						margin: 0;
						color: #46667a;
						line-height: 1.75;
					}

					.venue-features-subtitle {
						max-width: 62ch;
						font-size: 1.02rem;
					}

					.venue-features-chip-row,
					.venue-features-meta-row {
						display: flex;
						gap: 8px;
						flex-wrap: wrap;
						align-items: center;
					}

					.venue-features-chip,
					.venue-features-chip-ready,
					.venue-features-chip-draft,
					.venue-features-chip-missing {
						display: inline-flex;
						align-items: center;
						width: fit-content;
						min-height: 28px;
						padding: 5px 11px;
						border-radius: 999px;
						font-size: 0.75rem;
						font-weight: 800;
						line-height: 1.2;
					}

					.venue-features-chip {
						background: rgba(232, 244, 255, 0.88);
						color: #2d5d86;
						border: 1px solid rgba(125, 211, 252, 0.24);
					}

					.venue-features-chip-ready {
						background: rgba(213, 250, 234, 0.9);
						color: #17684d;
						border: 1px solid rgba(84, 220, 160, 0.24);
					}

					.venue-features-chip-draft {
						background: rgba(255, 244, 211, 0.94);
						color: #765400;
						border: 1px solid rgba(245, 190, 70, 0.22);
					}

					.venue-features-chip-missing {
						background: rgba(239, 243, 249, 0.92);
						color: #617386;
						border: 1px solid rgba(150, 164, 180, 0.2);
					}

					.venue-features-hero-image,
					.venue-features-preview-image,
					.venue-features-thumb {
						position: relative;
						overflow: hidden;
						background: linear-gradient(135deg, rgba(224, 250, 255, 0.9), rgba(242, 232, 255, 0.9));
					}

					.venue-features-hero-image {
						align-self: stretch;
						min-height: 320px;
						border-radius: 26px;
						box-shadow: 0 18px 52px rgba(37, 77, 112, 0.18);
					}

					.venue-features-preview-image {
						min-height: 340px;
						border-radius: 24px;
					}

					.venue-features-thumb {
						width: 88px;
						height: 64px;
						flex: 0 0 88px;
						border-radius: 18px;
					}

					.venue-features-hero-image img,
					.venue-features-preview-image img,
					.venue-features-thumb img {
						width: 100%;
						height: 100%;
						display: block;
						object-fit: cover;
					}

					.venue-features-image-fallback {
						min-height: inherit;
						height: 100%;
						display: grid;
						place-items: center;
						color: #315e82;
						font-weight: 900;
						background:
							linear-gradient(135deg, rgba(224, 250, 255, 0.94), rgba(245, 239, 255, 0.88)),
							repeating-linear-gradient(135deg, rgba(125, 211, 252, 0.14) 0 12px, transparent 12px 24px);
					}

					.venue-features-panel {
						padding: 18px;
					}

					.venue-features-toolbar {
						display: grid;
						grid-template-columns: minmax(260px, 1.4fr) repeat(4, minmax(150px, 0.72fr));
						gap: 10px;
					}

					.venue-features-input,
					.venue-features-select {
						width: 100%;
						min-height: 44px;
						border: 1px solid rgba(91, 139, 178, 0.22);
						border-radius: 14px;
						padding: 10px 12px;
						background: rgba(255, 255, 255, 0.9);
						color: #17374f;
						font: inherit;
					}

					.venue-features-main-grid {
						display: grid;
						grid-template-columns: minmax(360px, 0.72fr) minmax(0, 1.28fr);
						gap: 18px;
						align-items: start;
					}

					.venue-features-rail-panel {
						display: grid;
						gap: 14px;
					}

					.venue-features-rail {
						display: grid;
						grid-auto-flow: row;
						gap: 10px;
						max-height: 680px;
						overflow-y: auto;
						padding-right: 6px;
					}

					.venue-feature-selector-card {
						display: flex;
						gap: 12px;
						align-items: center;
						width: 100%;
						border: 1px solid rgba(125, 211, 252, 0.22);
						border-radius: 20px;
						background: rgba(255, 255, 255, 0.82);
						padding: 10px;
						text-align: left;
						cursor: pointer;
						box-shadow: 0 10px 26px rgba(40, 82, 120, 0.08);
					}

					.venue-feature-selector-card.is-selected {
						border-color: rgba(45, 132, 204, 0.5);
						background: rgba(239, 250, 255, 0.96);
						box-shadow: 0 14px 34px rgba(45, 132, 204, 0.18);
					}

					.venue-feature-selector-body {
						min-width: 0;
						display: grid;
						gap: 6px;
					}

					.venue-feature-title {
						margin: 0;
						color: #112f46;
						font-size: 1.05rem;
						line-height: 1.25;
					}

					.venue-feature-excerpt {
						margin: 0;
						color: #536f82;
						font-size: 0.78rem;
						line-height: 1.45;
						display: -webkit-box;
						-webkit-line-clamp: 2;
						-webkit-box-orient: vertical;
						overflow: hidden;
					}

					.venue-features-preview-card {
						overflow: hidden;
					}

					.venue-features-preview-content {
						display: grid;
						grid-template-columns: minmax(360px, 0.88fr) minmax(0, 1.12fr);
						gap: 0;
					}

					.venue-features-preview-copy {
						padding: 26px;
						display: grid;
						align-content: center;
						gap: 15px;
					}

					.venue-features-preview-title {
						margin: 0;
						font-size: clamp(2rem, 3vw, 3.2rem);
						line-height: 1.05;
						color: #0d2d44;
					}

					.venue-features-actions {
						display: flex;
						flex-wrap: wrap;
						gap: 10px;
					}

					.venue-features-button {
						border: 0;
						border-radius: 999px;
						padding: 10px 15px;
						background: #236d9a;
						color: white;
						font-weight: 850;
						cursor: pointer;
						box-shadow: 0 10px 22px rgba(35, 109, 154, 0.18);
					}

					.venue-features-button.secondary {
						background: rgba(35, 109, 154, 0.1);
						color: #236d9a;
						box-shadow: none;
					}

					.venue-features-detail-grid {
						display: grid;
						grid-template-columns: minmax(280px, 0.36fr) minmax(0, 1fr);
						gap: 18px;
						align-items: start;
					}

					.venue-features-note-panel {
						padding: 22px;
					}

					.venue-features-toc {
						position: sticky;
						top: 16px;
						display: grid;
						gap: 10px;
					}

					.venue-features-toc-list {
						display: flex;
						flex-wrap: wrap;
						gap: 8px;
					}

					.venue-features-view-tabs {
						display: inline-flex;
						width: fit-content;
						gap: 4px;
						padding: 4px;
						border-radius: 999px;
						background: rgba(230, 244, 255, 0.9);
						border: 1px solid rgba(125, 211, 252, 0.28);
					}

					.venue-features-view-tab {
						border: 0;
						border-radius: 999px;
						padding: 8px 12px;
						background: transparent;
						color: #315e82;
						font-weight: 800;
						cursor: pointer;
					}

					.venue-features-view-tab.is-active {
						background: white;
						color: #103853;
						box-shadow: 0 6px 18px rgba(40, 82, 120, 0.1);
					}

					.venue-features-summary-grid {
						display: grid;
						grid-template-columns: repeat(2, minmax(0, 1fr));
						gap: 12px;
					}

					.venue-features-summary-card,
					.venue-features-material,
					.venue-features-insight-card {
						border: 1px solid rgba(125, 211, 252, 0.24);
						border-radius: 20px;
						background: rgba(255, 255, 255, 0.76);
						padding: 16px;
					}

					.venue-features-material pre {
						margin: 0;
						white-space: pre-wrap;
						color: #17374f;
						font-size: 0.86rem;
						line-height: 1.72;
					}

					.venue-features-markdown-shell {
						max-height: 760px;
						overflow: auto;
						padding-right: 8px;
					}

					.venue-features-insight-grid {
						display: grid;
						grid-template-columns: repeat(4, minmax(0, 1fr));
						gap: 12px;
					}

					.venue-features-insight-card strong {
						display: block;
						color: #112f46;
						margin-bottom: 6px;
					}

					@media (max-width: 1280px) {
						.venue-features-hero,
						.venue-features-main-grid,
						.venue-features-preview-content,
						.venue-features-detail-grid {
							grid-template-columns: 1fr;
						}

						.venue-features-rail {
							display: flex;
							overflow-x: auto;
							overflow-y: hidden;
							max-height: none;
							padding: 4px 2px 12px;
						}

						.venue-feature-selector-card {
							width: 300px;
							flex: 0 0 300px;
						}

						.venue-features-toc {
							position: static;
						}

						.venue-features-toolbar {
							grid-template-columns: 1fr 1fr;
						}
					}

					@media (max-width: 760px) {
						.venue-features-hero,
						.venue-features-panel,
						.venue-features-note-panel,
						.venue-features-preview-copy {
							padding: 16px;
						}

						.venue-features-toolbar,
						.venue-features-summary-grid,
						.venue-features-insight-grid {
							grid-template-columns: 1fr;
						}

						.venue-features-hero-image,
						.venue-features-preview-image {
							min-height: 220px;
						}

						.venue-feature-selector-card {
							width: 280px;
							flex-basis: 280px;
						}
					}
				`}
			</style>

			<div className="venue-features-root">
				<section className="venue-features-hero">
					<div className="venue-features-hero-copy">
						<p className="venue-features-kicker">VENUE FEATURES</p>
						<h1 className="venue-features-heading">会場特徴ノート / 予想用データベース</h1>
						<p className="venue-features-subtitle">水面・風・コース傾向・展示チェックを、予想前に確認するための会場分析ノート。検索して会場を選び、重要ポイントとPrediction素材をすぐ確認できます。</p>
						<div className="venue-features-chip-row">
							<span className="venue-features-chip">{items.length} venues</span>
							<span className="venue-features-chip-ready">ready {readyCount}</span>
							<span className="venue-features-chip-draft">draft {draftCount}</span>
							<span className="venue-features-chip-missing">missing {missingCount}</span>
							<span className="venue-features-chip-ready">Prediction素材連携</span>
							<span className="venue-features-chip">My Analysis 準備中</span>
						</div>
					</div>
					{selectedItem ? <SpotlightImage slug={selectedItem.slug} venueName={selectedItem.venueName} className="venue-features-hero-image" /> : null}
				</section>

				<section className="venue-features-panel">
					<div className="venue-features-toolbar">
						<input className="venue-features-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="会場名・タグ・要約で検索" />
						<select className="venue-features-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as BoatVenueFeatureStatus | "all")}>
							<option value="all">すべて</option>
							<option value="ready">ready</option>
							<option value="draft">draft</option>
							<option value="missing">missing</option>
						</select>
						<select className="venue-features-select" value={waterFilter} onChange={(event) => setWaterFilter(event.target.value)}>
							<option value="all">水面タイプすべて</option>
							{waterTypes.map((waterType) => <option key={waterType} value={waterType}>{waterType}</option>)}
						</select>
						<select className="venue-features-select" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
							<option value="all">タグすべて</option>
							{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
						</select>
						<select className="venue-features-select" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
							<option value="venue">会場順</option>
							<option value="updated">更新日</option>
							<option value="ready">ready優先</option>
						</select>
					</div>
				</section>

				<div className="venue-features-main-grid">
					<section className="venue-features-panel venue-features-rail-panel" aria-label="会場セレクター">
						<div className="venue-features-meta-row" style={{ justifyContent: "space-between" }}>
							<div>
								<p className="venue-features-kicker">VENUE SELECTOR</p>
								<h2 className="venue-feature-title">検索して選ぶ</h2>
							</div>
							<span className="venue-features-chip">{filteredItems.length}件</span>
						</div>
						<div className="venue-features-rail">
							{filteredItems.map((item) => {
								const status = toStatus(item.status);
								return (
									<button key={item.slug} type="button" className={`venue-feature-selector-card ${item.slug === selectedSlug ? "is-selected" : ""}`} onClick={() => setSelectedSlug(item.slug)}>
										<SpotlightImage slug={item.slug} venueName={item.venueName} className="venue-features-thumb" />
										<span className="venue-feature-selector-body">
											<span className="venue-features-meta-row">
												<strong>{item.venueName}</strong>
												<span className={`venue-features-chip-${status}`}>{statusText[status]}</span>
											</span>
											<span className="venue-feature-excerpt">{item.excerpt ?? "ノート未登録です。"}</span>
											<span className="venue-features-meta-row">
												<span className="venue-features-chip">{item.slug}</span>
												<span className="venue-features-chip">{status === "ready" ? "Prediction素材に入る" : "素材未登録"}</span>
											</span>
										</span>
									</button>
								);
							})}
						</div>
					</section>

					<section className="venue-features-preview-card" aria-label="選択会場プレビュー">
						<div className="venue-features-preview-content">
							{selectedItem ? <SpotlightImage slug={selectedItem.slug} venueName={selectedItem.venueName} className="venue-features-preview-image" /> : null}
							<div className="venue-features-preview-copy">
								<p className="venue-features-kicker">SELECTED VENUE</p>
								<h2 className="venue-features-preview-title">{selectedItem?.venueName ?? "-"}</h2>
								<div className="venue-features-meta-row">
									<span className={`venue-features-chip-${selectedStatus}`}>{statusText[selectedStatus]}</span>
									<span className="venue-features-chip">{selectedItem?.slug ?? "-"}</span>
									<span className="venue-features-chip">{selectedItem?.waterType || "水面タイプ不明"}</span>
									<span className="venue-features-chip-ready">Prediction素材に連携済み</span>
								</div>
								<p className="venue-features-subtitle">{selectedNote?.excerpt || selectedItem?.excerpt || "Markdownノート未登録です。"}</p>
								<div className="venue-features-meta-row">
									{(selectedItem?.tags ?? []).slice(0, 8).map((tag) => <span key={tag} className="venue-features-chip">{tag}</span>)}
								</div>
								<p className="venue-features-text">更新: {formatDate(selectedItem?.updatedAt)} / index: {index?.generatedAt ? formatDate(index.generatedAt) : "未読込"}</p>
								<div className="venue-features-actions">
									<button type="button" className="venue-features-button" onClick={() => setNoteView("markdown")}>Markdownを開く</button>
									<button type="button" className="venue-features-button secondary" onClick={() => setNoteView("material")}>素材プレビュー</button>
									<button type="button" className="venue-features-button secondary" onClick={handleCopyMaterial} disabled={!materialPreview}>コピー</button>
								</div>
								{copyMessage ? <p className="venue-features-text">{copyMessage}</p> : null}
							</div>
						</div>
					</section>
				</div>

				<div className="venue-features-detail-grid">
					<aside className="venue-features-note-panel venue-features-toc">
						<div>
							<p className="venue-features-kicker">CONTENTS</p>
							<h2 className="venue-feature-title">目次と表示モード</h2>
						</div>
						<div className="venue-features-view-tabs" role="tablist" aria-label="表示モード">
							<button type="button" className={`venue-features-view-tab ${noteView === "summary" ? "is-active" : ""}`} onClick={() => setNoteView("summary")}>要約</button>
							<button type="button" className={`venue-features-view-tab ${noteView === "markdown" ? "is-active" : ""}`} onClick={() => setNoteView("markdown")}>全文</button>
							<button type="button" className={`venue-features-view-tab ${noteView === "material" ? "is-active" : ""}`} onClick={() => setNoteView("material")}>素材</button>
						</div>
						<div className="venue-features-toc-list">
							{selectedNote?.sections.length ? selectedNote.sections.slice(0, 18).map((section) => (
								<button key={`${section.level}-${section.title}`} type="button" className="venue-features-button secondary" onClick={() => setNoteView("markdown")}>{section.title}</button>
							)) : <span className="venue-features-chip">目次なし</span>}
						</div>
					</aside>

					<section className="venue-features-note-panel">
						<div className="venue-features-meta-row" style={{ justifyContent: "space-between", marginBottom: "16px" }}>
							<div>
								<p className="venue-features-kicker">{noteView === "summary" ? "IMPORTANT POINTS" : noteView === "markdown" ? "MARKDOWN PREVIEW" : "PREDICTION MATERIAL"}</p>
								<h2 className="venue-feature-title">{selectedItem?.title ?? "会場特徴ノート"}</h2>
							</div>
							{noteView === "material" ? <span className="venue-features-chip-ready">この内容がPredictionPageのGPT素材に入ります</span> : null}
						</div>

						{noteView === "summary" ? (
							<div className="venue-features-summary-grid">
								{importantPoints.length > 0 ? importantPoints.map((point, pointIndex) => (
									<div key={`${point}-${pointIndex}`} className="venue-features-summary-card">
										<p className="venue-features-kicker">POINT {pointIndex + 1}</p>
										<p className="venue-features-text">{point}</p>
									</div>
								)) : (
									<div className="venue-features-summary-card">
										<p className="venue-features-text">この会場の要約はまだありません。</p>
									</div>
								)}
							</div>
						) : null}

						{noteView === "markdown" ? (
							<div className="venue-features-markdown-shell">
								{selectedNote ? <BoatVenueFeatureMarkdown markdown={selectedNote.markdown} /> : <p className="venue-features-text">Markdownノート未登録です。</p>}
							</div>
						) : null}

						{noteView === "material" ? (
							<div className="venue-features-material">
								<pre>{materialPreview || "会場特徴ノートは未登録です。"}</pre>
							</div>
						) : null}
					</section>
				</div>

				<section className="venue-features-note-panel">
					<div className="venue-features-meta-row" style={{ justifyContent: "space-between", marginBottom: "14px" }}>
						<div>
							<p className="venue-features-kicker">MY ANALYSIS LOG</p>
							<h2 className="venue-feature-title">自分用会場分析サマリー</h2>
						</div>
						<span className="venue-features-chip">localStorage: {BOAT_VENUE_FEATURE_INSIGHTS_STORAGE_KEY}</span>
					</div>
					<p className="venue-features-text" style={{ marginBottom: "14px" }}>予想結果・的中/不的中・展示評価から、会場別の自分分析をここに蓄積する予定です。既存データがlocalStorageにあれば選択会場分を表示します。</p>
					<div className="venue-features-insight-grid">
						<div className="venue-features-insight-card">
							<strong>最新サマリー</strong>
							<p className="venue-features-text">{selectedInsights[0]?.summary ?? "準備中。Review結果から生成した要点を表示予定です。"}</p>
						</div>
						<div className="venue-features-insight-card">
							<strong>的中傾向</strong>
							<p className="venue-features-text">{selectedInsights[0]?.hitRate !== undefined ? `的中率 ${selectedInsights[0].hitRate}%` : "的中率・買い方傾向を表示予定です。"}</p>
						</div>
						<div className="venue-features-insight-card">
							<strong>荒れやすい条件</strong>
							<p className="venue-features-text">{selectedInsights[0]?.notes?.[0] ?? "風・波・展示評価から外しやすい条件を蓄積予定です。"}</p>
						</div>
						<div className="venue-features-insight-card">
							<strong>回収率 / 弱点</strong>
							<p className="venue-features-text">{selectedInsights[0]?.roi !== undefined ? `回収率 ${selectedInsights[0].roi}%` : "ROIと自分が外しやすいパターンを表示予定です。"}</p>
						</div>
					</div>
				</section>
			</div>
		</PageShell>
	);
}
