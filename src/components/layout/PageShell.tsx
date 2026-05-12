import type { ReactNode } from "react";
import { boatTheme } from "../../lib/theme";

type PageShellProps = {
	eyebrow: string;
	title: string;
	description: string;
	children: ReactNode;
	contentMaxWidth?: string;
	contentPaddingInline?: string;
	heroMaxWidth?: string;
	hideHero?: boolean;
};

const eyebrowStyle = {
	margin: 0,
	color: boatTheme.colors.aquaDeep,
	fontWeight: 700,
	fontSize: "0.8rem",
	letterSpacing: "0.14em",
	textTransform: "uppercase" as const,
};

const titleStyle = {
	margin: "10px 0 0",
	fontSize: "clamp(2rem, 4vw, 3rem)",
	color: boatTheme.colors.navy,
	lineHeight: 1.15,
};

const descriptionStyle = {
	margin: "14px 0 0",
	lineHeight: 1.9,
	color: boatTheme.colors.muted,
	maxWidth: "60ch",
};

function buildShellStyle(contentMaxWidth: string, contentPaddingInline: string) {
	return {
		width: `min(${contentMaxWidth}, calc(100vw - ${contentPaddingInline} - ${contentPaddingInline}))`,
		marginInline: "auto",
		position: "relative" as const,
		left: "50%",
		transform: "translateX(-50%)",
		display: "grid",
		gap: "22px",
		minWidth: 0,
		padding: "4px 0 0",
		background:
			"linear-gradient(180deg, rgba(223, 245, 255, 0.28) 0%, rgba(139, 225, 208, 0.12) 100%)",
		borderRadius: "34px",
		boxSizing: "border-box" as const,
	};
}

function buildHeroStyle(heroMaxWidth: string) {
	return {
		width: "100%",
		maxWidth: heroMaxWidth,
		marginInline: "auto",
		minWidth: 0,
		boxSizing: "border-box" as const,
		padding: "30px",
		borderRadius: "30px",
		border: `1px solid ${boatTheme.colors.line}`,
		background: boatTheme.background.hero,
		boxShadow: boatTheme.shadow.soft,
	};
}

export function PageShell({
	eyebrow,
	title,
	description,
	children,
	contentMaxWidth = "1180px",
	contentPaddingInline = "16px",
	heroMaxWidth,
	hideHero = false,
}: PageShellProps) {
	const resolvedHeroMaxWidth = heroMaxWidth ?? contentMaxWidth;

	return (
		<section style={buildShellStyle(contentMaxWidth, contentPaddingInline)}>
			{!hideHero ? (
				<header style={buildHeroStyle(resolvedHeroMaxWidth)}>
					<p style={eyebrowStyle}>{eyebrow}</p>
					<h2 style={titleStyle}>{title}</h2>
					<p style={descriptionStyle}>{description}</p>
				</header>
			) : null}
			{children}
		</section>
	);
}