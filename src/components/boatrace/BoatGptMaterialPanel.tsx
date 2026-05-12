import { useState } from "react";
import { boatTheme } from "../../lib/theme";

type BoatGptMaterialPanelProps = {
	materialText: string;
	raceLabel: string;
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
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "12px",
	flexWrap: "wrap" as const,
};

const titleRowStyle = {
	display: "grid",
	gap: "10px",
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

const chipRowStyle = {
	display: "flex",
	gap: "8px",
	flexWrap: "wrap" as const,
};

const chipStyle = {
	padding: "6px 10px",
	borderRadius: "999px",
	background: "rgba(233, 238, 255, 0.9)",
	color: boatTheme.colors.navy,
	fontSize: "0.8rem",
	fontWeight: 700,
};

const helperStyle = {
	margin: 0,
	fontSize: "0.84rem",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 700,
};

const textareaStyle = {
	width: "100%",
	minHeight: "460px",
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

const footerGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: "10px",
};

const footerCardStyle = {
	padding: "12px 14px",
	borderRadius: "16px",
	background: "rgba(250, 252, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "4px",
};

const footerLabelStyle = {
	margin: 0,
	fontSize: "0.8rem",
	fontWeight: 700,
	color: boatTheme.colors.aquaDeep,
};

const footerValueStyle = {
	margin: 0,
	fontSize: "0.92rem",
	fontWeight: 700,
	color: boatTheme.colors.navy,
};

export function BoatGptMaterialPanel({ materialText, raceLabel }: BoatGptMaterialPanelProps) {
	const [statusText, setStatusText] = useState<string>("");
	const lineCount = materialText.split(/\r?\n/).length;
	const charCount = materialText.length;

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(materialText);
			setStatusText("素材をコピーしました。");
		} catch {
			setStatusText("コピーに失敗しました。手動でコピーしてください。");
		}
	};

	return (
		<section style={wrapStyle}>
			<div style={headerStyle}>
				<div style={titleRowStyle}>
					<h3 style={titleStyle}>GPT貼り付け用素材</h3>
					<p style={descriptionStyle}>選択中レースの出走表・展示・モーター・天気・オッズをGPTへ渡す形に整えています。</p>
					<div style={chipRowStyle}>
						<span style={chipStyle}>素材生成済み</span>
						<span style={chipStyle}>{raceLabel}</span>
						<span style={chipStyle}>{charCount.toLocaleString("ja-JP")}文字</span>
						<span style={chipStyle}>{lineCount}行</span>
					</div>
				</div>
				<div style={actionRowStyle}>
					<button type="button" style={primaryButtonStyle} onClick={handleCopy}>コピー</button>
					<button type="button" style={secondaryButtonStyle}>TXTダウンロード</button>
				</div>
			</div>
			{statusText ? <p style={helperStyle}>{statusText}</p> : null}
			<textarea style={textareaStyle} readOnly value={materialText} />
			<div style={footerGridStyle}>
				{[
					{ label: "素材の要点", value: "出走表 / 展示 / オッズを整理" },
					{ label: "対象会場", value: raceLabel.split(" ")[0] ?? "-" },
					{ label: "対象レース", value: raceLabel.split(" ").slice(1).join(" ") || "-" },
					{ label: "補足メモ", value: "次工程で保存やダウンロードを追加" },
				].map((item) => (
					<article key={item.label} style={footerCardStyle}>
						<p style={footerLabelStyle}>{item.label}</p>
						<p style={footerValueStyle}>{item.value}</p>
					</article>
				))}
			</div>
		</section>
	);
}