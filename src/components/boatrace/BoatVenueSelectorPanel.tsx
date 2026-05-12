import type { BoatTodayVenueItem } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatVenueSelectorPanelProps = {
	venues: BoatTodayVenueItem[];
	selectedVenueId: string;
	onSelectVenue: (venueId: string) => void;
};

function getVenueDayBadge(venue: BoatTodayVenueItem & { dayText?: string }): string {
	const dayText = String(venue.dayText ?? "").trim();

	if (!dayText) {
		return "";
	}

	const normalizedDayText = dayText
		.replace(/[０-９]/g, (value) => String.fromCharCode(value.charCodeAt(0) - 0xfee0))
		.replace(/\s/g, "");

	const dayOnlyText = normalizedDayText.replace(
		/\d{1,2}\/\d{1,2}[-ー〜~]\d{1,2}\/\d{1,2}/g,
		"",
	);

	if (dayOnlyText.includes("初日")) {
		return "初日";
	}

	if (dayOnlyText.includes("最終")) {
		return "最終日";
	}

	const dayMatch = dayOnlyText.match(/([1-9][0-9]?)日目/);

	if (dayMatch?.[1]) {
		return `${dayMatch[1]}日目`;
	}

	return "";
}

const sectionStyle = {
	display: "grid",
	gap: "16px",
};

const headingStyle = {
	display: "grid",
	gap: "6px",
	maxWidth: "580px",
	marginBottom: "4px",
};

const eyebrowStyle = {
	display: "inline-flex",
	alignItems: "center",
	width: "fit-content",
	padding: "5px 10px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.82)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.68rem",
	fontWeight: 600,
	letterSpacing: "0.14em",
	textTransform: "uppercase" as const,
};

const titleStyle = {
	margin: 0,
	fontSize: "1.58rem",
	lineHeight: 1.14,
	color: boatTheme.colors.navy,
	fontWeight: 800,
};

const descriptionStyle = {
	margin: 0,
	fontSize: "0.84rem",
	color: boatTheme.colors.muted,
	lineHeight: 1.55,
	maxWidth: "46rem",
};

const gridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(242px, 1fr))",
	gap: "14px",
};

const spotlightTextColumnStyle = {
	display: "grid",
	alignContent: "start",
	gap: "18px",
	minWidth: 0,
	paddingRight: "10px",
};

const spotlightTitleBlockStyle = {
	display: "grid",
	gap: "8px",
};

const spotlightEyebrowStyle = {
	display: "inline-flex",
	alignItems: "center",
	width: "fit-content",
	padding: "7px 12px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.82)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.72rem",
	fontWeight: 800,
	letterSpacing: "0.12em",
	textTransform: "uppercase" as const,
};

const spotlightVenueNameStyle = {
	margin: 0,
	fontSize: "2rem",
	lineHeight: 1.08,
	color: boatTheme.colors.navy,
	fontWeight: 800,
};

const spotlightTitleStyle = {
	margin: 0,
	fontSize: "1.08rem",
	lineHeight: 1.45,
	color: boatTheme.colors.navy,
	fontWeight: 700,
};

const spotlightSummaryStyle = {
	margin: 0,
	fontSize: "0.92rem",
	lineHeight: 1.8,
	color: boatTheme.colors.muted,
	maxWidth: "40rem",
};

const spotlightMetaRowStyle = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	flexWrap: "wrap" as const,
};

const venueDayBadgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "fit-content",
	padding: "5px 9px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.92)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.72rem",
	fontWeight: 900,
	lineHeight: 1,
};

function getSessionLabel(session?: string): string {
	const normalized = session?.toLowerCase();

	if (normalized === "morning") {
		return "Morning";
	}

	if (normalized === "day") {
		return "Day";
	}

	if (normalized === "night") {
		return "Night";
	}

	if (normalized === "midnight") {
		return "Midnight";
	}

	if (normalized === "relay") {
		return "Relay";
	}

	return "Schedule";
}

function getSessionStyle(session?: string) {
	const normalized = session?.toLowerCase();

	if (normalized === "morning") {
		return {
			background: "rgba(220, 242, 255, 0.96)",
			color: boatTheme.colors.aquaDeep,
			border: "1px solid rgba(93, 199, 232, 0.3)",
		};
	}

	if (normalized === "day") {
		return {
			background: "rgba(229, 248, 241, 0.98)",
			color: "#1e6f61",
			border: "1px solid rgba(126, 215, 194, 0.32)",
		};
	}

	if (normalized === "night") {
		return {
			background: "rgba(29, 59, 91, 0.96)",
			color: "#ffffff",
			border: "1px solid rgba(29, 59, 91, 0.92)",
		};
	}

	if (normalized === "midnight") {
		return {
			background: "rgba(239, 235, 255, 0.98)",
			color: "#6659ad",
			border: "1px solid rgba(140, 128, 188, 0.28)",
		};
	}

	return {
		background: "rgba(247, 252, 255, 0.96)",
		color: boatTheme.colors.aquaDeep,
		border: `1px solid ${boatTheme.colors.line}`,
	};
}

