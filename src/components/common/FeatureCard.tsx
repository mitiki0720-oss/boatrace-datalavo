import { boatTheme } from "../../lib/theme";

type FeatureCardProps = {
	icon: string;
	title: string;
	description: string;
};

const cardStyle = {
	padding: "24px",
	borderRadius: "24px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(235, 248, 252, 0.92))",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "12px",
	minHeight: "100%",
};

const iconStyle = {
	fontSize: "1.65rem",
	lineHeight: 1,
};

const titleStyle = {
	margin: 0,
	fontSize: "1.08rem",
	color: boatTheme.colors.navy,
};

const descriptionStyle = {
	margin: 0,
	lineHeight: 1.8,
	color: boatTheme.colors.muted,
};

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
	return (
		<article style={cardStyle}>
			<div aria-hidden="true" style={iconStyle}>
				{icon}
			</div>
			<h3 style={titleStyle}>{title}</h3>
			<p style={descriptionStyle}>{description}</p>
		</article>
	);
}