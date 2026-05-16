import type { CSSProperties } from "react";
import type { BoatRaceItem, BoatTodayVenueItem } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatPredictionVenueRaceChooserProps = {
	venues: BoatTodayVenueItem[];
	selectedVenueId: string;
	selectedRaceId: string;
	onSelectVenue: (venueId: string) => void;
	onSelectRace: (raceId: string) => void;
};

type SessionTone = {
	background: string;
	border: string;
	shadow: string;
	badgeBackground: string;
	badgeColor: string;
	badgeBorder: string;
	topLine: string;
};

const wrapStyle: CSSProperties = {
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
	boxSizing: "border-box",
	overflow: "hidden",
};

const sectionLabelStyle: CSSProperties = {
	margin: 0,
	fontSize: "0.82rem",
	fontWeight: 800,
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: boatTheme.colors.aquaDeep,
};

const venueRowStyle: CSSProperties = {
	display: "grid",
	gap: "12px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box",
};

const venueCardBaseStyle: CSSProperties = {
	position: "relative",
	overflow: "hidden",
	padding: "15px",
	borderRadius: "22px",
	display: "grid",
	gap: "9px",
	textAlign: "left",
	cursor: "pointer",
	appearance: "none",
	WebkitAppearance: "none",
	width: "100%",
	boxSizing: "border-box",
	minWidth: 0,
	minHeight: "132px",
	transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
};

const venueAccentLineStyle: CSSProperties = {
	position: "absolute",
	inset: "0 0 auto 0",
	height: "5px",
	pointerEvents: "none",
};

const venueTitleStyle: CSSProperties = {
	margin: 0,
	fontSize: "1rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
	letterSpacing: "-0.02em",
};

const venueMetaStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: "8px",
	color: boatTheme.colors.muted,
	fontSize: "0.85rem",
};

const chipStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "5px 10px",
	borderRadius: "999px",
	background: "rgba(236, 246, 251, 0.96)",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 800,
	fontSize: "0.76rem",
	lineHeight: 1.1,
	width: "fit-content",
	boxSizing: "border-box",
};

const weatherLineStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: "7px",
	color: boatTheme.colors.muted,
	fontSize: "0.78rem",
	fontWeight: 700,
};

const raceWrapStyle: CSSProperties = {
	display: "grid",
	gap: "12px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box",
};

const raceGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
	gap: "9px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box",
};

const raceCardBaseStyle: CSSProperties = {
	position: "relative",
	overflow: "hidden",
	padding: "12px 8px",
	borderRadius: "18px",
	border: `1px solid rgba(176, 198, 214, 0.42)`,
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 252, 255, 0.94) 100%)",
	display: "grid",
	gap: "6px",
	minHeight: "66px",
	textAlign: "center",
	cursor: "pointer",
	appearance: "none",
	WebkitAppearance: "none",
	width: "100%",
	minWidth: 0,
	boxSizing: "border-box",
	boxShadow: "0 10px 22px rgba(17, 64, 92, 0.05)",
	transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease",
};

const getSessionLabel = (session?: string) => {
	if (session === "night") return "ナイター";
	if (session === "midnight") return "ミッドナイト";
	if (session === "day") return "デイ";
	if (session === "morning") return "モーニング";
	if (session === "relay") return "シリーズ";
	return "未設定";
};