function getSessionCardTone(session?: string) {
	const normalized = session?.toLowerCase();

	if (normalized === "morning") {
		return {
			background: "linear-gradient(180deg, rgba(242, 250, 255, 0.995), rgba(217, 240, 255, 0.985))",
			border: "1px solid rgba(93, 199, 232, 0.42)",
			accent: "linear-gradient(90deg, rgba(88, 194, 232, 0.98), rgba(164, 227, 248, 0.92))",
			subtleSurface: "rgba(225, 243, 255, 0.88)",
		};
	}

	if (normalized === "day") {
		return {
			background: "linear-gradient(180deg, rgba(246, 253, 251, 0.995), rgba(226, 247, 238, 0.985))",
			border: "1px solid rgba(126, 215, 194, 0.42)",
			accent: "linear-gradient(90deg, rgba(109, 214, 188, 0.98), rgba(180, 235, 221, 0.92))",
			subtleSurface: "rgba(228, 247, 239, 0.9)",
		};
	}

	if (normalized === "night") {
		return {
			background: "linear-gradient(180deg, rgba(241, 245, 251, 0.995), rgba(225, 232, 242, 0.985))",
			border: "1px solid rgba(84, 103, 129, 0.42)",
			accent: "linear-gradient(90deg, rgba(29, 59, 91, 0.98), rgba(76, 103, 133, 0.92))",
			subtleSurface: "rgba(227, 233, 242, 0.9)",
		};
	}

	if (normalized === "midnight") {
		return {
			background: "linear-gradient(180deg, rgba(248, 246, 253, 0.995), rgba(233, 229, 244, 0.985))",
			border: "1px solid rgba(159, 148, 193, 0.42)",
			accent: "linear-gradient(90deg, rgba(132, 122, 168, 0.96), rgba(187, 177, 214, 0.92))",
			subtleSurface: "rgba(236, 232, 246, 0.9)",
		};
	}

	return {
		background: "linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 252, 255, 0.96))",
		border: `1px solid ${boatTheme.colors.line}`,
		accent: "linear-gradient(90deg, rgba(93, 199, 232, 0.7), rgba(139, 225, 208, 0.7))",
		subtleSurface: "rgba(247, 252, 255, 0.94)",
	};
}

function getGradeLabel(title?: string): string | null {
	if (!title) {
		return null;
	}

	const match = title.match(/SG|GI|GII|GIII|G1|G2|G3/i);
	return match ? match[0].toUpperCase() : null;
}

function getDisplayTime(value?: string): string {
	return value && value.trim().length > 0 ? value : "--:--";
}

function getFirstTimedRace(venue: BoatTodayVenueItem) {
	return venue.races.find((race) => Boolean(race.deadlineTime?.trim() || race.startTime?.trim()));
}

function getLastTimedRace(venue: BoatTodayVenueItem) {
	return [...venue.races].reverse().find((race) => Boolean(race.deadlineTime?.trim() || race.startTime?.trim()));
}

function getFirstRaceTime(venue: BoatTodayVenueItem): string {
	const firstRace = getFirstTimedRace(venue);
	return getDisplayTime(firstRace?.deadlineTime ?? firstRace?.startTime);
}

function getLastRaceTime(venue: BoatTodayVenueItem): string {
	const lastRace = getLastTimedRace(venue);
	return getDisplayTime(lastRace?.deadlineTime ?? lastRace?.startTime);
}

function getRaceCountLabel(venue: BoatTodayVenueItem): string {
	return venue.races.length > 0 ? `${venue.races.length}R` : "12R予定";
}

