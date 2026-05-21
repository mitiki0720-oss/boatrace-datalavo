import type { ChangeEvent, CSSProperties } from "react";
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

const wrapStyle: CSSProperties = {
	position: "relative",
	overflow: "hidden",
	display: "grid",
	gap: "18px",
	padding: "24px",
	borderRadius: "32px",
	background:
		"linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(246,252,255,0.96) 48%, rgba(239,251,249,0.92) 100%)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: "0 22px 54px rgba(17, 64, 92, 0.1)",
};

const glowStyle: CSSProperties = {
	position: "absolute",
	top: "-90px",
	right: "-70px",
	width: "260px",
	height: "260px",
	borderRadius: "999px",
	background: "radial-gradient(circle, rgba(93, 199, 232, 0.22) 0%, rgba(93, 199, 232, 0) 70%)",
	pointerEvents: "none",
};

const headerStyle: CSSProperties = {
	position: "relative",
	zIndex: 1,
	display: "grid",
	gridTemplateColumns: "minmax(0, 1fr) auto",
	gap: "18px",
	alignItems: "start",
};

const headerTextStyle: CSSProperties = {
	display: "grid",
	gap: "8px",
};

const eyebrowStyle: CSSProperties = {
	margin: 0,
	width: "fit-content",
	padding: "6px 11px",
	borderRadius: "999px",
	background: "rgba(230, 246, 255, 0.95)",
	border: "1px solid rgba(93, 199, 232, 0.32)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.72rem",
	fontWeight: 900,
	letterSpacing: "0.1em",
	textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
	margin: 0,
	fontSize: "1.28rem",
	lineHeight: 1.25,
	color: boatTheme.colors.navy,
	letterSpacing: "-0.03em",
};

const descriptionStyle: CSSProperties = {
	margin: 0,
	lineHeight: 1.8,
	color: boatTheme.colors.muted,
	fontSize: "0.88rem",
};

const actionRowStyle: CSSProperties = {
	display: "flex",
	gap: "10px",
	flexWrap: "wrap",
	justifyContent: "flex-end",
};

const buttonBaseStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: "8px",
	minHeight: "42px",
	padding: "11px 15px",
	borderRadius: "16px",
	fontWeight: 900,
	fontSize: "0.82rem",
	cursor: "pointer",
	transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
};

const primaryButtonStyle: CSSProperties = {
	...buttonBaseStyle,
	border: "1px solid rgba(17, 64, 92, 0.08)",
	background: "linear-gradient(135deg, #12344f 0%, #1e5778 100%)",
	color: "#ffffff",
	boxShadow: "0 14px 28px rgba(18, 52, 79, 0.18)",
};

const secondaryButtonStyle: CSSProperties = {
	...buttonBaseStyle,
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.9)",
	color: boatTheme.colors.navy,
	boxShadow: "0 10px 22px rgba(17, 64, 92, 0.06)",
};

const statusGridStyle: CSSProperties = {
	position: "relative",
	zIndex: 1,
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: "10px",
};

const statusCardStyle: CSSProperties = {
	position: "relative",
	overflow: "hidden",
	padding: "14px 15px",
	borderRadius: "20px",
	background: "rgba(255, 255, 255, 0.82)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "5px",
	boxShadow: "0 12px 28px rgba(17, 64, 92, 0.055)",
};

const infoLabelStyle: CSSProperties = {
	margin: 0,
	fontSize: "0.72rem",
	fontWeight: 900,
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: boatTheme.colors.aquaDeep,
};

const infoValueStyle: CSSProperties = {
	margin: 0,
	fontSize: "0.96rem",
	fontWeight: 900,
	color: boatTheme.colors.navy,
	lineHeight: 1.35,
};

const savedAtStyle: CSSProperties = {
	margin: 0,
	fontSize: "0.76rem",
	color: boatTheme.colors.muted,
	lineHeight: 1.5,
};

const editorShellStyle: CSSProperties = {
	position: "relative",
	zIndex: 1,
	overflow: "hidden",
	borderRadius: "26px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255,255,255,0.78)",
	boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95)",
};

const editorTopbarStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
	padding: "12px 14px",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	background: "linear-gradient(90deg, rgba(238, 249, 255, 0.95), rgba(246, 253, 250, 0.95))",
};

const dotGroupStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "6px",
};

const dotStyle: CSSProperties = {
	width: "8px",
	height: "8px",
	borderRadius: "999px",
	background: "rgba(93, 199, 232, 0.72)",
};

const editorMetaStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.muted,
	fontSize: "0.76rem",
	fontWeight: 800,
};

const textareaStyle: CSSProperties = {
	width: "100%",
	minHeight: "420px",
	padding: "18px 20px 20px",
	border: "none",
	background:
		"linear-gradient(180deg, rgba(248, 253, 255, 0.94) 0%, rgba(245, 252, 251, 0.92) 100%)",
	color: boatTheme.colors.navy,
	lineHeight: 1.75,
	fontSize: "0.94rem",
	boxSizing: "border-box",
	resize: "vertical",
	outline: "none",
	fontFamily:
		"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
};

const footerGridStyle: CSSProperties = {
	position: "relative",
	zIndex: 1,
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: "10px",
};

