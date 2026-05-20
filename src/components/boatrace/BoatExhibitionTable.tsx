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

const hasDisplayValue = (value?: string | null) => Boolean(value && value.trim().length > 0);

export function BoatExhibitionTable({ exhibitions }: BoatExhibitionTableProps) {
	const hasPlayerName = exhibitions.some((item) => hasDisplayValue(item.playerName));
	const hasExhibitionTime = exhibitions.some((item) => hasDisplayValue(item.exhibitionTime));
	const hasWeight = exhibitions.some((item) => hasDisplayValue(item.weight));
	const hasWeightAdjustment = exhibitions.some((item) => hasDisplayValue(item.weightAdjustment));
	const hasTilt = exhibitions.some((item) => hasDisplayValue(item.tilt));
	const hasPartsExchange = exhibitions.some((item) => hasDisplayValue(item.partsExchange));
	const hasOneLapTime = exhibitions.some((item) => hasDisplayValue(item.oneLapTime));
	const hasTurnTime = exhibitions.some((item) => hasDisplayValue(item.turnTime));
	const hasStraightTime = exhibitions.some((item) => hasDisplayValue(item.straightTime));
	const hasStartTiming = exhibitions.some((item) => hasDisplayValue(item.startTiming));
	const hasCourse = exhibitions.some((item) => hasDisplayValue(item.course));
	const hasMemo = exhibitions.some((item) => hasDisplayValue(item.memo));
	const hasEvaluation = exhibitions.some((item) => item.evaluation && item.evaluation !== "unknown");

	return (
		<section style={sectionStyle}>
			<div style={{ display: "grid", gap: "4px" }}>
				<h4 style={titleStyle}>展示</h4>
				<p style={descriptionStyle}>
					展示タイム、チルト、体重、会場独自展示データを取得できている列だけで表示します。
				</p>
			</div>
			<div style={tableWrapStyle}>
				<table style={tableStyle}>
					<thead>
						<tr>
							<th style={headCellStyle}>艇番</th>
							{hasPlayerName ? <th style={headCellStyle}>選手名</th> : null}
							{hasExhibitionTime ? <th style={headCellStyle}>展示タイム</th> : null}
							{hasWeight ? <th style={headCellStyle}>体重</th> : null}
							{hasWeightAdjustment ? <th style={headCellStyle}>調整</th> : null}
							{hasTilt ? <th style={headCellStyle}>チルト</th> : null}
							{hasPartsExchange ? <th style={headCellStyle}>部品交換</th> : null}
							{hasOneLapTime ? <th style={headCellStyle}>一周</th> : null}
							{hasTurnTime ? <th style={headCellStyle}>まわり足</th> : null}
							{hasStraightTime ? <th style={headCellStyle}>直線</th> : null}
							{hasStartTiming ? <th style={headCellStyle}>ST展示</th> : null}
							{hasCourse ? <th style={headCellStyle}>進入</th> : null}
							{hasEvaluation ? <th style={headCellStyle}>評価</th> : null}
							{hasMemo ? <th style={headCellStyle}>メモ</th> : null}
						</tr>
					</thead>
					<tbody>
						{exhibitions.map((item, index) => (
							<tr
								key={`${item.frameNo}-${item.course}-${item.exhibitionTime}`}
								style={{ background: index % 2 === 0 ? "rgba(255, 255, 255, 0.86)" : "rgba(247, 252, 255, 0.74)" }}
							>
								<td style={bodyCellStyle}>
									<span style={getFrameBadgeStyle(item.frameNo)}>{item.frameNo}</span>
								</td>
								{hasPlayerName ? <td style={bodyCellStyle}>{item.playerName || "-"}</td> : null}
								{hasExhibitionTime ? <td style={bodyCellStyle}>{item.exhibitionTime || "-"}</td> : null}
								{hasWeight ? <td style={bodyCellStyle}>{item.weight || "-"}</td> : null}
								{hasWeightAdjustment ? <td style={bodyCellStyle}>{item.weightAdjustment || "-"}</td> : null}
								{hasTilt ? <td style={bodyCellStyle}>{item.tilt || "-"}</td> : null}
								{hasPartsExchange ? <td style={bodyCellStyle}>{item.partsExchange || "-"}</td> : null}
								{hasOneLapTime ? <td style={bodyCellStyle}>{item.oneLapTime || "-"}</td> : null}
								{hasTurnTime ? <td style={bodyCellStyle}>{item.turnTime || "-"}</td> : null}
								{hasStraightTime ? <td style={bodyCellStyle}>{item.straightTime || "-"}</td> : null}
								{hasStartTiming ? <td style={bodyCellStyle}>{item.startTiming || "-"}</td> : null}
								{hasCourse ? <td style={bodyCellStyle}>{item.course || "-"}</td> : null}
								{hasEvaluation ? (
									<td style={{ ...bodyCellStyle, color: boatTheme.colors.navy, fontWeight: 700 }}>
										{evaluationMap[item.evaluation ?? "unknown"]}
									</td>
								) : null}
								{hasMemo ? <td style={bodyCellStyle}>{item.memo || "-"}</td> : null}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
