import type { ChangeEvent, CSSProperties } from "react";
import type { ParsedBoatBetSummary } from "../../lib/boatBetParser";
import type { BoatPracticeResultStatus } from "../../lib/boatResultSettlement";
import type { BoatPredictionTicket } from "../../lib/boatraceTypes";
import { countBoatPredictionTicketsByType } from "../../lib/boatPredictionParser";
import { boatTheme } from "../../lib/theme";

type BoatPracticeResultPanelProps = {
	venueName: string;
	raceNo: number;
	raceTitle?: string;
	tickets: BoatPredictionTicket[];
	savedAt?: string;
	isSaved?: boolean;
	onSave?: () => void;
	onClear?: () => void;
	onLoadBets?: () => void;
	onSettleResult?: () => void;
	actualFinishOrderText: string;
	investmentAmount: number;
	payoutAmount: number;
	practiceMemo: string;
	betSummary?: Pick<ParsedBoatBetSummary, "totalBets" | "trifectaCount" | "exactaCount" | "totalStakeYen">;
	resultStatus?: BoatPracticeResultStatus;
	kimarite?: string;
	startInfoText?: string;
	hitBetLabel?: string;
	settlementMessage?: string;
	isBetAutoApplied?: boolean;
	isResultAutoApplied?: boolean;
	onChangeFinishOrder: (value: string) => void;
	onChangeInvestmentAmount: (value: number) => void;
	onChangePayoutAmount: (value: number) => void;
	onChangePracticeMemo: (value: string) => void;
};

const wrapStyle = {
	padding: "26px",
	borderRadius: "32px",
	background: "rgba(255, 255, 255, 0.99)",
	border: "1px solid rgba(229, 192, 202, 0.5)",
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "18px",
};

const headerStyle = {
	display: "grid",
	gap: "8px",
};

const titleStyle = {
	margin: 0,
	fontSize: "1.35rem",
	color: boatTheme.colors.navy,
};

const descriptionStyle = {
	margin: 0,
	lineHeight: 1.8,
	color: boatTheme.colors.muted,
};

const statusRowStyle = {
	display: "flex",
	gap: "10px",
	flexWrap: "wrap" as const,
	alignItems: "center",
};

const statusChipStyle = {
	padding: "8px 12px",
	borderRadius: "999px",
	background: "rgba(233, 238, 255, 0.92)",
	color: boatTheme.colors.navy,
	fontWeight: 700,
	fontSize: "0.84rem",
	border: "1px solid rgba(176, 198, 214, 0.42)",
};

const savedAtStyle = {
	margin: 0,
	fontSize: "0.8rem",
	color: boatTheme.colors.muted,
};

const topGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
	gap: "16px",
};

const cardStyle = {
	padding: "20px",
	borderRadius: "24px",
	background: "linear-gradient(180deg, rgba(250, 252, 255, 0.98), rgba(246, 250, 249, 0.95))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "12px",
};

const resultValueStyle = {
	margin: 0,
	fontSize: "clamp(2rem, 4vw, 3rem)",
	fontWeight: 800,
	letterSpacing: "0.06em",
	color: boatTheme.colors.navy,
};

const rankRowStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "10px",
};

const getRankChipStyle = (value: string | number): CSSProperties => {
	const palette = getBoatNumberChipStyle(value);

	return {
		width: "42px",
		height: "42px",
		borderRadius: "15px",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		background: palette.background,
		color: palette.color,
		border: `1px solid ${palette.border}`,
		fontWeight: 950,
		boxShadow: palette.shadow,
	};
};

const detailGridStyle = {
	display: "grid",
	gap: "8px",
	color: boatTheme.colors.muted,
	lineHeight: 1.7,
};

const stripStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: "10px",
};

const stripItemStyle = {
	padding: "10px 12px",
	borderRadius: "14px",
	background: "rgba(245, 247, 250, 0.95)",
	border: `1px solid rgba(210, 199, 205, 0.42)`,
	fontSize: "0.9rem",
	fontWeight: 700,
	color: boatTheme.colors.navy,
	textAlign: "center" as const,
};

const chipRowStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "10px",
};

