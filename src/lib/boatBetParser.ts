export type BoatBetType = "trifecta" | "exacta" | "trio" | "quinella" | "wide";

export type BoatPredictionParseStatus = "ready" | "warning" | "invalid" | "missing-section";

export type ParsedBoatBet = {
	type: BoatBetType;
	label: string;
	numbers: number[];
	normalized: string;
	amountYen: number;
	sourceLine: string;
	index?: string;
};

export type ParsedBoatBetSummary = {
	bets: ParsedBoatBet[];
	totalBets: number;
	trifectaCount: number;
	exactaCount: number;
	totalStakeYen: number;
	warnings?: string[];
	betSectionText?: string;
	parseStatus?: BoatPredictionParseStatus;
	parsedAt?: string;
	parserVersion?: string;
	invalidRows?: string[];
	duplicateRows?: string[];
};

type ExtractedBetSection = {
	lines: string[];
	text: string;
	hasSection: boolean;
};

type ParsedCombination = {
	normalized: string;
	numbers: number[];
	remainder: string;
};

const DEFAULT_BET_AMOUNT_YEN = 100;

export const BOAT_BET_PARSER_VERSION = "2026-06-04.bet-result-consistency";

const typeLabels: Record<BoatBetType, string> = {
	trifecta: "3連単",
	exacta: "2連単",
	trio: "3連複",
	quinella: "2連複",
	wide: "拡連複",
};

const HYPHEN_LIKE_PATTERN = /[\u2010-\u2015\u2212\u30fc\uff0d\uff70\u301c\uff5e]/g;
const ARROW_LIKE_PATTERN = /[→⇒➜➝＞>]/g;
const BRACKET_PATTERN = /^[\s【】\[\]［］「」『』《》〈〉〔〕（）()]+|[\s【】\[\]［］「」『』《》〈〉〔〕（）()]+$/g;

export const emptyBoatBetSummary = (): ParsedBoatBetSummary => ({
	bets: [],
	totalBets: 0,
	trifectaCount: 0,
	exactaCount: 0,
	totalStakeYen: 0,
	warnings: [],
	betSectionText: "",
	parseStatus: "invalid",
	parsedAt: "",
	parserVersion: BOAT_BET_PARSER_VERSION,
	invalidRows: [],
	duplicateRows: [],
});

export function normalizeBoatBetText(value: string): string {
	return String(value ?? "")
		.normalize("NFKC")
		.replace(/\r\n?/g, "\n")
		.replace(HYPHEN_LIKE_PATTERN, "-")
		.replace(ARROW_LIKE_PATTERN, "-");
}

