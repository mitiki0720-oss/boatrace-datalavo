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
};

const DEFAULT_BET_AMOUNT_YEN = 100;

const typeLabels: Record<BoatBetType, string> = {
	trifecta: "3連単",
	exacta: "2連単",
	trio: "3連複",
	quinella: "2連複",
	wide: "拡連複",
};

export const emptyBoatBetSummary = (): ParsedBoatBetSummary => ({
	bets: [],
	totalBets: 0,
	trifectaCount: 0,
	exactaCount: 0,
	totalStakeYen: 0,
});

export function normalizeBoatBetCombination(value: string): string {
	return value
		.normalize("NFKC")
		.replace(/[‐-‒–—―−－ーｰ~〜～>＞=＝]/g, "-")
		.replace(/\s+/g, "")
		.replace(/^-+|-+$/g, "");
}

const resolveBetTypeFromText = (value: string): BoatBetType | null => {
	const text = value.normalize("NFKC");

	if (/3\s*連\s*単|三\s*連\s*単|3\s*単/.test(text)) {
		return "trifecta";
	}

	if (/2\s*連\s*単|二\s*連\s*単|2\s*単/.test(text)) {
		return "exacta";
	}

	if (/3\s*連\s*複|三\s*連\s*複|3\s*複/.test(text)) {
		return "trio";
	}

	if (/2\s*連\s*複|二\s*連\s*複|2\s*複/.test(text)) {
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

const extractBoatBetSection = (predictionText: string): string[] => {
	const lines = predictionText.split(/\r?\n/);

	const startIndex = lines.findIndex((line) => {
		const text = line.normalize("NFKC");
		return /買い目|買い目📝|BET|ベット/i.test(text);
	});

	if (startIndex < 0) {
		return lines;
	}

	const endIndex = lines.findIndex((line, index) => {
		if (index <= startIndex) {
			return false;
		}

		const text = line.normalize("NFKC").replace(/[【】]/g, "").trim();

		return /^(タグ|危険な人気|穴候補|結果|振り返り|メモ追記|レビュー|総評)/i.test(text);
	});

	return lines.slice(startIndex, endIndex > startIndex ? endIndex : undefined);
};

const extractTicketCombinationFromLine = (line: string): string | null => {
	const normalized = line
		.normalize("NFKC")
		.replace(/[‐-‒–—―−－ーｰ~〜～>＞=＝]/g, "-")
		.trim();

	const match = normalized.match(/^(?:0?[1-9]|1[0-2])(?:[.)．、]|\s)+([1-6]\s*-\s*[1-6](?:\s*-\s*[1-6])?)(?:\s|$)/);

	if (!match) {
		return null;
	}

	return normalizeBoatBetCombination(match[1]);
};

export function parseBoatBets(predictionText: string, unitAmountYen = DEFAULT_BET_AMOUNT_YEN): ParsedBoatBetSummary {
	const bets: ParsedBoatBet[] = [];
	const seen = new Set<string>();
	let currentType: BoatBetType | null = null;
	let currentLabel = "";

	for (const rawLine of extractBoatBetSection(predictionText)) {
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

	return {
		bets,
		totalBets,
		trifectaCount,
		exactaCount,
		totalStakeYen: totalBets * unitAmountYen,
	};
}