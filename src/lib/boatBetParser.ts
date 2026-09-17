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

export type BoatPredictionCanonicalBlock = {
	date: string | null;
	venue: string | null;
	raceNo: number | null;
	purchasePoints: number | null;
	investmentYen: number | null;
	headerDate: string;
	headerVenue: string;
	headerRaceNo: number;
	text: string;
	status: "ready" | "invalid";
	issues: string[];
};

export type BoatPredictionArchiveSection = {
	raceNo: number;
	text: string;
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

export const BOAT_BET_PARSER_VERSION = "2026-09-17.canonical-copy-range";

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

const normalizeMetadataText = (value: unknown): string =>
	String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();

const readCanonicalMetadataLine = (text: string, key: string): string | null => {
	const match = normalizeBoatBetText(text).match(new RegExp(`^${key}:\\s*(.*?)\\s*$`, "m"));
	return match?.[1]?.trim() || null;
};

export function parseBoatPredictionCanonicalBlocks(predictionText: string): BoatPredictionCanonicalBlock[] {
	const text = normalizeBoatBetText(predictionText);
	const headerMatches = Array.from(text.matchAll(/^【(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([1-9]|1[0-2])R】\s*$/gm));

	return headerMatches.map((match, index) => {
		const blockText = text.slice(match.index ?? 0, headerMatches[index + 1]?.index ?? text.length).trim();
		const headerDate = match[1];
		const headerVenue = normalizeMetadataText(match[2]);
		const headerRaceNo = Number(match[3]);
		const date = readCanonicalMetadataLine(blockText, "date");
		const venue = readCanonicalMetadataLine(blockText, "venue");
		const raceText = readCanonicalMetadataLine(blockText, "race");
		const purchasePointsText = readCanonicalMetadataLine(blockText, "purchasePoints");
		const investmentYenText = readCanonicalMetadataLine(blockText, "investmentYen");
		const raceMatch = raceText?.match(/^([1-9]|1[0-2])R$/);
		const raceNo = raceMatch ? Number(raceMatch[1]) : null;
		const purchasePoints = /^\d+$/.test(purchasePointsText ?? "") ? Number(purchasePointsText) : null;
		const investmentYen = /^\d+$/.test(investmentYenText ?? "") ? Number(investmentYenText) : null;
		const issues: string[] = [];

		if (!date) issues.push("date metadata missing");
		if (!venue) issues.push("venue metadata missing");
		if (raceNo === null) issues.push("race metadata missing or invalid");
		if (purchasePoints === null) issues.push("purchasePoints metadata missing or invalid");
		if (investmentYen === null) issues.push("investmentYen metadata missing or invalid");
		if (date && date !== headerDate) issues.push(`date mismatch: header=${headerDate} metadata=${date}`);
		if (venue && normalizeMetadataText(venue) !== headerVenue) issues.push(`venue mismatch: header=${headerVenue} metadata=${normalizeMetadataText(venue)}`);
		if (raceNo !== null && raceNo !== headerRaceNo) issues.push(`race mismatch: header=${headerRaceNo}R metadata=${raceNo}R`);
		if (purchasePoints !== null && investmentYen !== null && investmentYen !== purchasePoints * DEFAULT_BET_AMOUNT_YEN) {
			issues.push(`investment mismatch: ${investmentYen} != ${purchasePoints} * ${DEFAULT_BET_AMOUNT_YEN}`);
		}

		return {
			date,
			venue: venue ? normalizeMetadataText(venue) : null,
			raceNo,
			purchasePoints,
			investmentYen,
			headerDate,
			headerVenue,
			headerRaceNo,
			text: blockText,
			status: issues.length === 0 ? "ready" : "invalid",
			issues,
		};
	});
}

export function validateBoatPredictionCanonicalSelection(
	predictionText: string,
	expected: { date: string; venueName: string; raceNo: number },
): { usesCanonicalFormat: boolean; valid: boolean; issues: string[]; block: BoatPredictionCanonicalBlock | null } {
	const blocks = parseBoatPredictionCanonicalBlocks(predictionText);
	if (blocks.length === 0) {
		return { usesCanonicalFormat: false, valid: true, issues: [], block: null };
	}

	const issues = blocks.length === 1 ? [...blocks[0].issues] : [`canonical block count must be 1: ${blocks.length}`];
	const block = blocks[0] ?? null;
	if (block) {
		if (block.headerDate !== expected.date) issues.push(`selected date mismatch: expected=${expected.date} actual=${block.headerDate}`);
		if (block.headerVenue !== normalizeMetadataText(expected.venueName)) {
			issues.push(`selected venue mismatch: expected=${normalizeMetadataText(expected.venueName)} actual=${block.headerVenue}`);
		}
		if (block.headerRaceNo !== expected.raceNo) issues.push(`selected race mismatch: expected=${expected.raceNo}R actual=${block.headerRaceNo}R`);
	}

	return { usesCanonicalFormat: true, valid: issues.length === 0, issues, block };
}

export function extractBoatPredictionArchiveSections(text: string | null | undefined): {
	sections: BoatPredictionArchiveSection[];
	warnings: string[];
} {
	if (!text?.trim()) return { sections: [], warnings: [] };
	const canonicalBlocks = parseBoatPredictionCanonicalBlocks(text);
	if (canonicalBlocks.length > 0) {
		return {
			sections: canonicalBlocks
				.filter((block) => block.status === "ready" && block.raceNo !== null)
				.map((block) => ({ raceNo: block.raceNo as number, text: block.text })),
			warnings: canonicalBlocks.flatMap((block) => block.issues),
		};
	}

	const legacyMatches = Array.from(text.matchAll(/^■\s+.+?\s+([1-9]|1[0-2])R\s*$/gm));
	return {
		sections: legacyMatches.map((match, index) => ({
			raceNo: Number(match[1]),
			text: text.slice(match.index ?? 0, legacyMatches[index + 1]?.index ?? text.length),
		})),
		warnings: [],
	};
}

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
	const headingIndexes = lines.flatMap((line, index) => isBetSectionHeading(line) ? [index] : []);

	if (headingIndexes.length <= 0) {
		return { lines: [], text: "", hasSection: false };
	}

	const candidates = headingIndexes.map((startIndex) => {
		const endIndex = lines.findIndex((line, index) => index > startIndex && isBetSectionEndHeading(line));
		const sectionLines = lines.slice(startIndex, endIndex > startIndex ? endIndex : undefined);
		return {
			lines: sectionLines,
			startIndex,
			validRows: countValidBetRows(sectionLines),
		};
	});
	const selected = candidates
		.filter((candidate) => candidate.validRows > 0)
		.sort((left, right) => right.validRows - left.validRows || left.startIndex - right.startIndex)[0] ?? candidates[0];

	return {
		lines: selected.lines,
		text: selected.lines.join("\n").trim(),
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

const readTicketRow = (line: string): {
	index?: string;
	candidate: string;
	explicitType?: BoatBetType;
	explicitLabel?: string;
	canonical?: boolean;
} | null => {
	const normalized = normalizeBoatBetText(line).replace(/^`+|`+$/g, "").trim();
	if (!normalized || /^#/.test(normalized)) {
		return null;
	}

	const canonical = normalized.match(/^(\d{2})\s*[|｜]\s*([^|｜]+?)\s*[|｜]\s*([^|｜]+?)\s*[|｜]\s*(厚め|本線|中穴|大穴)\s*$/);
	if (canonical) {
		return {
			index: canonical[1],
			candidate: canonical[3].trim(),
			explicitType: normalizeBoatBetType(canonical[2]) ?? undefined,
			explicitLabel: canonical[4],
			canonical: true,
		};
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

function countValidBetRows(lines: string[]): number {
	let currentType: BoatBetType | null = null;
	let count = 0;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || /^#/.test(line)) {
			continue;
		}

		const headingType = normalizeBoatBetType(line);
		const row = readTicketRow(line);
		if (headingType && !row) {
			currentType = headingType;
			continue;
		}

		if (!row) {
			continue;
		}

		const parsedCombination = parseCombinationCandidate(row.candidate);
		const type = parsedCombination
			? row.canonical ? row.explicitType ?? null : row.explicitType ?? currentType ?? inferBetTypeFromNumbers(parsedCombination.numbers)
			: null;
		if (parsedCombination && type && validateBoatBetCombination(type, parsedCombination.numbers)) {
			count += 1;
		}
	}

	return count;
}

const looksLikeInvalidTicketRow = (line: string): boolean => {
	if (/^\d{2}\s*[|｜]/.test(normalizeBoatBetText(line).trim())) {
		return true;
	}
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

		const type = row.canonical
			? row.explicitType ?? null
			: row.explicitType ?? currentType ?? inferBetTypeFromNumbers(parsedCombination.numbers);
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
			label: row.explicitLabel || currentLabel || typeLabels[type],
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
