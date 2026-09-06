import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BoatPredictionGptCopyExReferenceLevel } from "../../lib/boatPredictionGptCopyExContext";
import { formatBoatPredictionSessionLabel, type BoatPredictionVenueTimeKind } from "../../lib/boatPredictionGptCopy";
import { copyBoatPredictionRangePreset } from "../../lib/boatPredictionRangeClipboard";
import { boatTheme } from "../../lib/theme";

type BoatGptMaterialRangePreset = {
	key: string;
	label: string;
	materialText: string;
	generatedRaceCount: number;
	includesExContext?: boolean;
};

type BoatGptBulkMaterialPanelProps = {
	materialText: string;
	singleRaceMaterialText: string;
	selectedRaceLabel: string;
	venueName: string;
	dateLabel: string;
	rawRaceCount: number;
	raceRangeLabel: string;
	rangeTimeKind?: BoatPredictionVenueTimeKind;
	generatedRaceCount: number;
	expectedRaceCount: number;
	readyRaceCount?: number;
	partialRaceCount?: number;
	waitingRaceCount?: number;
	missingRaceLabels?: string[];
	activeRangeKey: string;
	rangePresets: BoatGptMaterialRangePreset[];
	onSelectRange: (key: string) => void;
	onExportJson: () => void;
	onCopyJson: () => void;
	savedPredictionCount: number;
	johnsonizedCount: number;
	pendingJohnsonCount: number;
	includesExContext?: boolean;
	exReferenceLevelCounts?: Partial<Record<BoatPredictionGptCopyExReferenceLevel, number>>;
};

const panelStyle: CSSProperties = {
	display: "grid",
	gap: "16px",
	padding: "22px",
	borderRadius: "24px",
	background: "rgba(255, 255, 255, 0.97)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
	minWidth: 0,
};

const eyebrowStyle: CSSProperties = {
	margin: 0,
	fontSize: "0.7rem",
	fontWeight: 900,
	letterSpacing: "0.14em",
	color: boatTheme.colors.aquaDeep,
	textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
	margin: 0,
	fontSize: "1.32rem",
	lineHeight: 1.25,
	color: boatTheme.colors.navy,
};

const descriptionStyle: CSSProperties = {
	margin: 0,
	fontSize: "0.84rem",
	lineHeight: 1.7,
	color: boatTheme.colors.muted,
};

const summaryGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
	gap: "8px",
};

const summaryItemStyle: CSSProperties = {
	display: "grid",
	gap: "4px",
	padding: "11px 12px",
	borderRadius: "14px",
	background: "rgba(247, 252, 255, 0.92)",
	border: `1px solid ${boatTheme.colors.line}`,
	minWidth: 0,
};

const summaryLabelStyle: CSSProperties = {
	fontSize: "0.68rem",
	fontWeight: 900,
	color: boatTheme.colors.aquaDeep,
};

const summaryValueStyle: CSSProperties = {
	fontSize: "0.9rem",
	fontWeight: 900,
	lineHeight: 1.35,
	color: boatTheme.colors.navy,
	overflowWrap: "anywhere",
};

const sectionStyle: CSSProperties = {
	display: "grid",
	gap: "10px",
	paddingTop: "14px",
	borderTop: `1px solid ${boatTheme.colors.line}`,
};

const rangeButtonStyle: CSSProperties = {
	width: "100%",
	minHeight: "46px",
	padding: "11px 14px",
	borderRadius: "14px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.98)",
	color: boatTheme.colors.navy,
	fontSize: "0.84rem",
	fontWeight: 900,
	cursor: "pointer",
	textAlign: "left",
};

const activeRangeButtonStyle: CSSProperties = {
	...rangeButtonStyle,
	border: "1px solid rgba(18, 52, 79, 0.12)",
	background: "#183a59",
	color: "#ffffff",
	boxShadow: "0 12px 24px rgba(24, 58, 89, 0.16)",
};

const actionButtonStyle: CSSProperties = {
	minHeight: "42px",
	padding: "10px 14px",
	borderRadius: "14px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.98)",
	color: boatTheme.colors.navy,
	fontSize: "0.8rem",
	fontWeight: 900,
	cursor: "pointer",
};

const primaryActionStyle: CSSProperties = {
	...actionButtonStyle,
	border: "1px solid rgba(18, 52, 79, 0.08)",
	background: "linear-gradient(135deg, #12344f 0%, #1e5778 100%)",
	color: "#ffffff",
};

const disabledActionStyle: CSSProperties = {
	...primaryActionStyle,
	cursor: "not-allowed",
	opacity: 0.5,
};

const chipStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	width: "fit-content",
	padding: "5px 8px",
	borderRadius: "999px",
	background: "rgba(236, 246, 251, 0.96)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.7rem",
	fontWeight: 800,
};

