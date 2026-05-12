import type { ReactNode } from "react";
import { boatTheme } from "../../lib/theme";

type SectionCardProps = {
	title?: string;
	description?: string;
	children: ReactNode;
};

const sectionCardStyle = {
	width: "100%",
	minWidth: 0,
	boxSizing: "border-box" as const,
	padding: "26px",
	borderRadius: "28px",
	background: "rgba(255, 255, 255, 0.94)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
};

const titleStyle = {
	margin: 0,
	fontSize: "1.1rem",
	color: boatTheme.colors.navy,
};

const descriptionStyle = {
	margin: "10px 0 0",
	lineHeight: 1.8,
	color: boatTheme.colors.muted,
};

const bodyStyle = {
	marginTop: "18px",
};

export function SectionCard({ title, description, children }: SectionCardProps) {
	return (
		<section style={sectionCardStyle}>
			{title ? <h3 style={titleStyle}>{title}</h3> : null}
			{description ? <p style={descriptionStyle}>{description}</p> : null}
			<div style={bodyStyle}>{children}</div>
		</section>
	);
}