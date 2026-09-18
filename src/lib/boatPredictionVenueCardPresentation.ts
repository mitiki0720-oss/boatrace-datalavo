import type { CSSProperties } from "react";
import type { BoatPredictionVenueTimeKind } from "./boatPredictionGptCopy";

export type BoatPredictionSessionTone = {
	background: string;
	border: string;
	shadow: string;
	badgeBackground: string;
	badgeColor: string;
	badgeBorder: string;
	topLine: string;
};

export type BoatPredictionVenueSortValue<T> = {
	venue: T;
	index: number;
	session: BoatPredictionVenueTimeKind | string;
	firstRaceMinutes: number | null;
	venueName: string;
};

export const compareBoatPredictionVenueCards = <T,>(
	left: BoatPredictionVenueSortValue<T>,
	right: BoatPredictionVenueSortValue<T>,
): number => {
	if (left.firstRaceMinutes !== null && right.firstRaceMinutes !== null) {
		const timeDiff = left.firstRaceMinutes - right.firstRaceMinutes;
		if (timeDiff !== 0) return timeDiff;
	} else if (left.firstRaceMinutes !== null) {
		return -1;
	} else if (right.firstRaceMinutes !== null) {
		return 1;
	}

	const venueNameDiff = left.venueName.localeCompare(right.venueName, "ja", {
		numeric: true,
		sensitivity: "base",
	});
	return venueNameDiff !== 0 ? venueNameDiff : left.index - right.index;
};

export const getBoatPredictionSessionTone = (session?: string): BoatPredictionSessionTone => {
	if (session === "morning") {
		return {
			background: "linear-gradient(180deg, rgba(224, 247, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)",
			border: "rgba(8, 145, 178, 0.42)",
			shadow: "0 12px 26px rgba(8, 145, 178, 0.09)",
			badgeBackground: "#0e7490",
			badgeColor: "#ffffff",
			badgeBorder: "#155e75",
			topLine: "linear-gradient(90deg, #06b6d4 0%, #67e8f9 100%)",
		};
	}

	if (session === "day") {
		return {
			background: "linear-gradient(180deg, rgba(220, 252, 231, 0.98) 0%, rgba(250, 255, 252, 0.98) 100%)",
			border: "rgba(4, 120, 87, 0.44)",
			shadow: "0 12px 26px rgba(4, 120, 87, 0.1)",
			badgeBackground: "#047857",
			badgeColor: "#ffffff",
			badgeBorder: "#065f46",
			topLine: "linear-gradient(90deg, #10b981 0%, #6ee7b7 100%)",
		};
	}

	if (session === "summer") {
		return {
			background: "linear-gradient(180deg, rgba(254, 249, 195, 0.98) 0%, rgba(255, 253, 242, 0.98) 100%)",
			border: "rgba(180, 83, 9, 0.42)",
			shadow: "0 12px 26px rgba(180, 83, 9, 0.1)",
			badgeBackground: "#b45309",
			badgeColor: "#ffffff",
			badgeBorder: "#92400e",
			topLine: "linear-gradient(90deg, #f59e0b 0%, #fcd34d 100%)",
		};
	}

	if (session === "night") {
		return {
			background: "linear-gradient(180deg, rgba(219, 234, 254, 0.98) 0%, rgba(245, 249, 255, 0.98) 100%)",
			border: "rgba(30, 58, 138, 0.44)",
			shadow: "0 12px 26px rgba(30, 58, 138, 0.12)",
			badgeBackground: "#1e3a8a",
			badgeColor: "#ffffff",
			badgeBorder: "#172554",
			topLine: "linear-gradient(90deg, #1e3a8a 0%, #60a5fa 100%)",
		};
	}

	if (session === "midnight") {
		return {
			background: "linear-gradient(180deg, rgba(237, 233, 254, 0.98) 0%, rgba(248, 245, 255, 0.98) 100%)",
			border: "rgba(76, 29, 149, 0.46)",
			shadow: "0 12px 28px rgba(49, 46, 129, 0.14)",
			badgeBackground: "#4c1d95",
			badgeColor: "#ffffff",
			badgeBorder: "#2e1065",
			topLine: "linear-gradient(90deg, #111827 0%, #4c1d95 54%, #8b5cf6 100%)",
		};
	}

	return {
		background: "rgba(248, 250, 252, 0.98)",
		border: "rgba(100, 116, 139, 0.46)",
		shadow: "0 12px 26px rgba(15, 23, 42, 0.07)",
		badgeBackground: "#475569",
		badgeColor: "#ffffff",
		badgeBorder: "#334155",
		topLine: "linear-gradient(90deg, #64748b 0%, #cbd5e1 100%)",
	};
};
