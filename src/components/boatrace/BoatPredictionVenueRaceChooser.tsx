import type { BoatRaceItem, BoatTodayVenueItem } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatPredictionVenueRaceChooserProps = {
	venues: BoatTodayVenueItem[];
	selectedVenueId: string;
	selectedRaceId: string;
	onSelectVenue: (venueId: string) => void;
	onSelectRace: (raceId: string) => void;
};

const wrapStyle = {
	padding: "20px",
	borderRadius: "28px",
	background: "rgba(255, 255, 255, 0.98)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "16px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box" as const,
	overflow: "hidden",
};

const sectionLabelStyle = {
	margin: 0,
	fontSize: "0.82rem",
	fontWeight: 700,
	letterSpacing: "0.06em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
};

const venueRowStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
	gap: "12px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box" as const,
};

const venueCardBaseStyle = {
	padding: "15px",
	borderRadius: "22px",
	border: `1px solid rgba(176, 198, 214, 0.42)`,
	background: "rgba(255, 255, 255, 0.96)",
	display: "grid",
	gap: "8px",
	textAlign: "left" as const,
	cursor: "pointer",
	appearance: "none" as const,
	WebkitAppearance: "none" as const,
	width: "100%",
	boxSizing: "border-box" as const,
	minWidth: 0,
};

const venueTitleStyle = {
	margin: 0,
	fontSize: "1rem",
	fontWeight: 700,
	color: boatTheme.colors.navy,
};

const venueMetaStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "8px",
	color: boatTheme.colors.muted,
	fontSize: "0.9rem",
};

const chipStyle = {
	padding: "5px 10px",
	borderRadius: "999px",
	background: "rgba(236, 246, 251, 0.96)",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 700,
	fontSize: "0.8rem",
	width: "fit-content",
};

const raceWrapStyle = {
	display: "grid",
	gap: "12px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box" as const,
};

const raceGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
	gap: "9px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box" as const,
};

const raceCardBaseStyle = {
	padding: "9px 6px",
	borderRadius: "16px",
	border: `1px solid rgba(176, 198, 214, 0.42)`,
	background: "rgba(255, 255, 255, 0.96)",
	display: "grid",
	gap: "4px",
	minHeight: "54px",
	textAlign: "center" as const,
	cursor: "pointer",
	appearance: "none" as const,
	WebkitAppearance: "none" as const,
	width: "100%",
	minWidth: 0,
	boxSizing: "border-box" as const,
};

const raceTitleStyle = {
	margin: 0,
	fontWeight: 700,
	fontSize: "0.84rem",
};

const raceCaptionStyle = {
	margin: 0,
	fontSize: "0.72rem",
	color: boatTheme.colors.muted,
};

const summaryCardStyle = {
	padding: "18px 20px",
	borderRadius: "22px",
	background: "linear-gradient(180deg, rgba(247, 252, 255, 0.98), rgba(229, 247, 244, 0.92))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "10px",
	color: boatTheme.colors.muted,
	lineHeight: 1.7,
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box" as const,
};

const summaryTitleStyle = {
	margin: 0,
	fontSize: "1.02rem",
	color: boatTheme.colors.navy,
};

const getRaceKey = (venueId: string, race: BoatRaceItem) => race.raceId ?? `${venueId}-${race.raceNo}`;

const getSessionLabel = (session?: string) => {
	if (session === "night") return "ナイター";
	if (session === "day") return "デイ";
	if (session === "morning") return "モーニング";
	if (session === "relay") return "シリーズ";
	return "未設定";
};

export function BoatPredictionVenueRaceChooser({
	venues,
	selectedVenueId,
	selectedRaceId,
	onSelectVenue,
	onSelectRace,
}: BoatPredictionVenueRaceChooserProps) {
	const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? venues[0];
	const races = selectedVenue?.races ?? [];
	const selectedRace = races.find((race) => getRaceKey(selectedVenue.id, race) === selectedRaceId) ?? races[0];

	return (
		<section style={wrapStyle}>
			<div>
				<p style={sectionLabelStyle}>Venues</p>
				<div style={venueRowStyle}>
					{venues.map((venue) => {
						const isSelected = venue.id === selectedVenue.id;
						const style = {
							...venueCardBaseStyle,
							background: isSelected
								? "linear-gradient(180deg, rgba(231, 243, 252, 0.98), rgba(225, 246, 241, 0.96))"
								: venueCardBaseStyle.background,
							border: isSelected ? `1px solid ${boatTheme.colors.aquaDeep}` : venueCardBaseStyle.border,
						};

						return (
							<button type="button" key={venue.id} style={style} onClick={() => onSelectVenue(venue.id)}>
								<p style={venueTitleStyle}>{venue.venueName}</p>
								<div style={venueMetaStyle}>
									<span>{venue.races.length}R</span>
									<span>{getSessionLabel(venue.session)}</span>
								</div>
								<span style={chipStyle}>{venue.weatherActual?.weather ?? "天候未取得"}</span>
								<div style={venueMetaStyle}>風速: {venue.weatherActual?.windSpeed ?? "未取得"}</div>
							</button>
						);
					})}
				</div>
			</div>

			<div style={raceWrapStyle}>
				<p style={sectionLabelStyle}>Races</p>
				<div style={raceGridStyle}>
					{races.map((race) => {
						const raceKey = getRaceKey(selectedVenue.id, race);
						const isSelected = raceKey === selectedRaceId;
						const style = {
							...raceCardBaseStyle,
							background: isSelected ? "#213a67" : raceCardBaseStyle.background,
							color: isSelected ? "#ffffff" : boatTheme.colors.navy,
							border: isSelected ? "1px solid #213a67" : raceCardBaseStyle.border,
						};
						const captionStyle = {
							...raceCaptionStyle,
							color: isSelected ? "rgba(255, 255, 255, 0.76)" : raceCaptionStyle.color,
						};

						return (
							<button type="button" key={raceKey} style={style} onClick={() => onSelectRace(raceKey)}>
								<p style={raceTitleStyle}>{race.raceNo}R</p>
								<p style={captionStyle}>{race.deadlineTime ?? "--:--"}</p>
							</button>
						);
					})}
				</div>
			</div>

			<div style={summaryCardStyle}>
				<h3 style={summaryTitleStyle}>選択中レース情報</h3>
				<div>会場: {selectedVenue?.venueName ?? "-"}</div>
				<div>レース: {selectedRace ? `${selectedRace.raceNo}R ${selectedRace.title ?? ""}` : "-"}</div>
				<div>締切 / 発走: {selectedRace?.deadlineTime ?? "-"} / {selectedRace?.startTime ?? "-"}</div>
				<div>出走 / 展示: {selectedRace?.racers?.length ?? 0}艇 / {selectedRace?.exhibitions?.length ?? 0}艇</div>
				<div>天候 / 風 / 波: {selectedVenue?.weatherActual?.weather ?? "-"} / {selectedVenue?.weatherActual?.windSpeed ?? "-"} / {selectedVenue?.weatherActual?.waveHeight ?? "-"}</div>
			</div>
		</section>
	);
}