const footerCardStyle: CSSProperties = {
	padding: "13px 14px",
	borderRadius: "18px",
	background: "rgba(255, 255, 255, 0.78)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "5px",
};

const placeholderText = `買い目（10点）

3連単（厚め2点）01/02
01 x-x-x
02 x-x-x

3連単（本線3点）03-05
03 x-x-x
04 x-x-x
05 x-x-x

3連単（中穴3点）06-08
06 x-x-x
07 x-x-x
08 x-x-x

3連単（大穴2点）09/10
09 x-x-x
10 x-x-x

展開メモ：
本命：
相手：
穴：

注意：`;

const formatTextCount = (text: string) => {
	const trimmed = text.trim();

	return {
		characters: trimmed.length,
		lines: trimmed ? trimmed.split(/\r?\n/).length : 0,
	};
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

	const textCount = formatTextCount(value);

	return (
		<section style={wrapStyle}>
			<style>
				{`
					.boat-prediction-paste-button:hover {
						transform: translateY(-1px);
					}

					.boat-prediction-paste-textarea::placeholder {
						color: rgba(82, 111, 132, 0.55);
					}

					.boat-prediction-paste-textarea::-webkit-scrollbar {
						width: 10px;
					}

					.boat-prediction-paste-textarea::-webkit-scrollbar-track {
						background: rgba(230, 246, 255, 0.8);
						border-radius: 999px;
					}

					.boat-prediction-paste-textarea::-webkit-scrollbar-thumb {
						background: linear-gradient(180deg, rgba(93, 199, 232, 0.75), rgba(18, 52, 79, 0.65));
						border-radius: 999px;
						border: 2px solid rgba(245, 252, 255, 0.95);
					}

					@media (max-width: 920px) {
						.boat-prediction-paste-header {
							grid-template-columns: 1fr !important;
						}

						.boat-prediction-paste-actions {
							justify-content: flex-start !important;
						}

						.boat-prediction-paste-status,
						.boat-prediction-paste-footer {
							grid-template-columns: 1fr !important;
						}
					}
				`}
			</style>

			<span style={glowStyle} />

			<div className="boat-prediction-paste-header" style={headerStyle}>
				<div style={headerTextStyle}>
					<p style={eyebrowStyle}>AI Prediction Note</p>
					<h3 style={titleStyle}>GPT予想貼り付け欄</h3>
					<p style={descriptionStyle}>
						GPTから返ってきた競艇10点フォーマットの買い目と展開メモを保存します。保存後は同じ日付・会場・レースで再表示します。
					</p>
				</div>

				<div className="boat-prediction-paste-actions" style={actionRowStyle}>
					<button className="boat-prediction-paste-button" type="button" style={primaryButtonStyle}>
						整える
					</button>
					<button className="boat-prediction-paste-button" type="button" style={secondaryButtonStyle} onClick={onSave}>
						保存
					</button>
					<button className="boat-prediction-paste-button" type="button" style={secondaryButtonStyle} onClick={handleClear}>
						クリア
					</button>
				</div>
			</div>

			<div className="boat-prediction-paste-status" style={statusGridStyle}>
				{[
					{ label: "Target Race", value: raceLabel, sub: "選択中の会場・レース" },
					{ label: "Paste Volume", value: `${textCount.characters.toLocaleString()}字`, sub: `${textCount.lines.toLocaleString()}行` },
					{ label: "Save Status", value: isSaved ? "保存済み" : "保存前", sub: isSaved && savedAt ? savedAt : "保存すると結果確認へ連携" },
				].map((item) => (
					<article key={item.label} style={statusCardStyle}>
						<p style={infoLabelStyle}>{item.label}</p>
						<p style={infoValueStyle}>{item.value}</p>
						<p style={savedAtStyle}>{item.sub}</p>
					</article>
				))}
			</div>

			<div style={editorShellStyle}>
				<div style={editorTopbarStyle}>
					<div style={dotGroupStyle} aria-hidden="true">
						<span style={dotStyle} />
						<span style={{ ...dotStyle, background: "rgba(32, 201, 151, 0.72)" }} />
						<span style={{ ...dotStyle, background: "rgba(159, 137, 216, 0.72)" }} />
					</div>
					<p style={editorMetaStyle}>競艇10点フォーマット / 展開メモ / 注意点を保存</p>
				</div>

				<textarea
					className="boat-prediction-paste-textarea"
					style={textareaStyle}
					value={value}
					onChange={handleChange}
					placeholder={placeholderText}
				/>
			</div>

			<BoatPredictionTicketPreview tickets={tickets} />

			<div className="boat-prediction-paste-footer" style={footerGridStyle}>
				{[
					{ label: "Flow Memo", value: "進入・ST・展示気配を短く整理" },
					{ label: "Main / Cover / Hole", value: "本命、相手、穴候補を分けて保存" },
					{ label: "Review Ready", value: "保存後に結果確認と的中ログへ接続" },
				].map((item) => (
					<article key={item.label} style={footerCardStyle}>
						<p style={infoLabelStyle}>{item.label}</p>
						<p style={{ ...infoValueStyle, fontSize: "0.86rem", fontWeight: 800 }}>{item.value}</p>
					</article>
				))}
			</div>
		</section>
	);
}
