import type { BoatTodayVenueItem } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatVenueSpotlightProps = {
	venue: BoatTodayVenueItem | undefined;
	summaryText: string;
	imageSrc?: string;
	imageAlt?: string;
};

function getDisplayTime(value?: string): string {
	return value && value.trim().length > 0 ? value : "--:--";
}

function getFirstTimedRace(venue: BoatTodayVenueItem) {
	return venue.races.find((race) => Boolean(race.deadlineTime?.trim() || race.startTime?.trim()));
}

function getLastTimedRace(venue: BoatTodayVenueItem) {
	return [...venue.races].reverse().find((race) => Boolean(race.deadlineTime?.trim() || race.startTime?.trim()));
}

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

	return "Schedule";
}

function getGradeLabel(title?: string): string | null {
	if (!title) {
		return null;
	}

	const match = title.match(/SG|GI|GII|GIII|G1|G2|G3/i);
	return match ? match[0].toUpperCase() : null;
}

const spotlightTextColumnStyle = {
	display: "grid",
	gridTemplateRows: "auto auto auto auto",
	gap: "12px",
	alignContent: "start",
} satisfies React.CSSProperties;

const spotlightEyebrowStyle = {
	display: "inline-flex",
	alignItems: "center",
	width: "fit-content",
	padding: "6px 12px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.86)",
	border: "1px solid rgba(93, 199, 232, 0.16)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.72rem",
	fontWeight: 800,
	letterSpacing: "0.14em",
	textTransform: "uppercase",
} satisfies React.CSSProperties;

const spotlightHeadlineBlockStyle = {
	display: "grid",
	gap: "7px",
	alignContent: "start",
} satisfies React.CSSProperties;

const spotlightVenueNameStyle = {
	margin: 0,
	fontSize: "1.9rem",
	lineHeight: 1.02,
	fontWeight: 800,
	letterSpacing: "-0.01em",
	color: boatTheme.colors.navy,
} satisfies React.CSSProperties;

const spotlightEventTitleStyle = {
	margin: 0,
	color: "rgba(18, 50, 74, 0.82)",
	fontWeight: 700,
	fontSize: "0.96rem",
	lineHeight: 1.42,
} satisfies React.CSSProperties;

const spotlightSummaryStyle = {
	margin: 0,
	maxWidth: "52ch",
	color: boatTheme.colors.muted,
	fontSize: "0.9rem",
	lineHeight: 1.62,
} satisfies React.CSSProperties;

const spotlightMetaRowStyle = {
	display: "flex",
	gap: "8px",
	flexWrap: "wrap",
	alignItems: "center",
} satisfies React.CSSProperties;

const spotlightSessionChipStyle = {
	display: "inline-flex",
	alignItems: "center",
	padding: "6px 10px",
	borderRadius: "999px",
	background: "rgba(223, 245, 255, 0.92)",
	border: "1px solid rgba(93, 199, 232, 0.18)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.72rem",
	fontWeight: 700,
} satisfies React.CSSProperties;

const spotlightGradeChipStyle = {
	display: "inline-flex",
	alignItems: "center",
	padding: "6px 10px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.navy,
	fontSize: "0.72rem",
	fontWeight: 700,
} satisfies React.CSSProperties;

const spotlightStatsGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: "10px",
	alignItems: "stretch",
} satisfies React.CSSProperties;

const spotlightStatCardStyle = {
	minHeight: "74px",
	padding: "12px 14px",
	borderRadius: "16px",
	background: "rgba(255, 255, 255, 0.76)",
	border: "1px solid rgba(93, 199, 232, 0.14)",
	display: "grid",
	gap: "5px",
	alignContent: "center",
} satisfies React.CSSProperties;

const spotlightStatLabelStyle = {
	margin: 0,
	fontSize: "0.68rem",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 700,
	letterSpacing: "0.08em",
	textTransform: "uppercase",
} satisfies React.CSSProperties;

const spotlightStatValueStyle = {
	margin: 0,
	fontSize: "0.94rem",
	color: boatTheme.colors.navy,
	fontWeight: 800,
	lineHeight: 1.2,
} satisfies React.CSSProperties;

