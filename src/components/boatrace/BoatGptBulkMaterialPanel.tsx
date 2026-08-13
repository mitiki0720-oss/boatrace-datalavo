import { useEffect, useRef, useState } from "react";
import type { BoatPredictionGptCopyExReferenceLevel } from "../../lib/boatPredictionGptCopyExContext";
import type { BoatPredictionVenueTimeKind } from "../../lib/boatPredictionGptCopy";
import { boatTheme } from "../../lib/theme";

type BoatGptBulkMaterialPanelProps = {
	materialText: string;
	venueName: string;
	dateLabel: string;
	raceRangeLabel: string;
	rangeTimeKind?: BoatPredictionVenueTimeKind;
	generatedRaceCount: number;
	expectedRaceCount: number;
	readyRaceCount?: number;
	partialRaceCount?: number;
	waitingRaceCount?: number;
	missingRaceLabels?: string[];
	activeRangeKey: string;
	rangePresets: Array<{
		key: string;
		label: string;
	}>;
	onSelectRange: (key: string) => void;
	includesExContext?: boolean;
	exReferenceLevelCounts?: Partial<Record<BoatPredictionGptCopyExReferenceLevel, number>>;
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

const presetWrapStyle = {
	display: "grid",
	gap: "8px",
	padding: "14px",
	borderRadius: "18px",
	background: "rgba(247, 252, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
};

const presetLabelStyle = {
	margin: 0,
	fontSize: "0.72rem",
	letterSpacing: "0.12em",
	fontWeight: 800,
	color: boatTheme.colors.aquaDeep,
};

const presetButtonRowStyle = {
	display: "flex",
	gap: "8px",
	flexWrap: "wrap" as const,
};

const presetButtonBaseStyle = {
	padding: "10px 14px",
	borderRadius: "999px",
	fontWeight: 800,
	cursor: "pointer",
};

const presetButtonActiveStyle = {
	...presetButtonBaseStyle,
	border: "none",
	background: boatTheme.colors.navy,
	color: "#ffffff",
};

const presetButtonInactiveStyle = {
	...presetButtonBaseStyle,
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.98)",
	color: boatTheme.colors.navy,
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

const warningChipStyle = {
	...chipStyle,
	background: "rgba(255, 247, 237, 0.96)",
	color: "#9a3412",
};

const helperStyle = {
	margin: 0,
	fontSize: "0.84rem",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 700,
};

const textareaStyle = {
	width: "100%",
	minHeight: "520px",
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
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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

const sanitizeDownloadName = (value: string): string =>
	value
		.normalize("NFKC")
		.replace(/[\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, "_")
		.trim() || "boat-gpt-material";

export function BoatGptBulkMaterialPanel({
	materialText,
	venueName,
	dateLabel,
	raceRangeLabel,
	rangeTimeKind,
	generatedRaceCount,
	expectedRaceCount,
	readyRaceCount = 0,
	partialRaceCount = 0,
	waitingRaceCount = 0,
	missingRaceLabels = [],
	activeRangeKey,
	rangePresets,
	onSelectRange,
	includesExContext = false,
	exReferenceLevelCounts,
}: BoatGptBulkMaterialPanelProps) {
	const [statusText, setStatusText] = useState<string>("");
	const statusTimerRef = useRef<number | null>(null);
	const lineCount = materialText ? materialText.split(/\r?\n/).length : 0;
	const charCount = materialText.length;
	const isExhibitionWaiting = waitingRaceCount > 0 || partialRaceCount > 0 || missingRaceLabels.length > 0;
	const exReferenceRaceCount = Object.values(exReferenceLevelCounts ?? {}).reduce((total, count) => total + (count ?? 0), 0);
	const sourceBackedExReferenceCount = (exReferenceLevelCounts?.A ?? 0) + (exReferenceLevelCounts?.B ?? 0) + (exReferenceLevelCounts?.C ?? 0);

	useEffect(() => {
		return () => {
			if (statusTimerRef.current !== null) {
				window.clearTimeout(statusTimerRef.current);
			}
		};
	}, []);

	const showTemporaryStatus = (message: string, durationMs: number) => {
		if (statusTimerRef.current !== null) {
			window.clearTimeout(statusTimerRef.current);
		}

		setStatusText(message);

		statusTimerRef.current = window.setTimeout(() => {
			setStatusText("");
			statusTimerRef.current = null;
		}, durationMs);
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(materialText);
			showTemporaryStatus(`${raceRangeLabel}まとめ素材をコピーしました。`, 1000);
		} catch {
			showTemporaryStatus("コピーに失敗しました。textareaから手動コピーしてください。", 3000);
		}
	};

	const handleDownload = () => {
		try {
			const blob = new Blob([materialText], { type: "text/plain;charset=utf-8" });
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${sanitizeDownloadName(`${dateLabel}_${venueName}_${raceRangeLabel}_gpt-material`)}.txt`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.URL.revokeObjectURL(url);
			showTemporaryStatus("TXTをダウンロードしました。", 1000);
		} catch {
			showTemporaryStatus("TXTダウンロードに失敗しました。", 3000);
		}
	};

	return (
		<section style={wrapStyle}>
			<div style={headerStyle}>
				<div style={titleRowStyle}>
					<h3 style={titleStyle}>GPT貼り付け用素材 {raceRangeLabel}まとめコピー</h3>
					<p style={descriptionStyle}>
						選択中会場の{raceRangeLabel}をまとめてGPTに貼り付けられる素材です。会場共通情報は上部に1回だけ出し、各Rはレース固有情報中心に軽量化しています。展示未取得の場合は事前予想素材として扱います。
					</p>
					<div style={presetWrapStyle}>
						<p style={presetLabelStyle}>RANGE PRESET</p>
						<div style={presetButtonRowStyle}>
							{rangePresets.map((preset) => {
								const isActive = preset.key === activeRangeKey;

								return (
									<button
										key={preset.key}
										type="button"
										style={isActive ? presetButtonActiveStyle : presetButtonInactiveStyle}
										onClick={() => onSelectRange(preset.key)}
										aria-pressed={isActive}
									>
										{preset.label}
									</button>
								);
							})}
						</div>
					</div>
					<div style={chipRowStyle}>
						<span style={chipStyle}>対象日 {dateLabel}</span>
						<span style={chipStyle}>対象会場 {venueName}</span>
						<span style={chipStyle}>対象R {raceRangeLabel}</span>
						{rangeTimeKind ? <span style={chipStyle}>コピー範囲時間帯 {rangeTimeKind}</span> : null}
						<span style={chipStyle}>
							生成済み {generatedRaceCount}/{expectedRaceCount}R
						</span>
						<span style={chipStyle}>展示OK {readyRaceCount}R</span>
						<span style={chipStyle}>展示一部 {partialRaceCount}R</span>
						<span style={chipStyle}>展示未取得 {waitingRaceCount + missingRaceLabels.length}R</span>
						<span style={chipStyle}>{charCount.toLocaleString("ja-JP")}文字</span>
						<span style={chipStyle}>{lineCount.toLocaleString("ja-JP")}行</span>
						{includesExContext ? <span style={chipStyle}>EX分析入り</span> : null}
						{exReferenceRaceCount > 0 ? <span style={chipStyle}>レースごとEX参照情報を含む {exReferenceRaceCount}R</span> : null}
						{sourceBackedExReferenceCount > 0 ? <span style={chipStyle}>EX参照情報 source-backed {sourceBackedExReferenceCount}R</span> : null}
						{isExhibitionWaiting ? (
							<span style={warningChipStyle}>展示未完了の事前予想素材を含みます</span>
						) : null}
					</div>
				</div>
				<div style={actionRowStyle}>
					<button type="button" style={primaryButtonStyle} onClick={handleCopy}>
						{raceRangeLabel}まとめコピー{includesExContext ? "（EX分析入り）" : ""}
					</button>
					<button type="button" style={secondaryButtonStyle} onClick={handleDownload}>
						TXTダウンロード
					</button>
				</div>
			</div>
			{statusText ? <p style={helperStyle}>{statusText}</p> : null}
			<textarea style={textareaStyle} readOnly value={materialText} />
			<div style={footerGridStyle}>
				{[
					{ label: "対象日", value: dateLabel },
					{ label: "対象会場", value: venueName },
					{ label: "対象レース範囲", value: raceRangeLabel },
					{ label: "コピー範囲時間帯", value: rangeTimeKind ?? "-" },
					{ label: "EX参照情報", value: exReferenceRaceCount > 0 ? `${exReferenceRaceCount}R / source-backed ${sourceBackedExReferenceCount}R` : "未取得" },
					{ label: "生成済みレース数", value: `${generatedRaceCount}/${expectedRaceCount}R` },
					{ label: "展示タイム取得状況", value: `OK ${readyRaceCount}R / 一部 ${partialRaceCount}R / 未取得 ${waitingRaceCount + missingRaceLabels.length}R` },
					{ label: "未取得注記", value: missingRaceLabels.length > 0 ? `${missingRaceLabels.join(", ")} は未取得` : "未取得Rなし" },
					{ label: "文字数", value: `${charCount.toLocaleString("ja-JP")}文字` },
					{ label: "行数", value: `${lineCount.toLocaleString("ja-JP")}行` },
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
