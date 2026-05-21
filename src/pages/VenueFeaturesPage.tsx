import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { BoatVenueFeatureMarkdown } from "../components/boatrace/venueFeatures/BoatVenueFeatureMarkdown";
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

const statusLabels: Record<BoatVenueFeatureStatus, string> = {
	ready: "ready",
	draft: "draft",
	missing: "missing",
};

const statusText: Record<BoatVenueFeatureStatus, string> = {
	ready: "ノート登録済み",
	draft: "下書き",
	missing: "未登録",
};

const toStatus = (value: string | undefined): BoatVenueFeatureStatus =>
	value === "ready" || value === "draft" || value === "missing" ? value : "missing";

const formatDate = (value: string | undefined): string => {
	if (!value) {
		return "更新日なし";
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const normalize = (value: string): string => value.replace(/\s+/g, "").toLowerCase();

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
			excerpt: "Markdownノートを追加すると、ここに会場特徴の要約が表示されます。",
		};
	});
	const extraItems = sourceItems.filter((item) => !BOAT_VENUE_FEATURE_VENUES.some((venue) => venue.slug === item.slug));
	return [...baseItems, ...extraItems];
}

function sectionText(note: BoatVenueFeatureNote | null, patterns: string[]): string {
	if (!note) {
		return "";
	}

	const section = note.sections.find((item) => patterns.some((pattern) => item.title.includes(pattern)));
	return section?.body.replace(/\s+/g, " ").trim().slice(0, 180) ?? "";
}

function insightCount(insights: BoatVenueUserInsight[], venueName: string): number {
	return insights.filter((item) => item.venueName === venueName).length;
}

