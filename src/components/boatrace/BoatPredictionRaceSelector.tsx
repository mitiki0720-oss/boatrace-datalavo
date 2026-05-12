import type { ChangeEvent } from "react";
import type { BoatRaceItem, BoatTodayVenueItem } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatPredictionRaceSelectorProps = {
	venues: BoatTodayVenueItem[];
	selectedVenueId: string;
	selectedRaceId: string;
	onChange: (venueId: string, raceId: string) => void;
};

const wrapStyle = {
	display: "grid",
	gap: "16px",
};

const selectorGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: "14px",
};

const fieldStyle = {
	display: "grid",
	gap: "8px",
};

const labelStyle = {
	margin: 0,
	fontSize: "0.84rem",
	fontWeight: 700,
	color: boatTheme.colors.aquaDeep,
};

const selectStyle = {
	width: "100%",
	padding: "14px 16px",
	borderRadius: "16px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.96)",
	color: boatTheme.colors.navy,
	fontSize: "0.96rem",
	outline: "none",
	boxSizing: "border-box" as const,
};

const infoCardStyle = {
	padding: "16px 18px",
	borderRadius: "20px",
	background: "linear-gradient(180deg, rgba(247, 252, 255, 0.98), rgba(229, 247, 244, 0.92))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "6px",
	color: boatTheme.colors.muted,
	lineHeight: 1.7,
};

const titleStyle = {
	margin: 0,
	fontSize: "1rem",
	fontWeight: 700,
	color: boatTheme.colors.navy,
};

const getRaceKey = (venueId: string, race: BoatRaceItem) => race.raceId ?? `${venueId}-${race.raceNo}`;

export function BoatPredictionRaceSelector({
	venues,
	selectedVenueId,
	selectedRaceId,
	onChange,
}: BoatPredictionRaceSelectorProps) {
	const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? venues[0];
	const races = selectedVenue?.races ?? [];
	const selectedRace = races.find((race) => getRaceKey(selectedVenue.id, race) === selectedRaceId) ?? races[0];

	const handleVenueChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const nextVenueId = event.target.value;
		const nextVenue = venues.find((venue) => venue.id === nextVenueId);
		const nextRace = nextVenue?.races[0];

		if (!nextVenue || !nextRace) {
			return;
		}

		onChange(nextVenueId, getRaceKey(nextVenueId, nextRace));
	};

	const handleRaceChange = (event: ChangeEvent<HTMLSelectElement>) => {
		onChange(selectedVenue.id, event.target.value);
	};

	return (
		<div style={wrapStyle}>
			<div style={selectorGridStyle}>
				<div style={fieldStyle}>
					<p style={labelStyle}>開催場を選択</p>
					<select style={selectStyle} value={selectedVenue.id} onChange={handleVenueChange}>
						{venues.map((venue) => (
							<option key={venue.id} value={venue.id}>
								{venue.venueName}
							</option>
						))}
					</select>
				</div>

				<div style={fieldStyle}>
					<p style={labelStyle}>レースを選択</p>
					<select style={selectStyle} value={selectedRace ? getRaceKey(selectedVenue.id, selectedRace) : ""} onChange={handleRaceChange}>
						{races.map((race) => {
							const raceKey = getRaceKey(selectedVenue.id, race);

							return (
								<option key={raceKey} value={raceKey}>
									{race.raceNo}R {race.title ?? "レース情報"}
								</option>
							);
						})}
					</select>
				</div>
			</div>

			<div style={infoCardStyle}>
				<p style={titleStyle}>{selectedVenue?.venueName ?? "-"} {selectedRace ? `${selectedRace.raceNo}R` : ""}</p>
				<div>レース名: {selectedRace?.title ?? "-"}</div>
				<div>締切: {selectedRace?.deadlineTime ?? "-"}</div>
				<div>発走: {selectedRace?.startTime ?? "-"}</div>
			</div>
		</div>
	);
}