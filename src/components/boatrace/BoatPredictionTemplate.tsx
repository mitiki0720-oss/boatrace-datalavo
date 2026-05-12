import { boatTheme } from "../../lib/theme";

type BoatPredictionTemplateProps = {
	venueName: string;
	raceNo: number;
	raceTitle?: string;
};

const sections = [
	{
		title: "3連単（厚め2点）",
		group: "厚め",
		items: [
			{ index: "01", combination: "1-2-3" },
			{ index: "02", combination: "1-3-2" },
		],
	},
	{
		title: "3連単（本線6点）",
		group: "本線",
		items: [
			{ index: "03", combination: "1-2-4" },
			{ index: "04", combination: "1-4-2" },
			{ index: "05", combination: "1-3-4" },
			{ index: "06", combination: "1-4-3" },
			{ index: "07", combination: "2-1-3" },
			{ index: "08", combination: "2-1-4" },
		],
	},
	{
		title: "2連単（穴狙い2点）",
		group: "穴狙い",
		items: [
			{ index: "09", combination: "3-1" },
			{ index: "10", combination: "4-1" },
		],
	},
] as const;

const wrapStyle = {
	display: "grid",
	gap: "14px",
};

const headerStyle = {
	display: "grid",
	gap: "4px",
};

const eyebrowStyle = {
	margin: 0,
	fontSize: "0.82rem",
	fontWeight: 700,
	letterSpacing: "0.06em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
};

const titleStyle = {
	margin: 0,
	fontSize: "1rem",
	color: boatTheme.colors.navy,
};

const gridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: "14px",
};

const cardStyle = {
	padding: "18px",
	borderRadius: "20px",
	background: "linear-gradient(180deg, rgba(247, 252, 255, 0.98), rgba(229, 247, 244, 0.92))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "10px",
};

const sectionTitleStyle = {
	margin: 0,
	fontSize: "0.98rem",
	fontWeight: 700,
	color: boatTheme.colors.navy,
};

const badgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "5px 10px",
	borderRadius: "999px",
	background: "rgba(221, 242, 248, 0.95)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.8rem",
	fontWeight: 700,
	width: "fit-content",
};

const itemListStyle = {
	display: "grid",
	gap: "8px",
};

const itemStyle = {
	display: "flex",
	justifyContent: "space-between",
	gap: "12px",
	color: boatTheme.colors.muted,
	fontSize: "0.94rem",
};

const indexStyle = {
	fontWeight: 700,
	color: boatTheme.colors.navy,
};

export function BoatPredictionTemplate({ venueName, raceNo, raceTitle }: BoatPredictionTemplateProps) {
	return (
		<section style={wrapStyle}>
			<div style={headerStyle}>
				<p style={eyebrowStyle}>買い目（10点）</p>
				<h4 style={titleStyle}>{venueName} {raceNo}R {raceTitle ?? "予想テンプレ"}</h4>
			</div>

			<div style={gridStyle}>
				{sections.map((section) => (
					<article key={section.title} style={cardStyle}>
						<span style={badgeStyle}>{section.group}</span>
						<h5 style={sectionTitleStyle}>{section.title}</h5>
						<div style={itemListStyle}>
							{section.items.map((item) => (
								<div key={item.index} style={itemStyle}>
									<span style={indexStyle}>{item.index}</span>
									<span>{item.combination}</span>
								</div>
							))}
						</div>
					</article>
				))}
			</div>
		</section>
	);
}