const tagStyle = {
	padding: "8px 12px",
	borderRadius: "999px",
	background: "rgba(233, 238, 255, 0.92)",
	color: boatTheme.colors.navy,
	fontWeight: 700,
	fontSize: "0.85rem",
	border: "1px solid rgba(176, 198, 214, 0.42)",
};

const summaryGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
	gap: "12px",
};

const summaryCardStyle = {
	padding: "18px",
	borderRadius: "20px",
	background: "rgba(255, 255, 255, 0.94)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "6px",
};

const labelStyle = {
	margin: 0,
	fontSize: "0.82rem",
	fontWeight: 700,
	color: boatTheme.colors.aquaDeep,
};

const valueStyle = {
	margin: 0,
	fontSize: "1.08rem",
	fontWeight: 700,
	color: boatTheme.colors.navy,
};

const formGridStyle = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1fr) auto",
	gap: "16px",
	alignItems: "start",
};

const fieldsStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
	gap: "12px",
};

const fieldStyle = {
	display: "grid",
	gap: "8px",
};

const fieldLabelStyle = {
	margin: 0,
	fontSize: "0.84rem",
	fontWeight: 700,
	color: boatTheme.colors.aquaDeep,
};

const inputStyle = {
	width: "100%",
	padding: "14px 16px",
	borderRadius: "16px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.96)",
	color: boatTheme.colors.navy,
	boxSizing: "border-box" as const,
	outline: "none",
};

const textareaStyle = {
	...inputStyle,
	minHeight: "140px",
	resize: "vertical" as const,
	lineHeight: 1.7,
};

const buttonColumnStyle = {
	display: "grid",
	gap: "10px",
	minWidth: "140px",
};

const primaryButtonStyle = {
	padding: "12px 16px",
	borderRadius: "14px",
	border: "none",
	background: boatTheme.colors.navy,
	color: "#ffffff",
	fontWeight: 700,
	cursor: "pointer",
};

const secondaryButtonStyle = {
	padding: "12px 16px",
	borderRadius: "14px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.96)",
	color: boatTheme.colors.navy,
	fontWeight: 700,
	cursor: "pointer",
};

const footerGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: "10px",
};

const footerCardStyle = {
	padding: "12px 14px",
	borderRadius: "16px",
	background: "rgba(250, 248, 249, 0.96)",
	border: "1px solid rgba(218, 201, 206, 0.44)",
	display: "grid",
	gap: "4px",
};

const formatYen = (value: number) => `${value.toLocaleString("ja-JP")}円`;
const BOAT_NUMBER_COLOR_MAP: Record<
	number,
	{ background: string; color: string; border: string; shadow: string }
> = {
	1: {
		background: "#ffffff",
		color: "#111827",
		border: "#cfd8e3",
		shadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
	},
	2: {
		background: "#111827",
		color: "#ffffff",
		border: "#111827",
		shadow: "0 8px 18px rgba(17, 24, 39, 0.22)",
	},
	3: {
		background: "#ef4444",
		color: "#ffffff",
		border: "#ef4444",
		shadow: "0 8px 18px rgba(239, 68, 68, 0.2)",
	},
	4: {
		background: "#2563eb",
		color: "#ffffff",
		border: "#2563eb",
		shadow: "0 8px 18px rgba(37, 99, 235, 0.2)",
	},
	5: {
		background: "#facc15",
		color: "#111827",
		border: "#eab308",
		shadow: "0 8px 18px rgba(234, 179, 8, 0.2)",
	},
	6: {
		background: "#22c55e",
		color: "#ffffff",
		border: "#22c55e",
		shadow: "0 8px 18px rgba(34, 197, 94, 0.2)",
	},
};

const getBoatNumberChipStyle = (value: string | number) => {
	const boatNo = Number(value);
	const palette = BOAT_NUMBER_COLOR_MAP[boatNo];

	if (!palette) {
		return {
			background: "#eef4f8",
			color: "#16324f",
			border: "#d6dee8",
			shadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
		};
	}

	return palette;
};