export function VenueFeaturesPage() {
	const [index, setIndex] = useState<BoatVenueFeatureIndex | null>(null);
	const [selectedSlug, setSelectedSlug] = useState("biwako");
	const [selectedNote, setSelectedNote] = useState<BoatVenueFeatureNote | null>(null);
	const [query, setQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<BoatVenueFeatureStatus | "all">("all");
	const [waterFilter, setWaterFilter] = useState("all");
	const [tagFilter, setTagFilter] = useState("all");
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
	const readyCount = items.filter((item) => toStatus(item.status) === "ready").length;
	const draftCount = items.filter((item) => toStatus(item.status) === "draft").length;
	const missingCount = items.filter((item) => toStatus(item.status) === "missing").length;
	const tags = useMemo(() => Array.from(new Set(items.flatMap((item) => item.tags ?? []))).sort((left, right) => left.localeCompare(right, "ja")), [items]);
	const waterTypes = useMemo(() => Array.from(new Set(items.map((item) => item.waterType).filter(Boolean) as string[])).sort((left, right) => left.localeCompare(right, "ja")), [items]);
	const materialPreview = useMemo(() => buildBoatVenueFeatureMaterial(selectedNote, { maxLength: 1600 }), [selectedNote]);
	const importantPoints = useMemo(() => [
		sectionText(selectedNote, ["基本", "スペック"]),
		sectionText(selectedNote, ["コース", "進入"]),
		sectionText(selectedNote, ["水面", "風", "波"]),
		sectionText(selectedNote, ["展示"]),
	].filter(Boolean), [selectedNote]);

	const filteredItems = useMemo(() => {
		const normalizedQuery = normalize(query);
		return items.filter((item) => {
			const status = toStatus(item.status);
			const searchable = normalize(`${item.venueName} ${item.slug} ${item.title ?? ""} ${(item.tags ?? []).join(" ")} ${item.excerpt ?? ""}`);
			return (!normalizedQuery || searchable.includes(normalizedQuery)) &&
				(statusFilter === "all" || status === statusFilter) &&
				(waterFilter === "all" || item.waterType === waterFilter) &&
				(tagFilter === "all" || (item.tags ?? []).includes(tagFilter));
		});
	}, [items, query, statusFilter, tagFilter, waterFilter]);

	const handleCopyMaterial = async () => {
		if (!materialPreview) {
			return;
		}

		try {
			await navigator.clipboard.writeText(materialPreview);
			setCopyMessage("素材プレビューをコピーしました");
		} catch {
			setCopyMessage("コピーできませんでした。テキストを選択してコピーしてください。");
		}
	};

	return (
		<PageShell
			eyebrow="VENUE FEATURES"
			title="会場特徴ノート / 予想用データベース"
			description="会場の水面・風・コース傾向を、予想前に確認するための分析ノートです。"
		>
			<style>
				{`
					.venue-features-root {
						display: grid;
						gap: 22px;
						color: #15364e;
					}

					.venue-features-hero,
					.venue-features-panel,
					.venue-feature-card {
						border: 1px solid rgba(106, 135, 190, 0.18);
						border-radius: 8px;
						background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(238, 252, 255, 0.86) 52%, rgba(250, 246, 255, 0.86));
						box-shadow: 0 16px 44px rgba(49, 89, 130, 0.1);
					}

					.venue-features-hero {
						padding: 28px;
						display: grid;
						gap: 18px;
					}

					.venue-features-title-row,
					.venue-features-section-head,
					.venue-feature-card-head {
						display: flex;
						justify-content: space-between;
						gap: 14px;
						align-items: flex-start;
						flex-wrap: wrap;
					}

					.venue-features-kicker {
						margin: 0 0 6px;
						font-size: 0.72rem;
						font-weight: 800;
						letter-spacing: 0;
						color: #5c5fa8;
						text-transform: uppercase;
					}

					.venue-features-heading {
						margin: 0;
						font-size: 2.3rem;
						line-height: 1.18;
						color: #112f46;
					}

					.venue-features-text {
						margin: 0;
						color: #46667a;
						font-size: 0.92rem;
						line-height: 1.7;
					}

					.venue-features-stats {
						display: grid;
						grid-template-columns: repeat(4, minmax(0, 1fr));
						gap: 12px;
					}

					.venue-features-stat {
						padding: 14px;
						border-radius: 8px;
						background: rgba(255, 255, 255, 0.76);
						border: 1px solid rgba(100, 155, 188, 0.16);
					}

					.venue-features-stat strong {
						display: block;
						font-size: 1.5rem;
						color: #12324a;
					}

					.venue-features-chip,
					.venue-features-chip-ready,
					.venue-features-chip-draft,
					.venue-features-chip-missing {
						display: inline-flex;
						align-items: center;
						width: fit-content;
						min-height: 28px;
						padding: 5px 10px;
						border-radius: 999px;
						font-size: 0.76rem;
						font-weight: 800;
					}

					.venue-features-chip {
						background: rgba(228, 241, 255, 0.9);
						color: #2f5f87;
					}

					.venue-features-chip-ready {
						background: rgba(214, 247, 233, 0.92);
						color: #17684d;
					}

					.venue-features-chip-draft {
						background: rgba(255, 243, 205, 0.95);
						color: #7c5a00;
					}

					.venue-features-chip-missing {
						background: rgba(236, 240, 246, 0.95);
						color: #607082;
					}

					.venue-features-panel {
						padding: 20px;
					}

					.venue-features-filters {
						display: grid;
						grid-template-columns: minmax(220px, 1.5fr) repeat(4, minmax(140px, 1fr));
						gap: 10px;
					}

					.venue-features-input,
					.venue-features-select {
						width: 100%;
						border: 1px solid rgba(95, 132, 170, 0.22);
						border-radius: 8px;
						padding: 11px 12px;
						background: rgba(255, 255, 255, 0.88);
						color: #17374f;
						font: inherit;
					}

					.venue-features-layout {
						display: grid;
						grid-template-columns: minmax(0, 1.05fr) minmax(420px, 0.95fr);
						gap: 18px;
						align-items: start;
					}

					.venue-features-grid {
						display: grid;
						grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
						gap: 12px;
					}

					.venue-feature-card {
						padding: 16px;
						display: grid;
						gap: 12px;
						text-align: left;
					}

					.venue-feature-card.is-selected {
						border-color: rgba(55, 125, 195, 0.42);
						box-shadow: 0 14px 34px rgba(55, 125, 195, 0.17);
					}

					.venue-feature-name {
						margin: 0;
						font-size: 1.1rem;
						color: #12324a;
					}

					.venue-feature-meta {
						display: flex;
						gap: 7px;
						flex-wrap: wrap;
						align-items: center;
					}

					.venue-features-button {
						border: 0;
						border-radius: 8px;
						padding: 9px 12px;
						background: #246b95;
						color: white;
						font-weight: 800;
						cursor: pointer;
					}

					.venue-features-button.secondary {
						background: rgba(36, 107, 149, 0.1);
						color: #246b95;
					}

					.venue-features-preview {
						position: sticky;
						top: 16px;
						display: grid;
						gap: 14px;
					}

					.venue-features-toc {
						display: flex;
						gap: 8px;
						flex-wrap: wrap;
					}

					.venue-features-note-box,
					.venue-features-material {
						padding: 16px;
						border-radius: 8px;
						border: 1px solid rgba(95, 132, 170, 0.16);
						background: rgba(255, 255, 255, 0.78);
					}

					.venue-features-material pre {
						white-space: pre-wrap;
						margin: 0;
						color: #15364e;
						font-size: 0.82rem;
						line-height: 1.65;
					}

					.venue-features-insight-list {
						display: grid;
						gap: 10px;
						margin-top: 14px;
					}

					@media (max-width: 1100px) {
						.venue-features-layout,
						.venue-features-filters {
							grid-template-columns: 1fr;
						}

						.venue-features-preview {
							position: static;
						}

						.venue-features-stats {
							grid-template-columns: repeat(2, minmax(0, 1fr));
						}
					}

					@media (max-width: 640px) {
						.venue-features-hero,
						.venue-features-panel {
							padding: 16px;
						}

						.venue-features-heading {
							font-size: 1.8rem;
						}

						.venue-features-stats {
							grid-template-columns: 1fr;
						}
					}
				`}
			</style>

			<div className="venue-features-root">
				<section className="venue-features-hero">
					<div className="venue-features-title-row">
						<div>
							<p className="venue-features-kicker">VENUE FEATURES</p>
							<h1 className="venue-features-heading">会場特徴ノートを管理する</h1>
							<p className="venue-features-text">24場の水面、風、コース傾向、展示チェックをMarkdownで管理し、PredictionのGPT貼り付け素材へ要約連携します。</p>
						</div>
						<span className="venue-features-chip-ready">Prediction素材連携中</span>
					</div>
					<div className="venue-features-stats">
						<div className="venue-features-stat">
							<strong>{readyCount}</strong>
							<span>ready</span>
						</div>
						<div className="venue-features-stat">
							<strong>{draftCount}</strong>
							<span>draft</span>
						</div>
						<div className="venue-features-stat">
							<strong>{missingCount}</strong>
							<span>missing</span>
						</div>
						<div className="venue-features-stat">
							<strong>{items.length}</strong>
							<span>管理対象会場</span>
						</div>
					</div>
				</section>

				<section className="venue-features-panel">
					<div className="venue-features-section-head" style={{ marginBottom: "14px" }}>
						<div>
							<p className="venue-features-kicker">SEARCH / FILTER</p>
							<h2 className="venue-feature-name">ノートを探す</h2>
						</div>
						<span className="venue-features-chip">index更新: {index?.generatedAt ? formatDate(index.generatedAt) : "未読込"}</span>
					</div>
					<div className="venue-features-filters">
						<input className="venue-features-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="会場名・タグ・要約で検索" />
						<select className="venue-features-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as BoatVenueFeatureStatus | "all")}>
							<option value="all">全ステータス</option>
							<option value="ready">ready</option>
							<option value="draft">draft</option>
							<option value="missing">missing</option>
						</select>
						<select className="venue-features-select" value={waterFilter} onChange={(event) => setWaterFilter(event.target.value)}>
							<option value="all">水面タイプ</option>
							{waterTypes.map((waterType) => <option key={waterType} value={waterType}>{waterType}</option>)}
						</select>
						<select className="venue-features-select" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
							<option value="all">タグ</option>
							{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
						</select>
						<select className="venue-features-select" disabled value="future" aria-label="公式連携OK会場 filter">
							<option value="future">公式連携OK filter 準備中</option>
						</select>
					</div>
				</section>

				<div className="venue-features-layout">
					<section className="venue-features-grid" aria-label="会場特徴ノート一覧">
						{filteredItems.map((item) => {
							const status = toStatus(item.status);
							return (
								<article key={item.slug} className={`venue-feature-card ${item.slug === selectedSlug ? "is-selected" : ""}`}>
									<div className="venue-feature-card-head">
										<div>
											<p className="venue-feature-name">{item.venueName}</p>
											<p className="venue-features-text">{item.slug}</p>
										</div>
										<span className={`venue-features-chip-${statusLabels[status]}`}>{statusText[status]}</span>
									</div>
									<p className="venue-features-text">{item.excerpt ?? "Markdownノート未登録です。"}</p>
									<div className="venue-feature-meta">
										<span className="venue-features-chip">{formatDate(item.updatedAt)}</span>
										<span className="venue-features-chip">{status === "ready" ? "Prediction素材に入る" : "素材未登録"}</span>
										{item.waterType ? <span className="venue-features-chip">{item.waterType}</span> : null}
										{(item.tags ?? []).slice(0, 3).map((tag) => <span key={tag} className="venue-features-chip">{tag}</span>)}
									</div>
									<button type="button" className="venue-features-button secondary" onClick={() => setSelectedSlug(item.slug)}>開く</button>
								</article>
							);
						})}
					</section>

					<aside className="venue-features-preview" aria-label="選択中ノート">
						<section className="venue-features-panel">
							<div className="venue-features-section-head">
								<div>
									<p className="venue-features-kicker">SELECTED NOTE</p>
									<h2 className="venue-feature-name">{selectedItem?.title ?? "会場特徴ノート"}</h2>
									<p className="venue-features-text">{selectedItem?.venueName ?? "-"} / {selectedItem?.slug ?? "-"}</p>
								</div>
								<span className={`venue-features-chip-${statusLabels[toStatus(selectedItem?.status)]}`}>{statusText[toStatus(selectedItem?.status)]}</span>
							</div>

							{selectedNote ? (
								<>
									<div className="venue-features-toc" style={{ marginTop: "14px" }}>
										{selectedNote.sections.map((section) => <span key={`${section.level}-${section.title}`} className="venue-features-chip">{section.title}</span>)}
									</div>
									{importantPoints.length > 0 ? (
										<div className="venue-features-note-box" style={{ marginTop: "14px" }}>
											<p className="venue-features-kicker">IMPORTANT POINTS</p>
											{importantPoints.map((point, index) => <p key={`${point}-${index}`} className="venue-features-text">・{point}</p>)}
										</div>
									) : null}
									<div className="venue-features-note-box" style={{ marginTop: "14px" }}>
										<BoatVenueFeatureMarkdown markdown={selectedNote.markdown} />
									</div>
								</>
							) : (
								<div className="venue-features-note-box" style={{ marginTop: "14px" }}>
									<p className="venue-features-text">この会場はまだMarkdownノートがありません。notesフォルダにファイルを追加してindexを生成すると表示されます。</p>
								</div>
							)}
						</section>

						<section className="venue-features-panel">
							<div className="venue-features-section-head">
								<div>
									<p className="venue-features-kicker">PREDICTION MATERIAL PREVIEW</p>
									<h2 className="venue-feature-name">GPT貼り付け用素材</h2>
								</div>
								<button type="button" className="venue-features-button" onClick={handleCopyMaterial} disabled={!materialPreview}>素材コピー</button>
							</div>
							<div className="venue-features-material" style={{ marginTop: "14px" }}>
								<pre>{materialPreview || "会場特徴ノートは未登録です。"}</pre>
							</div>
							{copyMessage ? <p className="venue-features-text" style={{ marginTop: "10px" }}>{copyMessage}</p> : null}
						</section>

						<section className="venue-features-panel">
							<p className="venue-features-kicker">MY ANALYSIS LOG</p>
							<h2 className="venue-feature-name">予想結果から作る自分用会場メモ</h2>
							<p className="venue-features-text">現在は準備中です。将来はReview結果から会場別サマリーを保存し、Prediction素材へ追加できる構造にします。</p>
							<p className="venue-features-text" style={{ marginTop: "8px" }}>localStorage key: {BOAT_VENUE_FEATURE_INSIGHTS_STORAGE_KEY}</p>
							<div className="venue-features-insight-list">
								{insightCount(insights, selectedItem?.venueName ?? "") > 0 ? (
									insights
										.filter((item) => item.venueName === selectedItem?.venueName)
										.map((item) => (
											<div key={`${item.venueName}-${item.date}-${item.summary}`} className="venue-features-note-box">
												<strong>{item.date} / {item.source}</strong>
												<p className="venue-features-text">{item.summary}</p>
											</div>
										))
								) : (
									<div className="venue-features-note-box">
										<p className="venue-features-text">この会場の自分分析サマリーはまだありません。</p>
									</div>
								)}
							</div>
						</section>
					</aside>
				</div>
			</div>
		</PageShell>
	);
}
