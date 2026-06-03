export type BoatBetType = "trifecta" | "exacta" | "trio" | "quinella" | "wide";

export type ParsedBoatBet = {
	type: BoatBetType;
	label: string;
	numbers: number[];
	normalized: string;
	amountYen: number;
	sourceLine: string;
};

export type ParsedBoatBetSummary = {
	bets: ParsedBoatBet[];
	totalBets: number;
	trifectaCount: number;
	exactaCount: number;
	totalStakeYen: number;
	warnings?: string[];
};

const DEFAULT_BET_AMOUNT_YEN = 100;

const typeLabels: Record<BoatBetType, string> = {
	trifecta: "3連単",
	exacta: "2連単",
	trio: "3連複",
	quinella: "2連複",
	wide: "拡連複",
};

const HYPHEN_LIKE_PATTERN = /[‐-―－ーｰ〜～>＞→⇒]/g;

export const emptyBoatBetSummary = (): ParsedBoatBetSummary => ({
	bets: [],
	totalBets: 0,
	trifectaCount: 0,
	exactaCount: 0,
	totalStakeYen: 0,
	warnings: [],
});

export function normalizeBoatBetCombination(value: string): string {
	return value
		.normalize("NFKC")
		.replace(HYPHEN_LIKE_PATTERN, "-")
		.replace(/\s+/g, "")
		.replace(/^-+|-+$/g, "");
}

const resolveBetTypeFromText = (value: string): BoatBetType | null => {
	const text = value.normalize("NFKC");

	if (/3\s*連\s*単|三\s*連\s*単|3\s*単|trifecta/i.test(text)) {
		return "trifecta";
	}

	if (/2\s*連\s*単|二\s*連\s*単|2\s*単|exacta/i.test(text)) {
		return "exacta";
	}

	if (/3\s*連\s*複|三\s*連\s*複|3\s*複|trio/i.test(text)) {
		return "trio";
	}

	if (/2\s*連\s*複|二\s*連\s*複|2\s*複|quinella/i.test(text)) {
		return "quinella";
	}

	if (/拡\s*連\s*複|ワイド|wide/i.test(text)) {
		return "wide";
	}

	return null;
};

const inferBetTypeFromNumbers = (numbers: number[]): BoatBetType | null => {
	if (numbers.length === 3) {
		return "trifecta";
	}

	if (numbers.length === 2) {
		return "exacta";
	}

	return null;
};

const readAmountYen = (line: string, unitAmountYen: number): number => {
	const normalized = line.normalize("NFKC");
	const match = normalized.match(/(\d{2,6})\s*円/);
	if (!match) {
		return unitAmountYen;
	}

	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : unitAmountYen;
};

const isBetSectionHeading = (line: string): boolean => {
	const text = line.normalize("NFKC");
	return /買い目|買目|投票|舟券|BET|ベット/i.test(text);
};

const isBetSectionEndHeading = (line: string): boolean => {
	const text = line.normalize("NFKC").replace(/[【】\[\]]/g, "").trim();

	if (!text) {
		return false;
	}

	if (/^(最終チェック|タグ|危険な人気|穴候補|結果|振り返り|メモ|レビュー|総評|まとめ|買い足し)/i.test(text)) {
		return true;
	}

	return /^【.+】$/.test(line.trim()) && !isBetSectionHeading(line);
};

const extractBoatBetSection = (predictionText: string): { lines: string[]; hasSection: boolean } => {
	const lines = predictionText.split(/\r?\n/);
	const startIndex = lines.findIndex(isBetSectionHeading);

	if (startIndex < 0) {
		return { lines: [], hasSection: false };
	}

	const endIndex = lines.findIndex((line, index) => index > startIndex && isBetSectionEndHeading(line));

	return {
		lines: lines.slice(startIndex, endIndex > startIndex ? endIndex : undefined),
		hasSection: true,
	};
};

const extractTicketCombinationFromLine = (line: string): string | null => {
	const normalized = line
		.normalize("NFKC")
		.replace(HYPHEN_LIKE_PATTERN, "-")
		.trim();

	const match =
		normalized.match(/^(?:0?[1-9]|1[0-2])(?:[.)、:：|\s]+)([1-6]\s*-\s*[1-6](?:\s*-\s*[1-6])?)(?:\s|$)/) ||
		normalized.match(/^([1-6]\s*-\s*[1-6](?:\s*-\s*[1-6])?)(?:\s|$)/);

	if (!match) {
		return null;
	}

	const normalizedCombination = normalizeBoatBetCombination(match[1]);
	const numbers = normalizedCombination.split("-").map((value) => Number(value));
	if (numbers.some((value) => !Number.isInteger(value) || value < 1 || value > 6)) {
		return null;
	}

	if (new Set(numbers).size !== numbers.length) {
		return null;
	}

	return normalizedCombination;
};

export function parseBoatBets(predictionText: string, unitAmountYen = DEFAULT_BET_AMOUNT_YEN): ParsedBoatBetSummary {
	const bets: ParsedBoatBet[] = [];
	const seen = new Set<string>();
	const warnings: string[] = [];
	let currentType: BoatBetType | null = null;
	let currentLabel = "";
	const section = extractBoatBetSection(predictionText);

	if (!section.hasSection) {
		return {
			...emptyBoatBetSummary(),
			warnings: ["買い目セクションが見つかりません。買い目📝以降に買い目を記載してください。"],
		};
	}

	for (const rawLine of section.lines) {
		const line = rawLine.trim();

		if (!line || /^#/.test(line)) {
			continue;
		}

		const headingType = resolveBetTypeFromText(line);
		if (headingType) {
			currentType = headingType;
			currentLabel = line;
			continue;
		}

		const match = extractTicketCombinationFromLine(line);
		if (!match) {
			continue;
		}

		const numbers = match.split("-").map((value) => Number(value));
		const type = currentType ?? inferBetTypeFromNumbers(numbers);

		if (!type) {
			continue;
		}

		if ((type === "trifecta" || type === "trio") && numbers.length !== 3) {
			continue;
		}

		if ((type === "exacta" || type === "quinella" || type === "wide") && numbers.length !== 2) {
			continue;
		}

		const dedupeKey = `${type}:${match}`;
		if (seen.has(dedupeKey)) {
			continue;
		}

		seen.add(dedupeKey);

		bets.push({
			type,
			label: currentLabel || typeLabels[type],
			numbers,
			normalized: match,
			amountYen: readAmountYen(line, unitAmountYen),
			sourceLine: line,
		});
	}

	const totalBets = bets.length;
	const trifectaCount = bets.filter((bet) => bet.type === "trifecta").length;
	const exactaCount = bets.filter((bet) => bet.type === "exacta").length;

	if (totalBets > 0 && exactaCount > 0) {
		warnings.push(`競艇予想は通常3連単です。読み取り買い目に2連単が${exactaCount}件含まれています。保存前に内容を確認してください。`);
	}

	return {
		bets,
		totalBets,
		trifectaCount,
		exactaCount,
		totalStakeYen: totalBets * unitAmountYen,
		warnings,
	};
}
