import type { BoatPredictionTicket } from "../../lib/boatraceTypes";
import { countBoatPredictionTicketsByType } from "../../lib/boatPredictionParser";
import { boatTheme } from "../../lib/theme";

type BoatPredictionTicketPreviewProps = {
	tickets: BoatPredictionTicket[];
};

const wrapStyle = {
	padding: "18px",
	borderRadius: "22px",
	background: "linear-gradient(180deg, rgba(247, 252, 255, 0.98), rgba(229, 247, 244, 0.92))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "14px",
};

const headerStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "12px",
	flexWrap: "wrap" as const,
};

const titleStyle = {
	margin: 0,
	fontSize: "1rem",
	color: boatTheme.colors.navy,
};

const countRowStyle = {
	display: "flex",
	gap: "8px",
	flexWrap: "wrap" as const,
};

const countChipStyle = {
	padding: "6px 10px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.94)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.navy,
	fontSize: "0.82rem",
	fontWeight: 700,
};

const emptyStyle = {
	margin: 0,
	color: boatTheme.colors.muted,
	lineHeight: 1.7,
};

const ticketGridStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "10px",
};

const getTicketStyle = (group?: BoatPredictionTicket["group"]) => {
	const groupText = String(group ?? "");

	if (groupText === "厚め") {
		return {
			padding: "10px 12px",
			borderRadius: "16px",
			background: "rgba(33, 58, 103, 0.92)",
			color: "#ffffff",
			fontWeight: 700,
			display: "grid",
			gap: "4px",
		};
	}

	if (groupText === "本線") {
		return {
			padding: "10px 12px",
			borderRadius: "16px",
			background: "rgba(219, 244, 247, 0.96)",
			color: boatTheme.colors.navy,
			fontWeight: 700,
			display: "grid",
			gap: "4px",
		};
	}

	if (groupText === "穴狙い" || groupText === "中穴" || groupText === "大穴") {
		return {
			padding: "10px 12px",
			borderRadius: "16px",
			background: "rgba(255, 239, 221, 0.96)",
			color: "#7a4a1f",
			fontWeight: 700,
			display: "grid",
			gap: "4px",
		};
	}

	return {
		padding: "10px 12px",
		borderRadius: "16px",
		background: "rgba(243, 245, 248, 0.96)",
		color: boatTheme.colors.navy,
		fontWeight: 700,
		display: "grid",
		gap: "4px",
	};
};

const metaStyle = {
	fontSize: "0.8rem",
	opacity: 0.86,
};

const getVisibleGroup = (group?: BoatPredictionTicket["group"]): string => {
	const groupText = String(group ?? "").trim();

	if (!groupText || groupText === "その他") {
		return "";
	}

	return groupText;
};

export function BoatPredictionTicketPreview({ tickets }: BoatPredictionTicketPreviewProps) {
	const counts = countBoatPredictionTicketsByType(tickets);

	return (
		<section style={wrapStyle}>
			<div style={headerStyle}>
				<h4 style={titleStyle}>読み取り買い目</h4>
				<div style={countRowStyle}>
					<span style={countChipStyle}>買い目数 {counts.total}</span>
					<span style={countChipStyle}>3連単 {counts.trifecta}</span>
					<span style={countChipStyle}>2連単 {counts.exacta}</span>
				</div>
			</div>

			{tickets.length === 0 ? (
				<p style={emptyStyle}>GPT予想を貼り付けると、ここに読み取った買い目が表示されます。</p>
			) : (
				<div style={ticketGridStyle}>
					{tickets.map((ticket) => {
						const visibleGroup = getVisibleGroup(ticket.group);

						return (
							<article key={`${ticket.index}-${ticket.betType}-${ticket.combination}`} style={getTicketStyle(ticket.group)}>
								<div>
									{ticket.index} {ticket.betType} {ticket.combination}
								</div>
								{visibleGroup ? <div style={metaStyle}>{visibleGroup}</div> : null}
							</article>
						);
					})}
				</div>
			)}
		</section>
	);
}