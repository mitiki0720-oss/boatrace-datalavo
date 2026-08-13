export const PARSER_VERSION = "boat-ex-strict-ticket-parser-v1";
export const CLASSIFIED_GROUPS = ["\u539a\u3081", "\u672c\u7dda", "\u4e2d\u7a74", "\u5927\u7a74"];
const BUY_MARKER = "\u8cb7\u3044\u76ee";
const TRIFECTA_MARKER = "3\u9023\u5358";
const GROUP_PATTERN = new RegExp(CLASSIFIED_GROUPS.join("|"), "u");
const TICKET_PATTERN = /(?:^|\s|\d{1,2}[\s\u3000]+)([1-6])\s*[-\u30fc\uff0d]\s*([1-6])\s*[-\u30fc\uff0d]\s*([1-6])(?=\s|$)/gu;

export const PARSER_RULES = [
	"Only source-backed prediction.textExcerpt values are read.",
	"Only text after the first buy-ticket marker is eligible.",
	"A ticket section must contain the 3-trifecta marker and an allowed group label.",
	"Only a line-level ordered three-boat pattern using 1 through 6 is accepted.",
	"Repeated boat numbers, formation expressions, entrance assumptions, prose, and non-ticket text are skipped.",
	"A hit requires an exact ordered match against officialResult.finishOrder[0..2].",
];

export function sourceBackedPredictionText(record) {
	const prediction = record?.prediction;
	return prediction?.sourceStatus === "available" && typeof prediction?.textExcerpt === "string" && prediction.textExcerpt.trim()
		? prediction.textExcerpt
		: null;
}

function groupForHeading(line) {
	const match = line.match(GROUP_PATTERN);
	return match?.[0] ?? "unclassified-source-text";
}

export function extractStrictStructuredTickets(text, sourcePath) {
	const buyIndex = text.indexOf(BUY_MARKER);
	if (buyIndex < 0) return { tickets: [], skippedReasons: ["buy-ticket-marker-unavailable"] };
	const lines = text.slice(buyIndex).split(/\r?\n/u);
	let activeGroup = null;
	const tickets = [];
	const seen = new Set();
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (line.includes(TRIFECTA_MARKER)) {
			activeGroup = groupForHeading(line);
			continue;
		}
		if (!activeGroup) continue;
		if (/^\s*(?:\d{1,2}[\s\u3000]+)?[1-6]\s*[-\u30fc\uff0d]\s*[1-6]\s*[-\u30fc\uff0d]\s*[1-6]\s*$/u.test(line)) {
			for (const match of line.matchAll(TICKET_PATTERN)) {
				const boatNumbers = match.slice(1, 4).map(Number);
				if (new Set(boatNumbers).size !== 3) continue;
				const key = `${activeGroup}:${boatNumbers.join("-")}`;
				if (seen.has(key)) continue;
				seen.add(key);
				tickets.push({
					ticketId: `strict-${tickets.length + 1}`,
					group: activeGroup,
					boatNumbers,
					sourceText: match[0].trim(),
					sourceLineHint: buyIndex + lines.slice(0, index + 1).join("\n").length,
					sourcePath,
					parseMethod: "strict-ticket-pattern",
				});
			}
		}
	}
	return { tickets, skippedReasons: tickets.length ? [] : ["strict-ticket-pattern-unavailable"] };
}

export function officialResult(record) {
	const order = record?.officialResult?.finishOrder;
	return Array.isArray(order) && order.length >= 3 && order.slice(0, 3).every((value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 6)
		? order.slice(0, 3).map(Number)
		: null;
}

export function parseYen(value) {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
	if (typeof value !== "string") return null;
	const digits = value.normalize("NFKC").replace(/[^0-9]/gu, "");
	return digits ? Number(digits) : null;
}

export function trifectaPayout(record) {
	const payout = (record?.officialResult?.payout ?? []).find((entry) => String(entry?.betType ?? entry?.type ?? entry?.name ?? "").includes(TRIFECTA_MARKER));
	return parseYen(payout?.payoutYen ?? payout?.amount ?? payout?.payoutAmount ?? payout?.payout ?? payout?.yen);
}

export function evaluateTickets(tickets, result, payoutYen) {
	if (!tickets.length) return { evaluationStatus: "structured-ticket-unavailable", hit: null, hitTicketId: null, payoutYen: null };
	if (!result) return { evaluationStatus: "result-unavailable", hit: null, hitTicketId: null, payoutYen: null };
	const hit = tickets.find((ticket) => ticket.boatNumbers.every((boat, index) => boat === result[index])) ?? null;
	return { evaluationStatus: "evaluated", hit: Boolean(hit), hitTicketId: hit?.ticketId ?? null, payoutYen: hit ? payoutYen : null };
}
