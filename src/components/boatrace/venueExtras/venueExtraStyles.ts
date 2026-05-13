import { boatTheme } from "../../../lib/theme";

export const venueExtrasTableWrapStyle = {
	overflowX: "auto" as const,
	borderRadius: "20px",
	border: "1px solid rgba(93, 199, 232, 0.22)",
	background: "rgba(255, 255, 255, 0.98)",
	boxShadow: "0 10px 26px rgba(17, 64, 92, 0.045), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
};

export const venueExtrasTableStyle = {
	width: "100%",
	minWidth: "520px",
	borderCollapse: "collapse" as const,
	color: boatTheme.colors.navy,
	fontSize: "0.84rem",
};

export const venueExtrasHeadCellStyle = {
	padding: "11px 12px",
	background: "linear-gradient(180deg, rgba(225, 243, 250, 0.98), rgba(214, 236, 246, 0.92))",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	textAlign: "left" as const,
	whiteSpace: "nowrap" as const,
	color: boatTheme.colors.navy,
	fontSize: "0.76rem",
	fontWeight: 900,
};

export const venueExtrasBodyCellStyle = {
	padding: "11px 12px",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	whiteSpace: "nowrap" as const,
	color: boatTheme.colors.navy,
	fontSize: "0.82rem",
	fontWeight: 800,
};
