import type { BoatRaceItem } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";
import { BoatStatusChip, getBoatDisplayLabel } from "./BoatStatusChip";

type BoatRaceRowProps = {
	race: BoatRaceItem;
	isSelected?: boolean;
	onSelect?: () => void;
};

const baseRowStyle = {
	padding: "14px",
	borderRadius: "20px",
	background: "linear-gradient(180deg, rgba(238, 248, 255, 0.96), rgba(231, 247, 244, 0.9))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "10px",
	flex: "0 0 auto",
	width: "248px",
	minWidth: "248px",
	textAlign: "left" as const,
	cursor: "pointer",
	appearance: "none" as const,
	WebkitAppearance: "none" as const,
	boxSizing: "border-box" as const,
};

const headerStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "12px",
	flexWrap: "wrap" as const,
};

const labelStyle = {
	margin: 0,
	fontSize: "0.78rem",
	letterSpacing: "0.08em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
	fontWeight: 700,
};

const titleStyle = {
	margin: 0,
	fontSize: "1rem",
	color: boatTheme.colors.navy,
};

const metaGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: "8px 12px",
	color: boatTheme.colors.muted,
	fontSize: "0.92rem",
	lineHeight: 1.6,
};

const resultStyle = {
	paddingTop: "8px",
	borderTop: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "4px",
	color: boatTheme.colors.navy,
	fontWeight: 700,
	fontSize: "0.93rem",
};

export function BoatRaceRow({ race, isSelected = false, onSelect }: BoatRaceRowProps) {
	const rowStyle = {
		...baseRowStyle,
		background: isSelected
			? "linear-gradient(180deg, rgba(209, 241, 249, 0.98), rgba(207, 243, 232, 0.96))"
			: baseRowStyle.background,
		border: isSelected ? `1px solid ${boatTheme.colors.aquaDeep}` : baseRowStyle.border,
		boxShadow: isSelected ? `0 0 0 2px rgba(61, 171, 180, 0.14)` : "none",
	};

	return (
		<button type="button" style={rowStyle} onClick={onSelect} aria-pressed={isSelected}>
			<div style={headerStyle}>
				<div>
					<p style={{ ...labelStyle, marginBottom: "6px" }}>{race.raceNo}R</p>
					<h4 style={titleStyle}>{race.title ?? "レース情報"}</h4>
				</div>
				<BoatStatusChip value={race.status} />
			</div>

			<div style={metaGridStyle}>
				<div>締切: {race.deadlineTime ?? "-"}</div>
				<div>発走: {race.startTime ?? "-"}</div>
				<div>出走数: {race.racers?.length ?? 0}</div>
				<div>展示数: {race.exhibitions?.length ?? 0}</div>
				<div>モーター: {race.racers?.length ?? 0}艇</div>
				<div>結果: {getBoatDisplayLabel(race.result?.status)}</div>
			</div>

			{race.result?.status === "confirmed" ? (
				<div style={resultStyle}>
					<div>結果: {race.result.finishOrder?.join("-") ?? "-"}</div>
					<div>3連単: {race.result.payout3tan?.combination ?? "-"} {race.result.payout3tan?.payout ?? "-"}</div>
				</div>
			) : null}
		</button>
	);
}