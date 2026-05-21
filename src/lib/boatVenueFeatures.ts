import { withBasePath } from "./assetPath";

export type BoatVenueFeatureStatus = "ready" | "draft" | "missing";
export type BoatVenueFeatureSourceType = "manual-note" | "user-insight" | "system";

export type BoatVenueFeatureItem = {
	venueName: string;
	slug: string;
	title?: string;
	file: string;
	status?: BoatVenueFeatureStatus;
	sourceType?: BoatVenueFeatureSourceType;
	updatedAt?: string;
	tags?: string[];
	waterType?: string;
	excerpt?: string;
};

export type BoatVenueFeatureIndex = {
	generatedAt?: string;
	items: BoatVenueFeatureItem[];
	warnings?: string[];
};

export type BoatVenueFeatureSection = {
	title: string;
	level: number;
	body: string;
};

export type BoatVenueFeatureNote = {
	item: BoatVenueFeatureItem;
	markdown: string;
	excerpt: string;
	sections: BoatVenueFeatureSection[];
};

export type BoatVenueUserInsight = {
	venueName: string;
	date: string;
	source: "review-summary" | "manual";
	summary: string;
	hitRate?: number;
	roi?: number;
	notes?: string[];
};

export const BOAT_VENUE_FEATURE_INSIGHTS_STORAGE_KEY = "kurari-boat-data-labo-venue-feature-insights";

export const BOAT_VENUE_FEATURE_VENUES = [
	{ venueName: "桐生", slug: "kiryu" },
	{ venueName: "戸田", slug: "toda" },
	{ venueName: "江戸川", slug: "edogawa" },
	{ venueName: "平和島", slug: "heiwajima" },
	{ venueName: "多摩川", slug: "tamagawa" },
	{ venueName: "浜名湖", slug: "hamanako" },
	{ venueName: "蒲郡", slug: "gamagori" },
	{ venueName: "常滑", slug: "tokoname" },
	{ venueName: "津", slug: "tsu" },
	{ venueName: "三国", slug: "mikuni" },
	{ venueName: "びわこ", slug: "biwako" },
	{ venueName: "住之江", slug: "suminoe" },
	{ venueName: "尼崎", slug: "amagasaki" },
	{ venueName: "鳴門", slug: "naruto" },
	{ venueName: "丸亀", slug: "marugame" },
	{ venueName: "児島", slug: "kojima" },
	{ venueName: "宮島", slug: "miyajima" },
	{ venueName: "徳山", slug: "tokuyama" },
	{ venueName: "下関", slug: "shimonoseki" },
	{ venueName: "若松", slug: "wakamatsu" },
	{ venueName: "芦屋", slug: "ashiya" },
	{ venueName: "福岡", slug: "fukuoka" },
	{ venueName: "唐津", slug: "karatsu" },
	{ venueName: "大村", slug: "omura" },
] as const;

const BOAT_VENUE_FEATURE_VENUES_BY_LENGTH = [...BOAT_VENUE_FEATURE_VENUES].sort((left, right) => right.venueName.length - left.venueName.length);

const FEATURE_INDEX_PATH = "data/boatrace/venue-features/index.json";

const normalizeText = (value: string): string => value.replace(/\s+/g, "").toLowerCase();

export function getBoatVenueFeatureSlug(slugOrVenueName: string): string {
	const normalized = normalizeText(slugOrVenueName);
	const exact = BOAT_VENUE_FEATURE_VENUES.find((venue) => normalizeText(venue.venueName) === normalized || normalizeText(venue.slug) === normalized);
	if (exact) {
		return exact.slug;
	}

	return BOAT_VENUE_FEATURE_VENUES_BY_LENGTH.find((venue) => normalized.includes(normalizeText(venue.venueName)))?.slug ?? normalized;
}

export async function loadBoatVenueFeatureIndex(): Promise<BoatVenueFeatureIndex> {
	try {
		const response = await fetch(`${withBasePath(FEATURE_INDEX_PATH)}?ts=${Date.now()}`, { cache: "no-store" });
		if (!response.ok) {
			return { items: [], warnings: [`index fetch failed: ${response.status}`] };
		}

		const parsed = await response.json() as BoatVenueFeatureIndex;
		return {
			generatedAt: parsed.generatedAt,
			items: Array.isArray(parsed.items) ? parsed.items : [],
			warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
		};
	} catch (error) {
		return { items: [], warnings: [error instanceof Error ? error.message : "index fetch failed"] };
	}
}