export function BoatVenueSelectorPanel({ venues, selectedVenueId, onSelectVenue }: BoatVenueSelectorPanelProps) {
	return (
		<section style={sectionStyle}>
			<div style={headingStyle}>
				<span style={eyebrowStyle}>Today&apos;s Venues / Pick a Track</span>
				<h3 style={titleStyle}>今日の開催会場を選ぶ</h3>
				<p style={descriptionStyle}>一覧で見比べながら、今見たい会場へすぐ切り替えられます。</p>
			</div>

			<div style={gridStyle}>
				{venues.map((venue) => {
					const isSelected = venue.id === selectedVenueId;
					const gradeLabel = getGradeLabel(venue.title);
					const dayBadge = getVenueDayBadge(venue);
					const sessionCardTone = getSessionCardTone(venue.session);

					return (
						<button
							key={venue.id}
							type="button"
							onClick={() => {
								onSelectVenue(venue.id);
							}}
							style={{
								padding: "18px 18px 16px",
								borderRadius: "24px",
								border: isSelected ? "1px solid rgba(56, 159, 208, 0.72)" : sessionCardTone.border,
								background: isSelected
									? "linear-gradient(180deg, rgba(244, 251, 255, 0.995), rgba(230, 244, 253, 0.992) 60%, rgba(236, 249, 245, 0.985))"
									: sessionCardTone.background,
								boxShadow: isSelected ? "0 20px 38px rgba(17, 64, 92, 0.14)" : "0 8px 18px rgba(17, 64, 92, 0.045)",
								display: "grid",
								gap: "11px",
								textAlign: "left" as const,
								cursor: "pointer",
								minHeight: "182px",
								alignContent: "space-between",
								position: "relative" as const,
								overflow: "hidden",
							}}
						>
							<div
								aria-hidden="true"
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									height: "4px",
									background: isSelected ? "linear-gradient(90deg, rgba(24, 115, 152, 0.98), rgba(93, 199, 232, 0.92), rgba(139, 225, 208, 0.88))" : sessionCardTone.accent,
								}}
							/>
							<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
								<div style={{ display: "grid", gap: "6px", flex: "1 1 auto", minWidth: 0 }}>
									<div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
										<h4 style={{ margin: 0, fontSize: "1.3rem", lineHeight: 1.12, color: boatTheme.colors.navy, fontWeight: 800 }}>{venue.venueName}</h4>
										<span
											style={{
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												padding: "6px 10px",
												borderRadius: "999px",
												fontSize: "0.68rem",
												fontWeight: 800,
												letterSpacing: "0.1em",
												textTransform: "uppercase",
												...getSessionStyle(venue.session),
											}}
										>
											{getSessionLabel(venue.session)}
										</span>

										{dayBadge ? (
											<span style={venueDayBadgeStyle}>{dayBadge}</span>
										) : null}
									</div>
									<p style={{ margin: 0, color: boatTheme.colors.muted, lineHeight: 1.45, fontSize: "0.86rem" }}>{venue.title || "開催情報確認中"}</p>
								</div>
								<div style={{ display: "grid", gap: "6px", justifyItems: "end" }}>
									{gradeLabel ? (
										<span
											style={{
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												padding: "4px 9px",
												borderRadius: "999px",
												fontSize: "0.68rem",
												fontWeight: 800,
												letterSpacing: "0.08em",
												textTransform: "uppercase",
												background: "rgba(255, 255, 255, 0.92)",
												border: `1px solid ${boatTheme.colors.line}`,
												color: boatTheme.colors.navy,
											}}
										>
											{gradeLabel}
										</span>
									) : (
										<span />
									)}
									<span
										style={{
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											width: "34px",
											height: "34px",
											borderRadius: "999px",
											background: isSelected ? "rgba(18, 50, 74, 0.98)" : "rgba(255, 255, 255, 0.96)",
											color: isSelected ? "#ffffff" : boatTheme.colors.aquaDeep,
											fontWeight: 900,
											border: isSelected ? "1px solid rgba(18, 50, 74, 1)" : `1px solid ${boatTheme.colors.line}`,
											boxShadow: isSelected ? "0 8px 18px rgba(18, 50, 74, 0.18)" : "none",
										}}
									>
										{isSelected ? "✓" : "→"}
									</span>
								</div>
							</div>

							<div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
								{[
									{ label: "1R", value: getFirstRaceTime(venue) },
									{ label: "LAST", value: getLastRaceTime(venue) },
									{ label: "RACE", value: getRaceCountLabel(venue) },
								].map((item) => (
									<div
										key={item.label}
										style={{
											padding: "11px 12px 10px",
											borderRadius: "16px",
											background: isSelected ? "rgba(255, 255, 255, 0.98)" : sessionCardTone.subtleSurface,
											border: isSelected ? "1px solid rgba(93, 199, 232, 0.26)" : sessionCardTone.border,
											display: "grid",
											gap: "4px",
											boxShadow: isSelected ? "0 8px 18px rgba(17, 64, 92, 0.06)" : "none",
										}}
									>
											<p style={{ margin: 0, fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: boatTheme.colors.aquaDeep, fontWeight: 700 }}>
											{item.label}
										</p>
											<p style={{ margin: 0, color: boatTheme.colors.navy, fontWeight: 800, fontSize: "0.92rem" }}>{item.value}</p>
									</div>
								))}
							</div>
						</button>
					);
				})}
			</div>
		</section>
	);
}
