import type { BoatFrameNumber, BoatRacerItem } from "../../lib/boatraceTypes";
import { BOAT_FRAME_COLORS } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatRacerTableProps = {
	racers: BoatRacerItem[];
};

const sectionStyle = {
	display: "grid",
	gap: "10px",
};

const titleStyle = {
	margin: 0,
	fontSize: "1.02rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const descriptionStyle = {
	margin: 0,
	fontSize: "0.84rem",
	lineHeight: 1.5,
	color: boatTheme.colors.muted,
};

const tableWrapStyle = {
	overflowX: "auto" as const,
	borderRadius: "22px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 251, 255, 0.94))",
	boxShadow: "0 10px 24px rgba(17, 64, 92, 0.05)",
};

const tableStyle = {
	width: "100%",
	minWidth: "760px",
	borderCollapse: "collapse" as const,
	color: boatTheme.colors.navy,
	fontSize: "0.92rem",
};

const headCellStyle = {
	padding: "13px 12px",
	background: "rgba(228, 244, 251, 0.96)",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	textAlign: "left" as const,
	whiteSpace: "nowrap" as const,
	color: boatTheme.colors.navy,
	fontSize: "0.82rem",
};

const bodyCellStyle = {
	padding: "14px 12px",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	whiteSpace: "nowrap" as const,
	color: boatTheme.colors.muted,
};

const getFrameTextColor = (frameNo: BoatFrameNumber) => {
	if (frameNo === 2) {
		return "#ffffff";
	}

	if (frameNo === 5) {
		return "#1b2430";
	}

	return frameNo === 1 ? "#1b2430" : "#ffffff";
};

const getFrameBadgeStyle = (frameNo: BoatFrameNumber) => ({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: "32px",
	height: "32px",
	borderRadius: "10px",
	background: BOAT_FRAME_COLORS[frameNo],
	color: getFrameTextColor(frameNo),
	fontWeight: 700,
	border: frameNo === 1 ? `1px solid ${boatTheme.colors.line}` : "none",
});

export function BoatRacerTable({ racers }: BoatRacerTableProps) {
	return (
		<section style={sectionStyle}>
			<div style={{ display: "grid", gap: "4px" }}>
				<h4 style={titleStyle}>出走表</h4>
				<p style={descriptionStyle}>枠順と戦績指標を、詰め込みすぎない表面で整理しています。</p>
			</div>
			<div style={tableWrapStyle}>
				<table style={tableStyle}>
					<thead>
						<tr>
							<th style={headCellStyle}>枠</th>
							<th style={headCellStyle}>選手名</th>
							<th style={headCellStyle}>支部</th>
							<th style={headCellStyle}>級別</th>
							<th style={headCellStyle}>ST</th>
							<th style={headCellStyle}>勝率</th>
							<th style={headCellStyle}>2連率</th>
							<th style={headCellStyle}>モーター</th>
							<th style={headCellStyle}>モーター2連率</th>
							<th style={headCellStyle}>ボート</th>
							<th style={headCellStyle}>ボート2連率</th>
						</tr>
					</thead>
					<tbody>
						{racers.map((racer, index) => (
							<tr key={`${racer.frameNo}-${racer.boatNo}-${racer.name}`} style={{ background: index % 2 === 0 ? "rgba(255, 255, 255, 0.86)" : "rgba(247, 252, 255, 0.74)" }}>
								<td style={bodyCellStyle}>
									<span style={getFrameBadgeStyle(racer.frameNo)}>{racer.frameNo}</span>
								</td>
								<td style={{ ...bodyCellStyle, color: boatTheme.colors.navy, fontWeight: 700 }}>{racer.name}</td>
								<td style={bodyCellStyle}>{racer.branch ?? "-"}</td>
								<td style={bodyCellStyle}>{racer.class ?? "-"}</td>
								<td style={bodyCellStyle}>{racer.averageStart ?? "-"}</td>
								<td style={bodyCellStyle}>{racer.winRate ?? "-"}</td>
								<td style={bodyCellStyle}>{racer.secondRate ?? "-"}</td>
								<td style={bodyCellStyle}>{racer.motorNo ?? "-"}</td>
								<td style={bodyCellStyle}>{racer.motorSecondRate ?? "-"}</td>
								<td style={bodyCellStyle}>{racer.boatMotorNo ?? "-"}</td>
								<td style={bodyCellStyle}>{racer.boatSecondRate ?? "-"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}