const getSessionTone = (session?: string): SessionTone => {
	if (session === "morning") {
		return {
			background: "linear-gradient(180deg, rgba(232, 249, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)",
			border: "rgba(93, 199, 232, 0.42)",
			shadow: "0 12px 26px rgba(93, 199, 232, 0.08)",
			badgeBackground: "rgba(224, 247, 255, 0.96)",
			badgeColor: "#147d9f",
			badgeBorder: "rgba(93, 199, 232, 0.34)",
			topLine: "linear-gradient(90deg, #5dc7e8 0%, #a7e9ff 100%)",
		};
	}

	if (session === "day") {
		return {
			background: "linear-gradient(180deg, rgba(236, 253, 245, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)",
			border: "rgba(20, 184, 166, 0.36)",
			shadow: "0 12px 26px rgba(20, 184, 166, 0.08)",
			badgeBackground: "rgba(220, 252, 231, 0.96)",
			badgeColor: "#047857",
			badgeBorder: "rgba(20, 184, 166, 0.3)",
			topLine: "linear-gradient(90deg, #20c997 0%, #a7f3d0 100%)",
		};
	}

	if (session === "night") {
		return {
			background: "linear-gradient(180deg, rgba(233, 242, 255, 0.98) 0%, rgba(245, 249, 255, 0.98) 100%)",
			border: "rgba(36, 74, 112, 0.42)",
			shadow: "0 12px 26px rgba(36, 74, 112, 0.1)",
			badgeBackground: "rgba(224, 234, 255, 0.96)",
			badgeColor: "#213a67",
			badgeBorder: "rgba(36, 74, 112, 0.3)",
			topLine: "linear-gradient(90deg, #24365f 0%, #7aa7ff 100%)",
		};
	}

	if (session === "midnight") {
		return {
			background: "linear-gradient(180deg, rgba(246, 240, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)",
			border: "rgba(159, 137, 216, 0.42)",
			shadow: "0 12px 26px rgba(159, 137, 216, 0.1)",
			badgeBackground: "rgba(243, 232, 255, 0.96)",
			badgeColor: "#7c3aed",
			badgeBorder: "rgba(159, 137, 216, 0.32)",
			topLine: "linear-gradient(90deg, #7c3aed 0%, #c4b5fd 100%)",
		};
	}

	return {
		background: "rgba(255, 255, 255, 0.96)",
		border: "rgba(176, 198, 214, 0.46)",
		shadow: "0 12px 26px rgba(17, 64, 92, 0.055)",
		badgeBackground: "rgba(236, 246, 251, 0.96)",
		badgeColor: boatTheme.colors.aquaDeep,
		badgeBorder: "rgba(176, 198, 214, 0.3)",
		topLine: "linear-gradient(90deg, rgba(93, 199, 232, 0.8) 0%, rgba(20, 184, 166, 0.65) 100%)",
	};
};

const getSessionSortOrder = (session?: string) => {
	if (session === "morning") return 0;
	if (session === "day") return 1;
	if (session === "night") return 2;
	if (session === "midnight") return 3;
	return 9;
};

const getRaceKey = (venueId: string, race: BoatRaceItem) => race.raceId ?? `${venueId}-${race.raceNo}`;

const toArray = <T,>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, T>);
	}

	return [];
};

const getVenueRaces = (venue: BoatTodayVenueItem | undefined): BoatRaceItem[] =>
	toArray<BoatRaceItem>((venue as { races?: unknown } | undefined)?.races);

const getVenueWeather = (venue: BoatTodayVenueItem | undefined) => {
	const source =
		(venue as { weatherActual?: unknown } | undefined)?.weatherActual ??
		(venue as { weather?: unknown } | undefined)?.weather;

	if (!source || typeof source !== "object") {
		return {
			weather: "-",
			windSpeed: "-",
			waveHeight: "-",
		};
	}

	const record = source as Record<string, unknown>;

	return {
		weather: String(record.weather ?? record.condition ?? "-"),
		windSpeed: String(record.windSpeed ?? record.wind ?? "-"),
		waveHeight: String(record.waveHeight ?? record.wave ?? "-"),
	};
};

const getRaceTimeLabel = (race: BoatRaceItem | undefined) => {
	if (!race) return "--:--";

	return String(
		(race as { deadlineTime?: unknown }).deadlineTime ??
			(race as { startTime?: unknown }).startTime ??
			(race as { time?: unknown }).time ??
			"--:--",
	);
};

const hasRaceOddsPreview = (race: BoatRaceItem | undefined) => {
	const oddsPreview = (race as { oddsPreview?: unknown } | undefined)?.oddsPreview;

	if (Array.isArray(oddsPreview)) {
		return oddsPreview.length > 0;
	}

	if (oddsPreview && typeof oddsPreview === "object") {
		return Object.values(oddsPreview as Record<string, unknown>).some((value) => {
			if (Array.isArray(value)) {
				return value.length > 0;
			}

			return Boolean(value);
		});
	}

	return false;
};