export function BoatPracticeResultPanel({
	venueName,
	raceNo,
	raceTitle,
	tickets,
	savedAt,
	isSaved = false,
	onSave,
	onClear,
	onLoadBets,
	onSettleResult,
	actualFinishOrderText,
	investmentAmount,
	payoutAmount,
	practiceMemo,
	betSummary,
	resultStatus,
	kimarite,
	startInfoText,
	hitBetLabel,
	settlementMessage,
	isBetAutoApplied,
	isResultAutoApplied,
	onChangeFinishOrder,
	onChangeInvestmentAmount,
	onChangePayoutAmount,
	onChangePracticeMemo,
}: BoatPracticeResultPanelProps) {
	const finishParts = actualFinishOrderText
		.trim()
		.replace(/[＝=]/g, "-")
		.split("-")
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, 3);
	const profitLoss = payoutAmount - investmentAmount;
	const roi = investmentAmount > 0 ? (payoutAmount / investmentAmount) * 100 : 0;
	const ticketCounts = countBoatPredictionTicketsByType(tickets);
	const totalBets = betSummary?.totalBets ?? ticketCounts.total;
	const trifectaCount = betSummary?.trifectaCount ?? ticketCounts.trifecta;
	const exactaCount = betSummary?.exactaCount ?? ticketCounts.exacta;
	const resultStatusLabel =
		resultStatus === "confirmed"
			? "結果データ照合済み"
			: resultStatus === "pending"
				? "結果待ち"
				: resultStatus === "missing"
					? "結果未取得"
					: "手動確認";

	const handleAmountChange = (handler: (value: number) => void) => (event: ChangeEvent<HTMLInputElement>) => {
		handler(Number(event.target.value) || 0);
	};

	const handleClear = () => {
		if (onClear) {
			onClear();
			return;
		}

		onChangeFinishOrder("");
		onChangeInvestmentAmount(1000);
		onChangePayoutAmount(0);
		onChangePracticeMemo("");
	};

	return (
		<section style={wrapStyle}>
			<header style={headerStyle}>
				<h3 style={titleStyle}>実践結果・収支確認パネル</h3>
				<p style={descriptionStyle}>実着順、投資額、払戻、メモをその場で整理し、あとから保存や結果連携を足しやすい形に整えています。</p>
				<div style={statusRowStyle}>
					<span style={statusChipStyle}>{isSaved ? "実践結果 保存済み" : "実践結果 未保存"}</span>
					{isBetAutoApplied ? <span style={statusChipStyle}>買い目から自動計算 / 1点100円</span> : null}
					{isResultAutoApplied || resultStatus ? <span style={statusChipStyle}>{resultStatusLabel}</span> : null}
					{hitBetLabel ? <span style={statusChipStyle}>的中: {hitBetLabel}</span> : null}
					{isSaved && savedAt ? <p style={savedAtStyle}>{savedAt}</p> : null}
				</div>
			</header>

			<div style={topGridStyle}>
				<div style={cardStyle}>
					<p style={labelStyle}>的中着順</p>
					<p style={resultValueStyle}>{actualFinishOrderText || "-"}</p>
					<div style={rankRowStyle}>
						{[0, 1, 2].map((index) => (
							<span key={index} style={getRankChipStyle(finishParts[index] || "-")}>
								{finishParts[index] || "-"}
							</span>
						))}
					</div>
				</div>

				<div style={cardStyle}>
					<p style={labelStyle}>対象レース情報</p>
					<div style={detailGridStyle}>
						<div>結果ステータス: {resultStatusLabel}</div>
						{kimarite ? <div>決まり手: {kimarite}</div> : null}
						{startInfoText ? <div>S/H/B: {startInfoText}</div> : null}
						{settlementMessage ? <div>照合: {settlementMessage}</div> : null}
						<div>日付: 2026-05-03</div>
						<div>会場: {venueName}</div>
						<div>レース番号: {raceNo}R</div>
						<div>ステータス: 手動確認待ち</div>
						<div>備考: {raceTitle ?? "実践確認メモを入力"}</div>
					</div>
				</div>
			</div>

			<div style={stripStyle}>
				<div style={stripItemStyle}>着順</div>
				<div style={stripItemStyle}>収支</div>
				<div style={stripItemStyle}>メモ</div>
				<div style={stripItemStyle}>確認状態</div>
			</div>

			<div style={chipRowStyle}>
				{tickets.length > 0 ? (
					tickets.map((ticket) => (
						<span key={`${ticket.betType}-${ticket.combination}`} style={tagStyle}>
							{ticket.index} {ticket.betType} {ticket.combination} {ticket.group ?? "その他"}
						</span>
					))
				) : (
					<span style={tagStyle}>買い目未読込</span>
				)}
			</div>

			{betSummary ? (
				<div style={summaryGridStyle}>
					<article style={summaryCardStyle}><p style={labelStyle}>買い目数</p><p style={valueStyle}>{totalBets}件</p></article>
					<article style={summaryCardStyle}><p style={labelStyle}>3連単数</p><p style={valueStyle}>{trifectaCount}件</p></article>
					<article style={summaryCardStyle}><p style={labelStyle}>2連単数</p><p style={valueStyle}>{exactaCount}件</p></article>
					<article style={summaryCardStyle}><p style={labelStyle}>1点100円</p><p style={valueStyle}>{formatYen(betSummary.totalStakeYen)}</p></article>
				</div>
			) : null}

			<div style={summaryGridStyle}>
				{[
					{ label: "買い目数", value: `${totalBets}件` },
					{ label: "3連単数", value: `${trifectaCount}件` },
					{ label: "2連単数", value: `${exactaCount}件` },
					{ label: "投資額", value: formatYen(investmentAmount) },
					{ label: "払戻", value: formatYen(payoutAmount) },
					{ label: "収支", value: formatYen(profitLoss) },
					{ label: "回収率", value: `${roi.toFixed(1)}%` },
				].map((item) => (
					<article key={item.label} style={summaryCardStyle}>
						<p style={labelStyle}>{item.label}</p>
						<p style={valueStyle}>{item.value}</p>
					</article>
				))}
			</div>

			<div style={formGridStyle}>
				<div style={{ display: "grid", gap: "14px" }}>
					<div style={fieldsStyle}>
						<div style={fieldStyle}>
							<p style={fieldLabelStyle}>投資額</p>
							<input type="number" style={inputStyle} value={investmentAmount} onChange={handleAmountChange(onChangeInvestmentAmount)} />
						</div>
						<div style={fieldStyle}>
							<p style={fieldLabelStyle}>払戻</p>
							<input type="number" style={inputStyle} value={payoutAmount} onChange={handleAmountChange(onChangePayoutAmount)} />
						</div>
						<div style={fieldStyle}>
							<p style={fieldLabelStyle}>実着順</p>
							<input type="text" style={inputStyle} value={actualFinishOrderText} onChange={(event) => onChangeFinishOrder(event.target.value)} placeholder="4-1-2" />
						</div>
					</div>

					<div style={fieldStyle}>
						<p style={fieldLabelStyle}>実践メモ</p>
						<textarea style={textareaStyle} value={practiceMemo} onChange={(event) => onChangePracticeMemo(event.target.value)} placeholder="現地の感触、買い目の振り返り、次回の注意点を記録" />
					</div>
				</div>

				<div style={buttonColumnStyle}>
					<button type="button" style={secondaryButtonStyle} onClick={onLoadBets}>買い目読込</button>
					<button type="button" style={secondaryButtonStyle} onClick={onSettleResult}>結果照合</button>
					<button type="button" style={primaryButtonStyle} onClick={onSave}>実践結果を保存</button>
					<button type="button" style={secondaryButtonStyle} onClick={handleClear}>クリア</button>
				</div>
			</div>

			<div style={footerGridStyle}>
				{[
					{ label: "会場", value: venueName },
					{ label: "レース", value: `${raceNo}R` },
					{ label: "買い目数", value: `${totalBets}件` },
					{ label: "投資", value: formatYen(investmentAmount) },
					{ label: "払戻", value: formatYen(payoutAmount) },
					{ label: "着順", value: actualFinishOrderText || "-" },
					{ label: "回収率", value: `${roi.toFixed(1)}%` },
				].map((item) => (
					<article key={item.label} style={footerCardStyle}>
						<p style={labelStyle}>{item.label}</p>
						<p style={{ ...valueStyle, fontSize: "0.98rem" }}>{item.value}</p>
					</article>
				))}
			</div>
		</section>
	);
}
