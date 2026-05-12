import type { CSSProperties } from "react";
import type { BoatPredictionRecord } from "../../lib/boatraceTypes";
import type { BoatHitJudgeResult } from "../../lib/boatHitJudge";
import { countBoatPredictionTicketsByType } from "../../lib/boatPredictionParser";
import type { BoatPracticeResultRecord } from "../../lib/boatPracticeResultStorage";
import { boatTheme } from "../../lib/theme";

type BoatReviewRaceCardProps = {
	raceKey: string;
	prediction?: BoatPredictionRecord;
	practiceResult?: BoatPracticeResultRecord;
	hitResult: BoatHitJudgeResult;
};

const baseCardStyle = {
	padding: "24px",
	borderRadius: "30px",
	background: "rgba(255, 255, 255, 0.97)",
	border: "1px solid rgba(204, 218, 228, 0.75)",
	boxShadow: "0 24px 52px rgba(62, 90, 122, 0.12)",
	display: "grid",
	gap: "18px",
};

const headerStyle = {
	display: "flex",
	justifyContent: "space-between",
	gap: "16px",
	flexWrap: "wrap" as const,
	alignItems: "flex-start",
};

const titleBlockStyle = {
	display: "grid",
	gap: "6px",
};

const titleStyle = {
	margin: 0,
	fontSize: "1.2rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const metaStyle = {
	margin: 0,
	fontSize: "0.9rem",
	color: boatTheme.colors.muted,
	lineHeight: 1.7,
};

const chipRowStyle = {
	display: "flex",
	gap: "8px",
	flexWrap: "wrap" as const,
	justifyContent: "flex-end",
};

const chipStyle: CSSProperties = {
	padding: "8px 12px",
	borderRadius: "999px",
	fontSize: "0.78rem",
	fontWeight: 700,
	lineHeight: 1,
	border: "1px solid rgba(190, 204, 219, 0.55)",
	background: "rgba(245, 250, 255, 0.94)",
	color: boatTheme.colors.navy,
};

const hitChipStyleMap: Record<BoatHitJudgeResult["status"], typeof chipStyle> = {
	hit: {
		...chipStyle,
		background: "rgba(226, 250, 242, 0.98)",
		border: "1px solid rgba(120, 208, 182, 0.72)",
		color: "#166b59",
	},
	miss: {
		...chipStyle,
		background: "rgba(255, 239, 239, 0.98)",
		border: "1px solid rgba(228, 170, 170, 0.74)",
		color: "#8e4343",
	},
	pending: {
		...chipStyle,
		background: "rgba(241, 245, 248, 0.98)",
		border: "1px solid rgba(183, 194, 205, 0.74)",
		color: "#5c6f7d",
	},
};

const sectionWrapStyle = {
	display: "grid",
	gap: "12px",
};

const judgePanelStyle = {
	padding: "16px 18px",
	borderRadius: "22px",
	background: "rgba(248, 252, 255, 0.9)",
	border: "1px solid rgba(211, 223, 234, 0.82)",
	display: "grid",
	gap: "12px",
};

const sectionCardStyle = {
	padding: "18px",
	borderRadius: "22px",
	background: "rgba(246, 250, 253, 0.9)",
	border: "1px solid rgba(212, 223, 233, 0.8)",
	display: "grid",
	gap: "12px",
};

const sectionHeaderStyle = {
	display: "flex",
	justifyContent: "space-between",
	gap: "10px",
	flexWrap: "wrap" as const,
	alignItems: "center",
};

const sectionTitleStyle = {
	margin: 0,
	fontSize: "1rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const sectionMetaStyle = {
	margin: 0,
	fontSize: "0.82rem",
	color: boatTheme.colors.muted,
};

const statGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: "10px",
};

const statCardStyle = {
	padding: "12px 14px",
	borderRadius: "18px",
	background: "rgba(255, 255, 255, 0.92)",
	border: "1px solid rgba(214, 225, 234, 0.85)",
	display: "grid",
	gap: "4px",
};

const statLabelStyle = {
	margin: 0,
	fontSize: "0.75rem",
	fontWeight: 700,
	letterSpacing: "0.03em",
	color: "#688090",
};

const statValueStyle = {
	margin: 0,
	fontSize: "1rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const judgeValueStyle = {
	...statValueStyle,
	fontSize: "0.95rem",
	wordBreak: "break-word" as const,
};

const previewStyle = {
	margin: 0,
	padding: "14px 16px",
	borderRadius: "18px",
	background: "rgba(255, 255, 255, 0.88)",
	border: "1px solid rgba(214, 225, 234, 0.8)",
	fontSize: "0.9rem",
	lineHeight: 1.8,
	color: "#335066",
	whiteSpace: "pre-wrap" as const,
	wordBreak: "break-word" as const,
};

