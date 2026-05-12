import type { BoatPredictionTicket } from "./boatraceTypes";

const normalizeIndex = (value: string) => value.padStart(2, "0");

const normalizeGroup = (value?: string): BoatPredictionTicket["group"] => {
	if (!value) {
		return "その他";
	}

	if (value.includes("厚め")) {
		return "厚め";
	}

	if (value.includes("本線")) {
		return "本線";
	}

	if (value.includes("穴")) {
		return "穴狙い";
	}

	return "その他";
};

const normalizeBetType = (value?: string): BoatPredictionTicket["betType"] => {
	if (value?.includes("3連単")) {
		return "3連単";
	}

	if (value?.includes("2連単")) {
		return "2連単";
	}

	return value ?? "3連単";
};

const trimHyphenEdges = (value: string) => value.replace(/^-+/, "").replace(/-+$/, "");

export function normalizeBoatCombination(value: string): string {
	return trimHyphenEdges(
		value
			.normalize("NFKC")
			.replace(/[>＞→ー―–－]+/g, "-")
			.replace(/\s+/g, "")
			.trim(),
	);
}

export function parseBoatPredictionTickets(predictionText: string): BoatPredictionTicket[] {
	const lines = predictionText.split(/\r?\n/);
	const tickets: BoatPredictionTicket[] = [];
	const seen = new Set<string>();
	let currentBetType: BoatPredictionTicket["betType"] | undefined;
	let currentGroup: BoatPredictionTicket["group"] | undefined;

	for (const rawLine of lines) {
		const line = rawLine.trim();

		if (!line) {
			continue;
		}

		const headingNormalized = line.normalize("NFKC");
		const headingHasBetType = headingNormalized.includes("3連単") || headingNormalized.includes("2連単");
		const looksLikeHeading = headingHasBetType && !/^\d{1,2}\s+/.test(headingNormalized);

		if (looksLikeHeading) {
			currentBetType = normalizeBetType(headingNormalized);
			currentGroup = normalizeGroup(headingNormalized);
			continue;
		}

		const match = headingNormalized.match(/^(\d{1,2})\s+(?:(3連単|2連単)\s+)?(.+)$/);
		if (!match) {
			continue;
		}

		const [, rawIndex, explicitBetType, remainder] = match;
		const workingBetType = normalizeBetType(explicitBetType ?? currentBetType ?? "3連単");
		const workingGroup = explicitBetType ? normalizeGroup(explicitBetType) : currentGroup ?? "その他";
		const normalizedRemainder = remainder.normalize("NFKC").trim();
		const comboMatch = normalizedRemainder.match(/([1-6][\s>＞→ー―–－-]*[1-6](?:[\s>＞→ー―–－-]*[1-6])?)/);

		if (!comboMatch) {
			continue;
		}

		const combination = normalizeBoatCombination(comboMatch[1]);
		const noteText = normalizedRemainder.replace(comboMatch[1], "").trim();
		const note = noteText || undefined;
		const dedupeKey = `${workingBetType}:${combination}`;

		if (seen.has(dedupeKey)) {
			continue;
		}

		seen.add(dedupeKey);
		tickets.push({
			index: normalizeIndex(rawIndex),
			betType: workingBetType,
			combination,
			group: workingGroup,
			note,
		});
	}

	return tickets;
}

export function countBoatPredictionTicketsByType(tickets: BoatPredictionTicket[]): {
	total: number;
	trifecta: number;
	exacta: number;
	other: number;
} {
	const trifecta = tickets.filter((ticket) => ticket.betType === "3連単").length;
	const exacta = tickets.filter((ticket) => ticket.betType === "2連単").length;
	const other = tickets.length - trifecta - exacta;

	return {
		total: tickets.length,
		trifecta,
		exacta,
		other,
	};
}