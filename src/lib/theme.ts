export const BOATRACE_STORAGE_PREFIX = "kurari-boat-data-labo-";

export const boatTheme = {
	brandName: "KURARI BOAT DATA LAVO",
	mascotName: "ふな子",
	tokens: ["透明感", "分析ノート", "アクアブルー", "ミント", "ネイビー"],
	colors: {
		navy: "#12324a",
		ink: "#17384c",
		muted: "#4f7084",
		aquaDeep: "#187398",
		aqua: "#5dc7e8",
		mint: "#8be1d0",
		sky: "#dff5ff",
		foam: "#f7fdff",
		line: "rgba(24, 87, 122, 0.14)",
		glow: "rgba(93, 199, 232, 0.24)",
	},
	background: {
		canvas:
			"radial-gradient(circle at top left, rgba(139, 225, 208, 0.25), transparent 28%), linear-gradient(180deg, #f8fdff 0%, #eef8fc 45%, #f9fdff 100%)",
		hero:
			"linear-gradient(145deg, rgba(255, 255, 255, 0.9) 0%, rgba(223, 245, 255, 0.94) 55%, rgba(139, 225, 208, 0.34) 100%)",
		panel: "rgba(255, 255, 255, 0.86)",
		subtle: "linear-gradient(180deg, rgba(244, 252, 255, 0.92), rgba(231, 247, 251, 0.92))",
		highlight: "linear-gradient(180deg, rgba(223, 245, 255, 0.92), rgba(255, 255, 255, 0.96))",
	},
	shadow: {
		soft: "0 24px 60px rgba(17, 64, 92, 0.08)",
	},
} as const;

export type BoatTheme = typeof boatTheme;
