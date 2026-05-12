import { boatTheme } from "../../lib/theme";

type BoatPredictionSummaryStripProps = {
	venueCount: number;
	raceCount: number;
	racesWithRacers: number;
	racesWithExhibitions: number;
	racesWithOdds: number;
	confirmedRaceCount: number;
};

const wrapStyle = {
	padding: "26px",
	borderRadius: "34px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 249, 255, 0.95))",
	border: `1px solid rgba(171, 196, 214, 0.45)`,
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "18px",
};

const headerStyle = {
	display: "grid",
	gap: "10px",
};

const titleStyle = {
	margin: 0,
	fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
	lineHeight: 1.15,
	color: boatTheme.colors.navy,
};

const descriptionStyle = {
	margin: 0,
	maxWidth: "68ch",
	lineHeight: 1.8,
	color: boatTheme.colors.muted,
};

const gridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))",
	gap: "12px",
};

const itemStyle = {
	padding: "16px 18px",
	borderRadius: "22px",
	background: "rgba(255, 255, 255, 0.92)",
	border: `1px solid rgba(176, 198, 214, 0.42)`,
	display: "grid",
	gap: "6px",
};

const labelStyle = {
	margin: 0,
	fontSize: "0.82rem",
	fontWeight: 700,
	letterSpacing: "0.04em",
	color: boatTheme.colors.aquaDeep,
};

const valueStyle = {
	margin: 0,
	fontSize: "1.15rem",
	fontWeight: 700,
	color: boatTheme.colors.navy,
};

export function BoatPredictionSummaryStrip({
	venueCount,
	raceCount,
	racesWithRacers,
	racesWithExhibitions,
	racesWithOdds,
	confirmedRaceCount,
}: BoatPredictionSummaryStripProps) {
	const items = [
		{ label: "開催場数", value: `${venueCount}場` },
		{ label: "総レース数", value: `${raceCount}R` },
		{ label: "出走データあり", value: `${racesWithRacers}R` },
		{ label: "展示データあり", value: `${racesWithExhibitions}R` },
		{ label: "オッズあり", value: `${racesWithOdds}R` },
		{ label: "結果確定", value: `${confirmedRaceCount}R` },
	];

	return (
		<section style={wrapStyle}>
			<div style={headerStyle}>
				<h3 style={titleStyle}>今日の1R素材を整える</h3>
				<p style={descriptionStyle}>会場情報・展示・進入・展示ST・天候・モーター・オッズ・結果を整理して、GPTへ渡せる予想素材を整えます。</p>
			</div>
			<div style={gridStyle}>
				{items.map((item) => (
					<article key={item.label} style={itemStyle}>
						<p style={labelStyle}>{item.label}</p>
						<p style={valueStyle}>{item.value}</p>
					</article>
				))}
			</div>
		</section>
	);
}