const formatAmount = (value: number) => `${value.toLocaleString("ja-JP")}円`;
const formatProfitLoss = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("ja-JP")}円`;
const formatRoi = (value: number) => `${value.toFixed(1)}%`;
const truncate = (value: string | undefined, maxLength: number) => {
	if (!value) {
		return "-";
	}

	return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
};

const getLatestSavedAt = (prediction?: BoatPredictionRecord, practiceResult?: BoatPracticeResultRecord) => {
	const dates = [prediction?.savedAt, practiceResult?.savedAt].filter(Boolean);
	if (!dates.length) {
		return "未保存";
	}

	const sortedDates = dates.sort();
	return sortedDates[sortedDates.length - 1] ?? "未保存";
};

const hitStatusLabelMap: Record<BoatHitJudgeResult["status"], string> = {
	hit: "🎯 的中",
	miss: "不的中",
	pending: "未判定",
};

export function BoatReviewRaceCard({ raceKey, prediction, practiceResult, hitResult }: BoatReviewRaceCardProps) {
	const ticketCounts = countBoatPredictionTicketsByType(prediction?.tickets ?? []);
	const raceTitle = practiceResult?.raceTitle || "レース名未保存";
	const venueName = prediction?.venueName ?? practiceResult?.venueName ?? "会場未保存";
	const date = prediction?.date ?? practiceResult?.date ?? "-";
	const raceNo = prediction?.raceNo ?? practiceResult?.raceNo ?? 0;
	const profitLoss = practiceResult?.profitLoss ?? 0;
	const profitTone = profitLoss > 0
		? { background: "rgba(226, 250, 242, 0.94)", border: "1px solid rgba(133, 205, 179, 0.65)" }
		: profitLoss < 0
			? { background: "rgba(255, 241, 241, 0.94)", border: "1px solid rgba(231, 176, 176, 0.7)" }
			: { background: "rgba(246, 250, 253, 0.9)", border: "1px solid rgba(212, 223, 233, 0.8)" };

	return (
		<article style={{ ...baseCardStyle, ...profitTone }}>
			<header style={headerStyle}>
				<div style={titleBlockStyle}>
					<h3 style={titleStyle}>{venueName} {raceNo > 0 ? `${raceNo}R` : ""}</h3>
					<p style={metaStyle}>{date}</p>
					<p style={metaStyle}>{raceTitle}</p>
					<p style={metaStyle}>保存キー: {raceKey}</p>
				</div>
				<div style={chipRowStyle}>
					<span style={hitChipStyleMap[hitResult.status]}>{hitStatusLabelMap[hitResult.status]}</span>
					<span style={chipStyle}>{prediction ? "GPT予想保存済み" : "GPT予想なし"}</span>
					<span style={chipStyle}>{practiceResult ? "実践結果保存済み" : "実践結果なし"}</span>
					<span style={chipStyle}>最新保存: {getLatestSavedAt(prediction, practiceResult)}</span>
				</div>
			</header>

			<div style={sectionWrapStyle}>
				<section style={judgePanelStyle}>
					<div style={sectionHeaderStyle}>
						<h4 style={sectionTitleStyle}>判定</h4>
						<p style={sectionMetaStyle}>{hitStatusLabelMap[hitResult.status]}</p>
					</div>
					<div style={statGridStyle}>
						<div style={statCardStyle}>
							<p style={statLabelStyle}>判定状態</p>
							<p style={judgeValueStyle}>{hitStatusLabelMap[hitResult.status]}</p>
						</div>
						{practiceResult?.actualFinishOrderText ? (
							<div style={statCardStyle}>
								<p style={statLabelStyle}>判定対象</p>
								<p style={judgeValueStyle}>{practiceResult.actualFinishOrderText}</p>
							</div>
						) : null}
						{hitResult.status === "hit" && hitResult.hitBetType ? (
							<div style={statCardStyle}>
								<p style={statLabelStyle}>的中種別</p>
								<p style={judgeValueStyle}>{hitResult.hitBetType}</p>
							</div>
						) : null}
						{hitResult.status === "hit" && hitResult.hitCombination ? (
							<div style={statCardStyle}>
								<p style={statLabelStyle}>的中買い目</p>
								<p style={judgeValueStyle}>{hitResult.hitCombination}</p>
							</div>
						) : null}
					</div>
				</section>

				{prediction ? (
					<section style={sectionCardStyle}>
						<div style={sectionHeaderStyle}>
							<h4 style={sectionTitleStyle}>保存済み予想</h4>
							<p style={sectionMetaStyle}>{prediction.savedAt}</p>
						</div>
						<div style={statGridStyle}>
							<div style={statCardStyle}>
								<p style={statLabelStyle}>買い目数</p>
								<p style={statValueStyle}>{ticketCounts.total}件</p>
							</div>
							<div style={statCardStyle}>
								<p style={statLabelStyle}>3連単数</p>
								<p style={statValueStyle}>{ticketCounts.trifecta}件</p>
							</div>
							<div style={statCardStyle}>
								<p style={statLabelStyle}>2連単数</p>
								<p style={statValueStyle}>{ticketCounts.exacta}件</p>
							</div>
						</div>
						<p style={previewStyle}>{truncate(prediction.predictionText, 200)}</p>
					</section>
				) : null}

				{practiceResult ? (
					<section style={sectionCardStyle}>
						<div style={sectionHeaderStyle}>
							<h4 style={sectionTitleStyle}>保存済み実践結果</h4>
							<p style={sectionMetaStyle}>{practiceResult.savedAt}</p>
						</div>
						<div style={statGridStyle}>
							<div style={statCardStyle}>
								<p style={statLabelStyle}>実着順</p>
								<p style={statValueStyle}>{practiceResult.actualFinishOrderText || "-"}</p>
							</div>
							<div style={statCardStyle}>
								<p style={statLabelStyle}>投資額</p>
								<p style={statValueStyle}>{formatAmount(practiceResult.investmentAmount)}</p>
							</div>
							<div style={statCardStyle}>
								<p style={statLabelStyle}>払戻額</p>
								<p style={statValueStyle}>{formatAmount(practiceResult.payoutAmount)}</p>
							</div>
							<div style={statCardStyle}>
								<p style={statLabelStyle}>収支</p>
								<p style={statValueStyle}>{formatProfitLoss(practiceResult.profitLoss)}</p>
							</div>
							<div style={statCardStyle}>
								<p style={statLabelStyle}>回収率</p>
								<p style={statValueStyle}>{formatRoi(practiceResult.roi)}</p>
							</div>
						</div>
						<p style={previewStyle}>{truncate(practiceResult.practiceMemo, 120)}</p>
					</section>
				) : null}
			</div>
		</article>
	);
}