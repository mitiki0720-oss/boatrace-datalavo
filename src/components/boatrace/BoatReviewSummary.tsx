import { boatTheme } from "../../lib/theme";

type BoatReviewSummaryProps = {
	predictionCount: number;
	practiceResultCount: number;
	totalInvestment: number;
	totalPayout: number;
	totalProfitLoss: number;
	totalRoi: number;
	hitCount: number;
	missCount: number;
	pendingCount: number;
};

const wrapStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
	gap: "14px",
};

const cardStyle = {
	padding: "18px 16px",
	borderRadius: "24px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(233, 249, 245, 0.92))",
	border: "1px solid rgba(173, 220, 211, 0.5)",
	boxShadow: "0 18px 38px rgba(113, 162, 165, 0.12)",
	display: "grid",
	gap: "8px",
};

const labelStyle = {
	margin: 0,
	fontSize: "0.82rem",
	fontWeight: 700,
	letterSpacing: "0.04em",
	color: "#5d8182",
	textTransform: "uppercase" as const,
};

const valueStyle = {
	margin: 0,
	fontSize: "1.35rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
	lineHeight: 1.25,
};

const captionStyle = {
	margin: 0,
	fontSize: "0.8rem",
	color: boatTheme.colors.muted,
	lineHeight: 1.6,
};

const formatAmount = (value: number) => `${value.toLocaleString("ja-JP")}円`;

const formatProfitLoss = (value: number) => {
	const prefix = value > 0 ? "+" : "";
	return `${prefix}${value.toLocaleString("ja-JP")}円`;
};

const formatRoi = (value: number) => `${value.toFixed(1)}%`;

export function BoatReviewSummary({
	predictionCount,
	practiceResultCount,
	totalInvestment,
	totalPayout,
	totalProfitLoss,
	totalRoi,
	hitCount,
	missCount,
	pendingCount,
}: BoatReviewSummaryProps) {
	const items = [
		{
			label: "保存済み予想",
			value: `${predictionCount}件`,
			caption: "GPT予想本文と買い目を保存した件数です。",
			style: cardStyle,
		},
		{
			label: "実践結果",
			value: `${practiceResultCount}件`,
			caption: "手入力した実践結果と収支の保存件数です。",
			style: cardStyle,
		},
		{
			label: "投資合計",
			value: formatAmount(totalInvestment),
			caption: "保存済み実践結果の投資額を合算しています。",
			style: cardStyle,
		},
		{
			label: "払戻合計",
			value: formatAmount(totalPayout),
			caption: "保存済み実践結果の払戻額を合算しています。",
			style: cardStyle,
		},
		{
			label: "収支",
			value: formatProfitLoss(totalProfitLoss),
			caption: "払戻合計から投資合計を引いた値です。",
			style: cardStyle,
		},
		{
			label: "回収率",
			value: formatRoi(totalRoi),
			caption: "払戻合計 ÷ 投資合計 × 100 です。",
			style: cardStyle,
		},
		{
			label: "的中",
			value: `${hitCount}件`,
			caption: "手入力した実着順と保存済み買い目が一致した件数です。",
			style: {
				...cardStyle,
				background: "linear-gradient(180deg, rgba(244, 255, 252, 0.98), rgba(216, 248, 239, 0.94))",
				border: "1px solid rgba(125, 210, 186, 0.58)",
				boxShadow: "0 18px 38px rgba(85, 175, 151, 0.14)",
			},
		},
		{
			label: "不的中",
			value: `${missCount}件`,
			caption: "実着順はあるが、今回対象の買い目と一致しなかった件数です。",
			style: {
				...cardStyle,
				background: "linear-gradient(180deg, rgba(255, 251, 251, 0.98), rgba(255, 236, 236, 0.94))",
				border: "1px solid rgba(231, 176, 176, 0.62)",
				boxShadow: "0 18px 38px rgba(195, 127, 127, 0.12)",
			},
		},
		{
			label: "未判定",
			value: `${pendingCount}件`,
			caption: "予想または実着順が揃っておらず、まだ判定できない件数です。",
			style: {
				...cardStyle,
				background: "linear-gradient(180deg, rgba(252, 253, 255, 0.98), rgba(239, 243, 247, 0.94))",
				border: "1px solid rgba(188, 199, 210, 0.6)",
				boxShadow: "0 18px 38px rgba(118, 134, 149, 0.1)",
			},
		},
	] as const;

	return (
		<div style={wrapStyle}>
			{items.map((item) => (
				<article key={item.label} style={item.style}>
					<p style={labelStyle}>{item.label}</p>
					<p style={valueStyle}>{item.value}</p>
					<p style={captionStyle}>{item.caption}</p>
				</article>
			))}
		</div>
	);
}