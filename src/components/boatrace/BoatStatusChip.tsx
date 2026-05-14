import type {
	BoatRaceSession,
	BoatRaceStatus,
	BoatResultStatus,
} from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type BoatDisplayValue = BoatRaceSession | BoatRaceStatus | BoatResultStatus;

type BoatStatusChipProps = {
	value?: BoatDisplayValue;
	children?: string;
};

const chipStyle = {
	padding: "6px 10px",
	borderRadius: "999px",
	background: "rgba(221, 242, 248, 0.95)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.82rem",
	fontWeight: 700,
};

const labelMap: Record<BoatDisplayValue, string> = {
	day: "デイ",
	night: "ナイター",
	morning: "モーニング",
	relay: "ルーキー/シリーズ",
	unknown: "未設定",
	scheduled: "予定",
	exhibition: "展示中",
	selling: "発売中",
	closed: "締切",
	finished: "終了",
	canceled: "中止",
	pending: "pending",
	confirmed: "confirmed",
	unavailable: "unavailable",
	empty: "empty",
};

export const getBoatDisplayLabel = (value?: BoatDisplayValue) => {
	if (!value) {
		return "-";
	}

	return labelMap[value] ?? value;
};

export function BoatStatusChip({ value, children }: BoatStatusChipProps) {
	return <span style={chipStyle}>{children ?? getBoatDisplayLabel(value)}</span>;
}