export function BoatVenueSpotlight({ venue, summaryText, imageSrc, imageAlt }: BoatVenueSpotlightProps) {
	if (!venue) {
		return null;
	}

	const gradeLabel = getGradeLabel(venue.title);
	const firstRace = getFirstTimedRace(venue);
	const lastRace = getLastTimedRace(venue);

	return (
		<section
			style={{
				display: "grid",
				gridTemplateColumns: "minmax(0, 1.28fr) minmax(260px, 0.9fr)",
				gap: "18px",
				padding: "22px",
				borderRadius: "28px",
				border: "1px solid rgba(93, 199, 232, 0.18)",
				background: "linear-gradient(135deg, rgba(255, 255, 255, 0.99) 0%, rgba(239, 250, 255, 0.98) 56%, rgba(232, 247, 245, 0.95) 100%)",
				boxShadow: "0 18px 38px rgba(17, 64, 92, 0.1)",
				alignItems: "center",
			}}
		>
			<div style={spotlightTextColumnStyle}>
				<span style={spotlightEyebrowStyle}>
					Venue Spotlight
				</span>
				<div style={spotlightHeadlineBlockStyle}>
					<h3 style={spotlightVenueNameStyle}>{venue.venueName}</h3>
					<p style={spotlightEventTitleStyle}>{venue.title || `${venue.venueName} の開催情報`}</p>
					<p style={spotlightSummaryStyle}>{summaryText}</p>
				</div>
				<div style={spotlightMetaRowStyle}>
					<span style={spotlightSessionChipStyle}>
						{getSessionLabel(venue.session)}
					</span>
					{gradeLabel ? (
						<span style={spotlightGradeChipStyle}>
							{gradeLabel}
						</span>
					) : null}
				</div>
				<div style={spotlightStatsGridStyle}>
					{[
						{ label: "1R", value: getDisplayTime(firstRace?.deadlineTime ?? firstRace?.startTime) },
						{ label: "LAST", value: getDisplayTime(lastRace?.deadlineTime ?? lastRace?.startTime) },
						{ label: "RACE", value: venue.races.length > 0 ? `${venue.races.length}R` : "12R予定" },
					].map((item) => (
						<div key={item.label} style={spotlightStatCardStyle}>
							<p style={spotlightStatLabelStyle}>
								{item.label}
							</p>
							<p style={spotlightStatValueStyle}>{item.value}</p>
						</div>
					))}
				</div>
			</div>

			<div
				style={{
					minHeight: "206px",
					borderRadius: "24px",
					border: "1px solid rgba(93, 199, 232, 0.16)",
					background: "radial-gradient(circle at 22% 20%, rgba(93, 199, 232, 0.24), transparent 32%), radial-gradient(circle at 76% 76%, rgba(139, 225, 208, 0.24), transparent 34%), linear-gradient(180deg, rgba(243, 252, 255, 0.98), rgba(232, 246, 250, 0.94))",
					display: "grid",
					placeItems: "center",
					overflow: "hidden",
					position: "relative" as const,
				}}
			>
				{imageSrc ? (
					<img
						src={imageSrc}
						alt={imageAlt ?? `${venue.venueName} の会場ビジュアル`}
						style={{ width: "100%", height: "100%", objectFit: "cover" }}
					/>
				) : (
					<div style={{ display: "grid", gap: "8px", textAlign: "center", padding: "24px", position: "relative" as const, zIndex: 1 }}>
						<p style={{ margin: 0, color: boatTheme.colors.aquaDeep, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
							Venue Overview
						</p>
						<p style={{ margin: 0, color: boatTheme.colors.navy, fontSize: "1.06rem", fontWeight: 700 }}>{venue.title || `${venue.venueName} の開催情報`}</p>
						<p style={{ margin: 0, color: boatTheme.colors.muted, fontSize: "0.85rem", lineHeight: 1.55 }}>
							次のレース選択前に、会場の開催状況と時間帯をまとめて確認できます。
						</p>
						<p style={{ margin: 0, color: "rgba(18, 50, 74, 0.34)", fontSize: "1.8rem", fontWeight: 800, letterSpacing: "0.06em" }}>
							{venue.venueName}
						</p>
					</div>
				)}
				{!imageSrc ? (
					<div
						aria-hidden="true"
						style={{
							position: "absolute",
							inset: "auto -8% 10% auto",
							fontSize: "3rem",
							fontWeight: 800,
							letterSpacing: "0.08em",
							color: "rgba(24, 115, 152, 0.08)",
							transform: "rotate(-8deg)",
						}}
					>
						BOAT RACE
					</div>
				) : null}
			</div>
		</section>
	);
}