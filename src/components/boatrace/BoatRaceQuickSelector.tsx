import type { BoatRaceItem } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatRaceQuickSelectorProps = {
	venueId: string;
	races: BoatRaceItem[];
	selectedRaceId: string;
	onSelectRace: (raceId: string) => void;
};

function getRaceKey(venueId: string, race: BoatRaceItem): string {
	return race.raceId ?? `${venueId}-${race.raceNo}`;
}

function getRaceTime(race: BoatRaceItem): string {
	const time = race.deadlineTime ?? race.startTime;
	return time && time.trim().length > 0 ? time : "--:--";
}

function getRaceTitle(race: BoatRaceItem): string {
	if (!race.title) {
		return "";
	}

	const normalizedPlaceholderTitle = `${race.raceNo}R`;
	return race.title.trim() === normalizedPlaceholderTitle ? "" : race.title;
}

export function BoatRaceQuickSelector({
	venueId,
	races,
	selectedRaceId,
	onSelectRace,
}: BoatRaceQuickSelectorProps) {
	return (
		<section style={{ display: "grid", gap: "10px" }}>
			<div style={{ display: "grid", gap: "6px", maxWidth: "560px" }}>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						width: "fit-content",
						padding: "6px 12px",
						borderRadius: "999px",
						background: "rgba(255, 255, 255, 0.82)",
						border: `1px solid ${boatTheme.colors.line}`,
						color: boatTheme.colors.aquaDeep,
						fontSize: "0.72rem",
						fontWeight: 800,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
					}}
				>
					Race Selector / Quick Jump
				</span>

				<h3
					style={{
						margin: 0,
						fontSize: "1.45rem",
						lineHeight: 1.18,
						color: boatTheme.colors.navy,
						fontWeight: 800,
					}}
				>
					1R〜12R を選ぶ
				</h3>
			</div>

			<div
				style={{
					position: "relative" as const,
					borderRadius: "24px",
					border: `1px solid ${boatTheme.colors.line}`,
					background: "linear-gradient(180deg, rgba(250, 253, 255, 0.98), rgba(241, 249, 254, 0.95))",
				}}
			>
				<div
					style={{
						overflowX: "auto",
						padding: "12px 12px 12px",
						scrollbarWidth: "thin",
						scrollbarColor: "rgba(24, 115, 152, 0.24) transparent",
					}}
				>
					<div style={{ display: "flex", gap: "10px", minWidth: "max-content" }}>
						{races.map((race) => {
							const raceKey = getRaceKey(venueId, race);
							const isSelected = raceKey === selectedRaceId;
							const raceTitle = getRaceTitle(race);

							return (
								<button
									key={raceKey}
									type="button"
									onClick={() => {
										onSelectRace(raceKey);
									}}
									style={{
										width: "129px",
										minWidth: "129px",
										minHeight: "68px",
										padding: "12px 14px 10px",
										borderRadius: "18px",
										border: isSelected
											? "1px solid rgba(18, 50, 74, 0.92)"
											: "1px solid rgba(93, 199, 232, 0.18)",
										background: isSelected
											? "linear-gradient(180deg, rgba(18, 50, 74, 0.98), rgba(31, 73, 104, 0.96))"
											: "linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(247, 252, 255, 0.95))",
										boxShadow: isSelected
											? "0 14px 26px rgba(18, 50, 74, 0.14)"
											: "0 6px 14px rgba(17, 64, 92, 0.04)",
										display: "grid",
										gap: "6px",
										textAlign: "left" as const,
										cursor: "pointer",
										flex: "0 0 auto",
										alignContent: "space-between",
										boxSizing: "border-box" as const,
									}}
								>
									<div style={{ display: "grid", gap: "3px", alignContent: "start" }}>
										<p
											style={{
												margin: 0,
												fontSize: "1.5rem",
												fontWeight: 900,
												lineHeight: 1,
												color: isSelected ? "#ffffff" : boatTheme.colors.navy,
												letterSpacing: "0.01em",
											}}
										>
											{race.raceNo}R
										</p>

										{raceTitle ? (
											<p
												style={{
													margin: 0,
													fontSize: "0.66rem",
													lineHeight: 1.25,
													whiteSpace: "nowrap",
													overflow: "hidden",
													textOverflow: "ellipsis",
													color: isSelected ? "rgba(255, 255, 255, 0.82)" : boatTheme.colors.muted,
													fontWeight: 700,
												}}
											>
												{raceTitle}
											</p>
										) : (
											<div style={{ height: "10px" }} />
										)}
									</div>

									<p
										style={{
											margin: 0,
											fontSize: "0.78rem",
											fontWeight: 800,
											lineHeight: 1.1,
											color: isSelected ? "rgba(255, 255, 255, 0.92)" : boatTheme.colors.aquaDeep,
											alignSelf: "end",
										}}
									>
										{getRaceTime(race)}
									</p>
								</button>
							);
						})}
					</div>
				</div>

				<div
					aria-hidden="true"
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						bottom: "12px",
						width: "30px",
						background: "linear-gradient(90deg, rgba(248, 252, 255, 0.98), rgba(248, 252, 255, 0))",
						pointerEvents: "none",
					}}
				/>

				<div
					aria-hidden="true"
					style={{
						position: "absolute",
						right: 0,
						top: 0,
						bottom: "12px",
						width: "30px",
						background: "linear-gradient(270deg, rgba(248, 252, 255, 0.98), rgba(248, 252, 255, 0))",
						pointerEvents: "none",
					}}
				/>
			</div>
		</section>
	);
}