const sanitizeDownloadName = (value: string): string =>
	value
		.normalize("NFKC")
		.replace(/[\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, "_")
		.trim() || "boat-gpt-material";

export function BoatGptBulkMaterialPanel({
	materialText,
	singleRaceMaterialText,
	selectedRaceLabel,
	venueName,
	dateLabel,
	rawRaceCount,
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
	onExportJson,
	onCopyJson,
	savedPredictionCount,
	johnsonizedCount,
	pendingJohnsonCount,
	includesExContext = false,
	exReferenceLevelCounts,
}: BoatGptBulkMaterialPanelProps) {
	const [statusText, setStatusText] = useState("");
	const statusTimerRef = useRef<number | null>(null);
	const exportAvailable = savedPredictionCount > 0;
	const exReferenceRaceCount = Object.values(exReferenceLevelCounts ?? {}).reduce(
		(total, count) => total + (count ?? 0),
		0,
	);
	const materialStatusLabel = generatedRaceCount === expectedRaceCount && expectedRaceCount > 0
		? `完全 ${generatedRaceCount}/${expectedRaceCount}R`
		: generatedRaceCount > 0
			? `一部取得 ${generatedRaceCount}/${expectedRaceCount}R`
			: expectedRaceCount > 0
				? `取得待ち 0/${expectedRaceCount}R`
				: "対象なし";

	useEffect(() => () => {
		if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
	}, []);

	const showStatus = (message: string) => {
		if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current);
		setStatusText(message);
		statusTimerRef.current = window.setTimeout(() => {
			setStatusText("");
			statusTimerRef.current = null;
		}, 1800);
	};

	const copyMaterial = async (text: string, label: string) => {
		if (!text.trim()) {
			showStatus("コピーできる素材がありません");
			return;
		}

		try {
			await navigator.clipboard.writeText(text);
			showStatus(`${label}をコピーしました`);
		} catch {
			showStatus("コピーに失敗しました");
		}
	};

	const writeClipboardText = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.setAttribute("readonly", "");
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.select();
			const copied = document.execCommand("copy");
			textarea.remove();
			if (!copied) throw new Error("clipboard copy failed");
		}
	};

	const copyRangePreset = async (preset: BoatGptMaterialRangePreset) => {
		try {
			const raceNumbers = await copyBoatPredictionRangePreset(preset, writeClipboardText);
			onSelectRange(preset.key);
			showStatus(`${preset.label}をコピーしました (${raceNumbers.join(", ")}R)`);
		} catch (error) {
			showStatus(error instanceof Error ? error.message : "範囲素材のコピーに失敗しました");
		}
	};

	const downloadCurrentRange = () => {
		if (!materialText.trim()) {
			showStatus("保存できる素材がありません");
			return;
		}

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
			showStatus(`${raceRangeLabel}をTXT保存しました`);
		} catch {
			showStatus("TXT保存に失敗しました");
		}
	};

	return (
		<section className="boat-gpt-compact-material" style={panelStyle}>
			<div style={{ display: "grid", gap: "7px" }}>
				<p style={eyebrowStyle}>GPT Material</p>
				<h3 style={titleStyle}>GPT貼り付け用素材</h3>
				<p style={descriptionStyle}>選択会場の1R〜6R・7R〜12Rを固定6枠でコピーします。未取得Rは取得待ちとして残します。</p>
			</div>

			<div className="boat-gpt-material-summary" style={summaryGridStyle}>
				{[
					["選択会場", venueName],
					["日付", dateLabel],
					["開催レース", `${rawRaceCount}R`],
					["素材状態", materialStatusLabel],
				].map(([label, value]) => (
					<div key={label} style={summaryItemStyle}>
						<span style={summaryLabelStyle}>{label}</span>
						<span style={summaryValueStyle}>{value}</span>
					</div>
				))}
			</div>

			<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
				<span style={chipStyle}>展示OK {readyRaceCount}R</span>
				<span style={chipStyle}>展示一部 {partialRaceCount}R</span>
				<span style={chipStyle}>事前予想 {waitingRaceCount + missingRaceLabels.length}R</span>
				{rangeTimeKind ? <span style={chipStyle}>時間帯 {formatBoatPredictionSessionLabel(rangeTimeKind)}</span> : null}
				{includesExContext ? <span style={chipStyle}>EX分析入り</span> : null}
				{exReferenceRaceCount > 0 ? <span style={chipStyle}>EX参照 {exReferenceRaceCount}R</span> : null}
			</div>

			<div style={sectionStyle}>
				<p style={eyebrowStyle}>Copy Range</p>
				<div className="boat-gpt-material-ranges" style={{ display: "grid", gap: "8px" }}>
					{rangePresets.length > 0 ? rangePresets.map((preset) => {
						const isActive = preset.key === activeRangeKey;
						return (
							<button
								key={preset.key}
								type="button"
								style={isActive ? activeRangeButtonStyle : rangeButtonStyle}
								aria-pressed={isActive}
								onClick={() => {
									void copyRangePreset(preset);
								}}
							>
								{preset.label}をコピー
							</button>
						);
					}) : <p style={descriptionStyle}>この会場にコピー対象のレースがありません。</p>}
				</div>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
					<button type="button" style={actionButtonStyle} onClick={() => void copyMaterial(singleRaceMaterialText, `${selectedRaceLabel}素材`)}>
						選択中Rをコピー
					</button>
					<button type="button" style={actionButtonStyle} onClick={downloadCurrentRange}>
						選択範囲TXT
					</button>
				</div>
			</div>

			<div style={sectionStyle}>
				<p style={eyebrowStyle}>Prediction Export</p>
				<div>
					<h4 style={{ ...titleStyle, fontSize: "1rem" }}>当日予想JSONを書き出す</h4>
					<p style={{ ...descriptionStyle, marginTop: "5px" }}>
						保存済み {savedPredictionCount}R / ジョンソン化済み {johnsonizedCount}R / 未変換 {pendingJohnsonCount}R
					</p>
				</div>
				<button type="button" style={exportAvailable ? primaryActionStyle : disabledActionStyle} onClick={onExportJson} disabled={!exportAvailable}>
					当日予想JSONを書き出す
				</button>
				<button type="button" style={actionButtonStyle} onClick={onCopyJson} disabled={!exportAvailable}>
					JSONをコピー
				</button>
				{!exportAvailable ? <p style={descriptionStyle}>当日の保存済み予想がありません。</p> : null}
			</div>

			{statusText ? <p role="status" style={{ ...descriptionStyle, color: boatTheme.colors.aquaDeep, fontWeight: 900 }}>{statusText}</p> : null}
		</section>
	);
}
