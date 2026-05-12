import { boatTheme } from "../../lib/theme";

type SiteHeaderProps = {
	currentHash: string;
};

const headerStyle = {
	position: "sticky" as const,
	top: 0,
	zIndex: 10,
	backdropFilter: "blur(18px)",
	background: "rgba(245, 251, 255, 0.82)",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
};

const innerStyle = {
	width: "min(1180px, calc(100% - 32px))",
	margin: "0 auto",
	padding: "18px 0 14px",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "20px",
	flexWrap: "wrap" as const,
};

const brandBlockStyle = {
	display: "grid",
	gap: "6px",
};

const kickerStyle = {
	fontSize: "0.72rem",
	letterSpacing: "0.24em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
	fontWeight: 700,
};

const titleStyle = {
	margin: 0,
	fontSize: "clamp(1.5rem, 2vw, 2.2rem)",
	lineHeight: 1.1,
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const sublineStyle = {
	margin: 0,
	fontSize: "0.95rem",
	color: boatTheme.colors.muted,
};

const navStyle = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap" as const,
};

const navItems = [
	{ label: "Dashboard", hash: "#dashboard-page" },
	{ label: "Today", hash: "#races-page" },
	{ label: "Prediction", hash: "#prediction-page" },
	{ label: "Review", hash: "#review-page" },
	{ label: "Venues", hash: "#venue-features-page" },
	{ label: "Mobile", hash: "#mobile-page" },
];

export function SiteHeader({ currentHash }: SiteHeaderProps) {
	return (
		<header style={headerStyle}>
			<div style={innerStyle}>
				<div style={brandBlockStyle}>
					<span style={kickerStyle}>RACE DATA &amp; ANALYSIS</span>
					<h1 style={titleStyle}>KURARI DATA LAVO</h1>
					<p style={sublineStyle}>BOAT RACE EDITION｜展示・進入・モーター・水面を読む</p>
				</div>

				<nav aria-label="Primary" style={navStyle}>
					{navItems.map((item) => {
						const isActive = currentHash === item.hash;

						return (
							<a
								key={item.hash}
								href={item.hash}
								style={{
									padding: "9px 12px",
									borderRadius: "999px",
									border: `1px solid ${isActive ? boatTheme.colors.navy : boatTheme.colors.line}`,
									background: isActive ? boatTheme.colors.navy : "rgba(255, 255, 255, 0.72)",
									color: isActive ? boatTheme.colors.foam : boatTheme.colors.muted,
									fontSize: "0.86rem",
									fontWeight: isActive ? 700 : 600,
									textDecoration: "none",
									boxShadow: isActive ? boatTheme.shadow.soft : "none",
								}}
							>
								{item.label}
							</a>
						);
					})}
				</nav>
			</div>
		</header>
	);
}