export function findBoatVenueFeatureItem(index: BoatVenueFeatureIndex | null | undefined, slugOrVenueName: string | null | undefined): BoatVenueFeatureItem | null {
	if (!index || !slugOrVenueName) {
		return null;
	}

	const target = normalizeText(slugOrVenueName);
	const targetSlug = getBoatVenueFeatureSlug(slugOrVenueName);
	return index.items.find((item) =>
		normalizeText(item.slug) === target ||
		normalizeText(item.slug) === normalizeText(targetSlug) ||
		normalizeText(item.venueName) === target ||
		normalizeText(item.venueName).includes(target)
	) ?? null;
}

function stripFrontMatter(markdown: string): string {
	return markdown.replace(/^---[\s\S]*?---\s*/, "");
}

function stripMarkdown(markdown: string): string {
	return stripFrontMatter(markdown)
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/[#>*_\-|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function parseBoatVenueFeatureSections(markdown: string): BoatVenueFeatureSection[] {
	const sections: BoatVenueFeatureSection[] = [];
	let current: BoatVenueFeatureSection | null = null;

	for (const line of stripFrontMatter(markdown).split(/\r?\n/)) {
		const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
		if (heading) {
			if (current) {
				current.body = current.body.trim();
				sections.push(current);
			}
			current = { level: heading[1].length, title: heading[2].trim(), body: "" };
			continue;
		}

		if (current) {
			current.body += `${line}\n`;
		}
	}

	if (current) {
		current.body = current.body.trim();
		sections.push(current);
	}

	return sections;
}

export async function loadBoatVenueFeatureNote(slugOrVenueName: string, index?: BoatVenueFeatureIndex | null): Promise<BoatVenueFeatureNote | null> {
	const resolvedIndex = index ?? await loadBoatVenueFeatureIndex();
	const item = findBoatVenueFeatureItem(resolvedIndex, slugOrVenueName);
	if (!item || !item.file || item.status === "missing") {
		return null;
	}

	try {
		const response = await fetch(`${withBasePath(`data/boatrace/venue-features/${item.file}`)}?ts=${Date.now()}`, { cache: "no-store" });
		if (!response.ok) {
			return null;
		}

		const markdown = await response.text();
		const plainText = stripMarkdown(markdown);
		return {
			item,
			markdown,
			excerpt: item.excerpt || plainText.slice(0, 180),
			sections: parseBoatVenueFeatureSections(markdown),
		};
	} catch {
		return null;
	}
}

function pickSection(note: BoatVenueFeatureNote, patterns: string[]): string {
	const section = note.sections.find((item) => patterns.some((pattern) => item.title.includes(pattern)));
	return section ? section.body : "";
}

function bulletize(markdown: string, maxItems = 8): string[] {
	const explicitBullets = markdown
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^[-*]\s+/.test(line))
		.map((line) => stripMarkdown(line.replace(/^[-*]\s+/, "")))
		.filter((line) => line.length >= 6);

	const source = explicitBullets.length ? explicitBullets : markdown.split(/[。\n]/).map(stripMarkdown).filter((line) => line.length >= 10);
	return Array.from(new Set(source)).slice(0, maxItems);
}

export function buildBoatVenueFeatureMaterial(note: BoatVenueFeatureNote | null | undefined, options: { includeFullText?: boolean; maxLength?: number } = {}): string {
	if (!note) {
		return "";
	}

	const maxLength = options.maxLength ?? 1800;
	const coreSections = [
		pickSection(note, ["基本", "スペック", "会場"]),
		pickSection(note, ["コース", "進入"]),
		pickSection(note, ["風", "波", "水面"]),
		pickSection(note, ["展示"]),
		pickSection(note, ["荒れ"]),
		pickSection(note, ["堅く", "固く"]),
		pickSection(note, ["予想順序", "順序"]),
	].filter(Boolean);

	const sourceText = coreSections.length ? coreSections.join("\n") : note.markdown;
	const bullets = bulletize(sourceText, 10);
	const body = [
		"【会場特徴ノート / 手入力】",
		`会場: ${note.item.venueName}`,
		"このノートは買い目指定ではなく、会場特性・水面・風・コース傾向の参考資料です。",
		`一言まとめ: ${note.excerpt || "登録済みノートあり"}`,
		"要点:",
		...(bullets.length ? bullets.map((line) => `- ${line}`) : ["- 登録済みノートを確認してください"]),
		options.includeFullText ? "\n全文:" : "",
		options.includeFullText ? stripFrontMatter(note.markdown) : "",
	].filter(Boolean).join("\n");

	return body.length > maxLength ? `${body.slice(0, maxLength - 20).trim()}\n...` : body;
}

export function loadBoatVenueUserInsights(): BoatVenueUserInsight[] {
	if (typeof window === "undefined") {
		return [];
	}

	try {
		const raw = window.localStorage.getItem(BOAT_VENUE_FEATURE_INSIGHTS_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.filter((item): item is BoatVenueUserInsight => Boolean(item?.venueName && item?.summary)) : [];
	} catch {
		return [];
	}
}
