import type { BoatTodayVenueItem } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";
import { BoatRaceRow } from "./BoatRaceRow";
import { BoatStatusChip } from "./BoatStatusChip";

type BoatVenueCardProps = {
	venue: BoatTodayVenueItem;
	selectedRaceId?: string;
	onSelectRace?: (venueId: string, raceId: string) => void;
};

const cardStyle = {
	padding: "22px",
	borderRadius: "28px",
	background: "rgba(255, 255, 255, 0.98)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "16px",
	minWidth: 0,
};

const headerStyle = {
	display: "grid",
	gap: "8px",
};

const metaStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "8px",
};

const titleStyle = {
	margin: 0,
	fontSize: "1.25rem",
	color: boatTheme.colors.navy,
};

const descriptionStyle = {
	margin: 0,
	lineHeight: 1.7,
	color: boatTheme.colors.muted,
};

const detailGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: "8px 12px",
	color: boatTheme.colors.muted,
	fontSize: "0.92rem",
	lineHeight: 1.6,
};

const raceListStyle = {
	display: "flex",
	flexWrap: "nowrap" as const,
	gap: "12px",
	overflowX: "auto" as const,
	paddingBottom: "8px",
	WebkitOverflowScrolling: "touch" as const,
};

const getRaceKey = (venueId: string, raceId: string | undefined, raceNo: number) => raceId ?? `${venueId}-${raceNo}`;

export function BoatVenueCard({ venue, selectedRaceId, onSelectRace }: BoatVenueCardProps) {
	return (
		<article style={cardStyle}>
			<header style={headerStyle}>
				<div>
					<h3 style={titleStyle}>{venue.venueName}</h3>
					<p style={descriptionStyle}>{venue.title}</p>
				</div>
				<div style={metaStyle}>
					<BoatStatusChip value={venue.session} />
					<BoatStatusChip value={venue.status} />
					<BoatStatusChip>{`${venue.races.length}R`}</BoatStatusChip>
				</div>
			</header>

			<div style={detailGridStyle}>
				<div>天候: {venue.weatherActual?.weather ?? "-"}</div>
				<div>風向: {venue.weatherActual?.windDirection ?? "-"}</div>
				<div>風速: {venue.weatherActual?.windSpeed ?? "-"}</div>
				<div>波高: {venue.weatherActual?.waveHeight ?? "-"}</div>
			</div>

			<div style={raceListStyle}>
				{venue.races.map((race) => {
					const raceKey = getRaceKey(venue.id, race.raceId, race.raceNo);

					return (
						<BoatRaceRow
							key={raceKey}
							race={race}
							isSelected={selectedRaceId === raceKey}
							onSelect={() => onSelectRace?.(venue.id, raceKey)}
						/>
					);
				})}
			</div>
		</article>
	);
}