import type { BoatExhibitionEvaluation, BoatExhibitionItem, BoatFrameNumber } from "../../lib/boatraceTypes";
import { BOAT_FRAME_COLORS } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatExhibitionTableProps = {
	exhibitions: BoatExhibitionItem[];
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
	minWidth: "680px",
	borderCollapse: "collapse" as const,
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

const evaluationMap: Record<BoatExhibitionEvaluation, string> = {
	good: "良",
	normal: "普通",
	bad: "注意",
	unknown: "未評価",
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

export function BoatExhibitionTable({ exhibitions }: BoatExhibitionTableProps) {
	return (
		<section style={sectionStyle}>
			<div style={{ display: "grid", gap: "4px" }}>
				<h4 style={titleStyle}>展示</h4>
				<p style={descriptionStyle}>展示タイムと進入、評価メモを軽い見た目のまま比較できます。</p>
			</div>
			<div style={tableWrapStyle}>
				<table style={tableStyle}>
					<thead>
						<tr>
							<th style={headCellStyle}>枠</th>
							<th style={headCellStyle}>展示タイム</th>
							<th style={headCellStyle}>チルト</th>
							<th style={headCellStyle}>ST展示</th>
							<th style={headCellStyle}>進入</th>
							<th style={headCellStyle}>評価</th>
							<th style={headCellStyle}>メモ</th>
						</tr>
					</thead>
					<tbody>
						{exhibitions.map((item, index) => (
							<tr key={`${item.frameNo}-${item.course}-${item.exhibitionTime}` } style={{ background: index % 2 === 0 ? "rgba(255, 255, 255, 0.86)" : "rgba(247, 252, 255, 0.74)" }}>
								<td style={bodyCellStyle}>
									<span style={getFrameBadgeStyle(item.frameNo)}>{item.frameNo}</span>
								</td>
								<td style={bodyCellStyle}>{item.exhibitionTime ?? "-"}</td>
								<td style={bodyCellStyle}>{item.tilt ?? "-"}</td>
								<td style={bodyCellStyle}>{item.startTiming ?? "-"}</td>
								<td style={bodyCellStyle}>{item.course ?? "-"}</td>
								<td style={{ ...bodyCellStyle, color: boatTheme.colors.navy, fontWeight: 700 }}>
									{evaluationMap[item.evaluation ?? "unknown"]}
								</td>
								<td style={bodyCellStyle}>{item.memo ?? "-"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}