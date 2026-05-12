import type { ChangeEvent } from "react";
import type { BoatPredictionTicket } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";
import { BoatPredictionTicketPreview } from "./BoatPredictionTicketPreview";

type BoatPredictionPastePanelProps = {
	value: string;
	raceLabel: string;
	tickets: BoatPredictionTicket[];
	savedAt?: string;
	isSaved?: boolean;
	onSave?: () => void;
	onChange: (value: string) => void;
	onClear?: () => void;
};

const wrapStyle = {
	display: "grid",
	gap: "16px",
	padding: "24px",
	borderRadius: "30px",
	background: "rgba(255, 255, 255, 0.98)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
};

const headerStyle = {
	display: "grid",
	gap: "12px",
};

const titleStyle = {
	margin: 0,
	fontSize: "1.14rem",
	color: boatTheme.colors.navy,
};

const descriptionStyle = {
	margin: 0,
	lineHeight: 1.7,
	color: boatTheme.colors.muted,
};

const infoGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: "10px",
};

const infoCardStyle = {
	padding: "12px 14px",
	borderRadius: "16px",
	background: "rgba(250, 252, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "4px",
};

const infoLabelStyle = {
	margin: 0,
	fontSize: "0.8rem",
	fontWeight: 700,
	color: boatTheme.colors.aquaDeep,
};

const infoValueStyle = {
	margin: 0,
	fontSize: "0.92rem",
	fontWeight: 700,
	color: boatTheme.colors.navy,
};

const textareaStyle = {
	width: "100%",
	minHeight: "420px",
	padding: "20px",
	borderRadius: "20px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(247, 252, 255, 0.96)",
	color: boatTheme.colors.navy,
	lineHeight: 1.7,
	fontSize: "0.94rem",
	boxSizing: "border-box" as const,
	resize: "vertical" as const,
	outline: "none",
};

const actionRowStyle = {
	display: "flex",
	gap: "10px",
	flexWrap: "wrap" as const,
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
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	gap: "10px",
};

const footerCardStyle = {
	padding: "12px 14px",
	borderRadius: "16px",
	background: "rgba(248, 250, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "4px",
};

const placeholderText = `買い目（10点）

3連単（厚め2点）
01 1-2-3
02 1-3-2

3連単（本線6点）
03 1-2-4
04 1-4-2
05 1-3-4
06 1-4-3
07 2-1-3
08 2-1-4

2連単（穴狙い2点）
09 3-1
10 4-1

展開メモ：
本命：
相手：
穴：
注意：`;

const savedAtStyle = {
	margin: 0,
	fontSize: "0.78rem",
	color: boatTheme.colors.muted,
};

export function BoatPredictionPastePanel({
	value,
	raceLabel,
	tickets,
	savedAt,
	isSaved = false,
	onSave,
	onChange,
	onClear,
}: BoatPredictionPastePanelProps) {
	const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		onChange(event.target.value);
	};

	const handleClear = () => {
		if (onClear) {
			onClear();
			return;
		}

		onChange("");
	};

	return (
		<section style={wrapStyle}>
			<div style={headerStyle}>
				<h3 style={titleStyle}>GPT予想貼り付け欄</h3>
				<p style={descriptionStyle}>GPTから返ってきた予想をここに貼り付けます。保存機能は次の段階で追加します。</p>
				<div style={infoGridStyle}>
					{[
						{ label: "対象レース", value: raceLabel },
						{ label: "結果連携", value: "次工程で対応" },
					].map((item) => (
						<article key={item.label} style={infoCardStyle}>
							<p style={infoLabelStyle}>{item.label}</p>
							<p style={infoValueStyle}>{item.value}</p>
						</article>
					))}
					<article style={infoCardStyle}>
						<p style={infoLabelStyle}>保存状態</p>
						<p style={infoValueStyle}>{isSaved ? "保存済み" : "保存前"}</p>
						{isSaved && savedAt ? <p style={savedAtStyle}>{savedAt}</p> : null}
					</article>
				</div>
			</div>
			<textarea style={textareaStyle} value={value} onChange={handleChange} placeholder={placeholderText} />
			<div style={actionRowStyle}>
				<button type="button" style={primaryButtonStyle}>貼り付け内容を整える</button>
				<button type="button" style={secondaryButtonStyle} onClick={onSave}>保存</button>
				<button type="button" style={secondaryButtonStyle} onClick={handleClear}>クリア</button>
			</div>
			<BoatPredictionTicketPreview tickets={tickets} />
			<div style={footerGridStyle}>
				{[
					{ label: "展開メモ", value: "進入と展示STの差を短く整理" },
					{ label: "本命 / 相手 / 穴", value: "本命と穴候補を追記予定" },
					{ label: "注意点", value: "保存と結果連携は次工程で追加" },
				].map((item) => (
					<article key={item.label} style={footerCardStyle}>
						<p style={infoLabelStyle}>{item.label}</p>
						<p style={{ ...infoValueStyle, fontWeight: 600 }}>{item.value}</p>
					</article>
				))}
			</div>
		</section>
	);
}