const hasRaceResult = (race: BoatRaceItem | undefined) => {
	const result = (race as { result?: unknown } | undefined)?.result;
	const resultStatus = (race as { resultStatus?: unknown } | undefined)?.resultStatus;

	if (resultStatus === "confirmed") {
		return true;
	}

	if (result && typeof result === "object") {
		const status = (result as Record<string, unknown>).status;
		return status === "confirmed";
	}

	return false;
};

const getRaceExhibitionCount = (race: BoatRaceItem | undefined) => {
	const exhibitions = toArray<unknown>((race as { exhibitions?: unknown } | undefined)?.exhibitions);
	const startExhibition = toArray<unknown>((race as { startExhibition?: unknown } | undefined)?.startExhibition);

	return Math.max(exhibitions.length, startExhibition.length);
};

const getVenueStatusLabels = (races: BoatRaceItem[]) => {
	const hasExhibition = races.some((race) => getRaceExhibitionCount(race) > 0);
	const hasOdds = races.some(hasRaceOddsPreview);
	const hasResult = races.some(hasRaceResult);

	return [
		hasExhibition ? "展示あり" : "展示待ち",
		hasOdds ? "オッズあり" : "オッズ待ち",
		hasResult ? "結果あり" : "結果待ち",
	];
};

export function BoatPredictionVenueRaceChooser({
	venues,
	selectedVenueId,
	selectedRaceId,
	onSelectVenue,
	onSelectRace,
}: BoatPredictionVenueRaceChooserProps) {
	const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? venues[0];
	const sortedVenues = [...venues].sort((a, b) => {
	const sessionDiff = getSessionSortOrder(a.session) - getSessionSortOrder(b.session);
	if (sessionDiff !== 0) return sessionDiff;
	return a.venueName.localeCompare(b.venueName, "ja");
});
	const races = getVenueRaces(selectedVenue);
	const venueWeather = getVenueWeather(selectedVenue);

	if (!selectedVenue) {
		return null;
	}

	return (
		<section style={wrapStyle}>
			<style>
				{`
					.boat-prediction-venue-grid {
						grid-template-columns: repeat(7, minmax(0, 1fr));
					}

					.boat-prediction-venue-card:hover {
						transform: translateY(-2px);
						box-shadow: 0 18px 36px rgba(17, 64, 92, 0.1);
					}

					.boat-prediction-race-card:hover {
						transform: translateY(-2px);
						box-shadow: 0 16px 32px rgba(17, 64, 92, 0.12);
					}

					@media (max-width: 1400px) {
						.boat-prediction-venue-grid {
							grid-template-columns: repeat(5, minmax(0, 1fr));
						}
					}

					@media (max-width: 980px) {
						.boat-prediction-venue-grid {
							grid-template-columns: repeat(3, minmax(0, 1fr));
						}

						.boat-prediction-race-grid {
							grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
						}
					}

					@media (max-width: 640px) {
						.boat-prediction-venue-grid {
							grid-template-columns: repeat(2, minmax(0, 1fr));
						}

						.boat-prediction-race-grid {
							grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
						}
					}

					@media (max-width: 460px) {
						.boat-prediction-venue-grid {
							grid-template-columns: 1fr;
						}

						.boat-prediction-race-grid {
							grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
						}
					}
				`}
			</style>

			<div style={{ display: "grid", gap: "12px" }}>
				<p style={sectionLabelStyle}>Venues</p>

				<div className="boat-prediction-venue-grid" style={venueRowStyle}>
					{sortedVenues.map((venue) => {
						const isSelected = venue.id === selectedVenue.id;
						const sessionTone = getSessionTone(venue.session);
						const racesForVenue = getVenueRaces(venue);
						const weather = getVenueWeather(venue);
						const statusLabels = getVenueStatusLabels(racesForVenue);
						const style: CSSProperties = {
							...venueCardBaseStyle,
							background: isSelected
								? "linear-gradient(180deg, rgba(231, 243, 252, 0.98), rgba(225, 246, 241, 0.96))"
								: sessionTone.background,
							border: isSelected ? `1px solid ${boatTheme.colors.aquaDeep}` : `1px solid ${sessionTone.border}`,
							boxShadow: isSelected ? "0 20px 42px rgba(17, 122, 146, 0.16)" : sessionTone.shadow,
						};
						const sessionChipStyle: CSSProperties = {
							...chipStyle,
							background: sessionTone.badgeBackground,
							color: sessionTone.badgeColor,
							border: `1px solid ${sessionTone.badgeBorder}`,
						};

						return (
							<button
								key={venue.id}
								type="button"
								className="boat-prediction-venue-card"
								style={style}
								onClick={() => {
									onSelectVenue(venue.id);
								}}
							>
								<span style={{ ...venueAccentLineStyle, background: sessionTone.topLine }} />

								<h3 style={venueTitleStyle}>{venue.venueName}</h3>

								<div style={venueMetaStyle}>
									<span>{racesForVenue.length}R</span>
									<span style={sessionChipStyle}>{getSessionLabel(venue.session)}</span>
								</div>

								<div style={weatherLineStyle}>
									<span style={chipStyle}>{weather.weather}</span>
									<span>風速: {weather.windSpeed}</span>
								</div>

								<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
									{statusLabels.map((label) => (
										<span
											key={`${venue.id}-${label}`}
											style={{
												...chipStyle,
												padding: "4px 8px",
												fontSize: "0.68rem",
												background: label.includes("あり") ? "rgba(220, 252, 231, 0.95)" : "rgba(236, 246, 251, 0.96)",
												color: label.includes("あり") ? "#047857" : boatTheme.colors.aquaDeep,
											}}
										>
											{label}
										</span>
									))}
								</div>
							</button>
						);
					})}
				</div>
			</div>

			<div style={raceWrapStyle}>
				<p style={sectionLabelStyle}>Races</p>

				<div className="boat-prediction-race-grid" style={raceGridStyle}>
					{races.map((race) => {
						const raceKey = getRaceKey(selectedVenue.id, race);
						const isSelected = raceKey === selectedRaceId;
						const style: CSSProperties = {
							...raceCardBaseStyle,
							background: isSelected
							? "linear-gradient(180deg, #183a59 0%, #244a73 100%)"
							: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 252, 255, 0.94) 100%)",
							border: isSelected ? `1px solid #183a59` : `1px solid rgba(176, 198, 214, 0.42)`,
							color: isSelected ? "#ffffff" : boatTheme.colors.navy,
							boxShadow: isSelected ? "0 16px 34px rgba(24, 58, 89, 0.22)" : "0 10px 22px rgba(17, 64, 92, 0.05)",
							};

						return (
							<button
								key={raceKey}
								type="button"
								className="boat-prediction-race-card"
								style={style}
								onClick={() => onSelectRace(raceKey)}
							>
								<strong style={{ fontSize: "0.95rem", letterSpacing: "-0.01em" }}>{race.raceNo}R</strong>
								<span
									style={{
										fontSize: "0.72rem",
										fontWeight: 700,
										letterSpacing: "0.01em",
										color: isSelected ? "rgba(255,255,255,0.82)" : boatTheme.colors.muted,
									}}
									>
										{getRaceTimeLabel(race)}
								</span>
							</button>
						);
					})}
				</div>

				<p
					style={{
						margin: 0,
						color: boatTheme.colors.muted,
						fontSize: "0.8rem",
						lineHeight: 1.7,
						padding: "2px 2px 0",
						fontWeight: 600,
					}}
				>
					選択会場：{selectedVenue.venueName} / 天候：{venueWeather.weather} / 風速：{venueWeather.windSpeed} / 波：{venueWeather.waveHeight}
				</p>
			</div>
		</section>
	);
}