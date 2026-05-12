import type { ChangeEvent } from "react";
import { boatTheme } from "../../lib/theme";

type BoatPredictionMemoProps = {
	value: string;
	onChange: (value: string) => void;
};

const wrapStyle = {
	display: "grid",
	gap: "10px",
};

const titleStyle = {
	margin: 0,
	fontSize: "1rem",
	color: boatTheme.colors.navy,
};

const textareaStyle = {
	width: "100%",
	minHeight: "220px",
	padding: "16px 18px",
	borderRadius: "20px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.96)",
	color: boatTheme.colors.navy,
	lineHeight: 1.8,
	fontSize: "0.96rem",
	resize: "vertical" as const,
	boxSizing: "border-box" as const,
	outline: "none",
};

const placeholderText = `進入：
展示気配：
スタート：
本命：
相手：
穴：
メモ：`;

export function BoatPredictionMemo({ value, onChange }: BoatPredictionMemoProps) {
	const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		onChange(event.target.value);
	};

	return (
		<section style={wrapStyle}>
			<h4 style={titleStyle}>予想メモ</h4>
			<textarea style={textareaStyle} value={value} onChange={handleChange} placeholder={placeholderText} />
		</section>
	);
}