export function normalizeBoatBetCombination(value: string): string {
	return normalizeBoatBetText(value)
		.replace(/\s*-\s*/g, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function normalizeBoatBetType(value?: string | null): BoatBetType | null {
	const text = normalizeBoatBetText(String(value ?? "")).replace(/\s+/g, "").toLowerCase();

	if (/3連単|三連単|3単|trifecta|sanrentan/.test(text)) return "trifecta";
	if (/2連単|二連単|2単|exacta|nirentan/.test(text)) return "exacta";
	if (/3連複|三連複|3複|trio|sanrenpuku/.test(text)) return "trio";
	if (/2連複|二連複|2複|quinella|nirenpuku/.test(text)) return "quinella";
	if (/拡連複|ワイド|wide/.test(text)) return "wide";

	return null;
}

export function validateBoatBetCombination(type: BoatBetType, numbers: number[]): boolean {
	if (numbers.some((value) => !Number.isInteger(value) || value < 1 || value > 6)) {
		return false;
	}

	if (new Set(numbers).size !== numbers.length) {
		return false;
	}

	if (type === "trifecta" || type === "trio") {
		return numbers.length === 3;
	}

	return numbers.length === 2;
}

const inferBetTypeFromNumbers = (numbers: number[]): BoatBetType | null => {
	if (numbers.length === 3) return "trifecta";
	if (numbers.length === 2) return "exacta";
	return null;
};

const normalizeHeadingText = (line: string): string =>
	normalizeBoatBetText(line).replace(BRACKET_PATTERN, "").trim();

const isBetSectionHeading = (line: string): boolean => {
	const text = normalizeHeadingText(line);
	return /買い目|買目|投票|舟券|BET|ベット/i.test(text);
};

const isBetSectionEndHeading = (line: string): boolean => {
	const text = normalizeHeadingText(line);

	if (!text) {
		return false;
	}

	if (/^(タグ|メモ|レビュー|振り返り|最終チェック|危険|注意|考察まとめ|買う理由|展開|展示|スタート|ST|予想根拠)/i.test(text)) {
		return true;
	}

	const trimmed = normalizeBoatBetText(line).trim();
	return /^[【［\[\(（]/.test(trimmed) && !isBetSectionHeading(trimmed) && !normalizeBoatBetType(trimmed);
};

export function extractBoatBetSection(predictionText: string): ExtractedBetSection {
	const lines = normalizeBoatBetText(predictionText).split("\n");
	const startIndex = lines.findIndex(isBetSectionHeading);

	if (startIndex < 0) {
		return { lines: [], text: "", hasSection: false };
	}

	const endIndex = lines.findIndex((line, index) => index > startIndex && isBetSectionEndHeading(line));
	const sectionLines = lines.slice(startIndex, endIndex > startIndex ? endIndex : undefined);

	return {
		lines: sectionLines,
		text: sectionLines.join("\n").trim(),
		hasSection: true,
	};
}

const readAmountYen = (line: string, unitAmountYen: number): number => {
	const normalized = normalizeBoatBetText(line);
	const match = normalized.match(/(?:¥\s*([\d,]+)|([\d,]+)\s*円)/i);
	if (!match) {
		return unitAmountYen;
	}

	const parsed = Number(String(match[1] ?? match[2]).replace(/[^\d]/g, ""));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : unitAmountYen;
};

const readTicketRow = (line: string): { index?: string; candidate: string } | null => {
	const normalized = normalizeBoatBetText(line).replace(/^`+|`+$/g, "").trim();
	if (!normalized || /^#/.test(normalized)) {
		return null;
	}

	const indexed = normalized.match(/^(\d{1,2})\s*(?:[:：.)）]|[\s　]+)\s*(.+)$/);
	if (indexed) {
		return {
			index: indexed[1].padStart(2, "0"),
			candidate: indexed[2].trim(),
		};
	}

	if (/^[1-6](?:\s*-|\s+)[1-6]/.test(normalized)) {
		return { candidate: normalized };
	}

	return null;
};

const parseCombinationCandidate = (candidate: string): ParsedCombination | null => {
	const normalized = normalizeBoatBetText(candidate).trim();
	const dashed = normalized.match(/^([1-6])\s*-\s*([1-6])(?:\s*-\s*([1-6]))?(\s*-\s*\d+)?(.*)$/);

	if (dashed) {
		if (dashed[4]) {
			return null;
		}

		const numbers = [dashed[1], dashed[2], dashed[3]].filter(Boolean).map(Number);
		return {
			normalized: numbers.join("-"),
			numbers,
			remainder: String(dashed[5] ?? "").trim(),
		};
	}

	const spaced = normalized.match(/^([1-6])\s+([1-6])(?:\s+([1-6]))?(\s+\d+)?(.*)$/);
	if (!spaced || spaced[4]) {
		return null;
	}

	const numbers = [spaced[1], spaced[2], spaced[3]].filter(Boolean).map(Number);
	return {
		normalized: numbers.join("-"),
		numbers,
		remainder: String(spaced[5] ?? "").trim(),
	};
};

const looksLikeInvalidTicketRow = (line: string): boolean => {
	const row = readTicketRow(line);
	if (!row) {
		return false;
	}

	return /^[0-9０-９]/.test(row.candidate) || /^[1-6][\s\-→⇒＞>]/.test(normalizeBoatBetText(row.candidate));
};

const buildParseStatus = (params: {
	hasSection: boolean;
	betsCount: number;
	warningsCount: number;
	invalidRowsCount: number;
}): BoatPredictionParseStatus => {
	if (!params.hasSection) {
		return "missing-section";
	}

	if (params.betsCount <= 0) {
		return "invalid";
	}

	if (params.warningsCount > 0 || params.invalidRowsCount > 0) {
		return "warning";
	}

	return "ready";
};

export function parseBoatBets(predictionText: string, unitAmountYen = DEFAULT_BET_AMOUNT_YEN): ParsedBoatBetSummary {
	const bets: ParsedBoatBet[] = [];
	const seen = new Set<string>();
	const warnings: string[] = [];
	const invalidRows: string[] = [];
	const duplicateRows: string[] = [];
	let currentType: BoatBetType | null = null;
	let currentLabel = "";
	const section = extractBoatBetSection(predictionText);

	if (!section.hasSection) {
		const missingWarnings = ["bet section not found"];
		return {
			...emptyBoatBetSummary(),
			warnings: missingWarnings,
			parseStatus: "missing-section",
			parsedAt: new Date().toISOString(),
		};
	}

	for (const rawLine of section.lines) {
		const line = rawLine.trim();

		if (!line || /^#/.test(line)) {
			continue;
		}

		const headingType = normalizeBoatBetType(line);
		const row = readTicketRow(line);
		if (headingType && !row) {
			currentType = headingType;
			currentLabel = line;
			continue;
		}

		if (!row) {
			continue;
		}

		const parsedCombination = parseCombinationCandidate(row.candidate);
		if (!parsedCombination) {
			if (looksLikeInvalidTicketRow(line)) {
				invalidRows.push(line);
			}
			continue;
		}

		const type = currentType ?? inferBetTypeFromNumbers(parsedCombination.numbers);
		if (!type || !validateBoatBetCombination(type, parsedCombination.numbers)) {
			invalidRows.push(line);
			continue;
		}

		const duplicateKey = `${type}:${parsedCombination.normalized}`;
		if (seen.has(duplicateKey)) {
			duplicateRows.push(line);
		}
		seen.add(duplicateKey);

		bets.push({
			type,
			label: currentLabel || typeLabels[type],
			numbers: parsedCombination.numbers,
			normalized: parsedCombination.normalized,
			amountYen: readAmountYen(line, unitAmountYen),
			sourceLine: line,
			index: row.index,
		});
	}

	const trifectaCount = bets.filter((bet) => bet.type === "trifecta").length;
	const exactaCount = bets.filter((bet) => bet.type === "exacta").length;

	if (exactaCount > 0) {
		warnings.push(`exacta rows detected: ${exactaCount}`);
	}

	if (duplicateRows.length > 0) {
		warnings.push(`duplicate ticket rows detected: ${duplicateRows.length}`);
	}

	if (invalidRows.length > 0) {
		warnings.push(`invalid ticket rows ignored: ${invalidRows.length}`);
	}

	const parseStatus = buildParseStatus({
		hasSection: section.hasSection,
		betsCount: bets.length,
		warningsCount: warnings.length,
		invalidRowsCount: invalidRows.length,
	});

	return {
		bets,
		totalBets: bets.length,
		trifectaCount,
		exactaCount,
		totalStakeYen: bets.reduce((sum, bet) => sum + bet.amountYen, 0),
		warnings,
		betSectionText: section.text,
		parseStatus,
		parsedAt: new Date().toISOString(),
		parserVersion: BOAT_BET_PARSER_VERSION,
		invalidRows,
		duplicateRows,
	};
}
