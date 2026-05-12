import { BOAT_FRAME_COLORS } from "../../lib/boatraceTypes";
import { boatTheme } from "../../lib/theme";

type OddsItem = {
	combination?: string;
	odds?: string;
	popularity?: number;
};

type ExtendedOddsPreview = {
	trifectaTop?: OddsItem[];
	exactaTop?: OddsItem[];
	quinellaTop?: OddsItem[];
	trifectaAll?: OddsItem[];
	exactaAll?: OddsItem[];
	quinellaAll?: OddsItem[];
	updatedAt?: string | null;
};

type BoatOddsPreviewProps = {
	odds: unknown;
};

const sectionStyle = {
	display: "grid",
	gap: "12px",
};

const titleWrapStyle = {
	display: "grid",
	gap: "4px",
};

const titleStyle = {
	margin: 0,
	fontSize: "1.04rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const descriptionStyle = {
	margin: 0,
	fontSize: "0.84rem",
	lineHeight: 1.5,
	color: boatTheme.colors.muted,
};

const scrollWrapStyle = {
	overflowX: "auto" as const,
	borderRadius: "22px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.96)",
	boxShadow: "0 14px 30px rgba(17, 64, 92, 0.06)",
};

const trifectaGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(6, minmax(188px, 1fr))",
	minWidth: "1180px",
};

const firstBlockStyle = {
	borderRight: `1px solid ${boatTheme.colors.line}`,
	background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,252,255,0.94))",
};

const firstHeaderStyle = {
	display: "grid",
	gridTemplateColumns: "40px 1fr",
	alignItems: "center",
	gap: "8px",
	padding: "10px",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const frameBadgeBaseStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "32px",
	height: "32px",
	borderRadius: "10px",
	fontSize: "0.86rem",
	fontWeight: 800,
};

const comboRowStyle = {
	display: "grid",
	gridTemplateColumns: "34px 34px 1fr",
	alignItems: "stretch",
	minHeight: "30px",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
};

const secondCellStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	color: "#ffffff",
	fontWeight: 800,
	fontSize: "0.82rem",
};

const thirdCellStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background: "rgba(233, 241, 246, 0.88)",
	color: boatTheme.colors.navy,
	fontWeight: 800,
	fontSize: "0.82rem",
};

const oddsCellStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	padding: "0 9px",
	color: boatTheme.colors.navy,
	fontSize: "0.86rem",
	fontVariantNumeric: "tabular-nums" as const,
};

const pairSectionGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
	gap: "16px",
	alignItems: "start" as const,
};

const pairPanelStyle = {
	display: "grid",
	gap: "14px",
	padding: "18px",
	borderRadius: "24px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(243, 250, 255, 0.93))",
	boxShadow: "0 14px 30px rgba(17, 64, 92, 0.06)",
};

const pairPanelHeaderStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
	flexWrap: "wrap" as const,
};

const pairPanelTitleWrapStyle = {
	display: "grid",
	gap: "3px",
};

const pairPanelTitleStyle = {
	margin: 0,
	fontSize: "0.98rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const pairPanelDescriptionStyle = {
	margin: 0,
	fontSize: "0.79rem",
	lineHeight: 1.5,
	color: boatTheme.colors.muted,
};

const pairCountBadgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "6px 10px",
	borderRadius: "999px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(230, 244, 250, 0.95)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.76rem",
	fontWeight: 800,
	whiteSpace: "nowrap" as const,
};

const pairListGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
	gap: "10px",
	alignItems: "start" as const,
};

const pairRowCardStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "12px",
	padding: "13px 14px",
	borderRadius: "16px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 252, 255, 0.95))",
	boxShadow: "0 8px 20px rgba(17, 64, 92, 0.04)",
};

const pairRowLeftStyle = {
	display: "grid",
	gap: "2px",
};

const pairRowLabelStyle = {
	margin: 0,
	fontSize: "0.72rem",
	fontWeight: 700,
	letterSpacing: "0.04em",
	color: boatTheme.colors.muted,
};

const pairRowCombinationStyle = {
	margin: 0,
	fontSize: "1rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
	lineHeight: 1.2,
};

const pairRowRightStyle = {
	display: "grid",
	justifyItems: "end" as const,
	gap: "2px",
};

const pairRowOddsLabelStyle = {
	margin: 0,
	fontSize: "0.72rem",
	fontWeight: 700,
	letterSpacing: "0.04em",
	color: boatTheme.colors.muted,
};

const pairRowOddsValueStyle = {
	margin: 0,
	fontSize: "1.02rem",
	fontWeight: 800,
	color: boatTheme.colors.aquaDeep,
	lineHeight: 1.2,
};

const miniPanelStyle = {
	display: "grid",
	gap: "10px",
	padding: "16px",
	borderRadius: "22px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.92)",
};

const miniTitleStyle = {
	margin: 0,
	fontSize: "0.92rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
};

const emptyStyle = {
	margin: 0,
	padding: "16px",
	borderRadius: "18px",
	background: "rgba(247, 252, 255, 0.96)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.muted,
	lineHeight: 1.7,
};

const frameTextColor = (frameNo: number) => {
	if (frameNo === 1 || frameNo === 5) {
		return "#1b2430";
	}

	return "#ffffff";
};

const getFrameBadgeStyle = (frameNo: number) => ({
	...frameBadgeBaseStyle,
	background: BOAT_FRAME_COLORS[frameNo as 1 | 2 | 3 | 4 | 5 | 6] ?? boatTheme.colors.aquaDeep,
	color: frameTextColor(frameNo),
	border: frameNo === 1 ? `1px solid ${boatTheme.colors.line}` : "none",
});

const getSecondCellStyle = (frameNo: number) => ({
	...secondCellStyle,
	background: BOAT_FRAME_COLORS[frameNo as 1 | 2 | 3 | 4 | 5 | 6] ?? boatTheme.colors.aquaDeep,
	color: frameTextColor(frameNo),
});

function normalizeOddsObject(value: unknown): ExtendedOddsPreview {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	return value as ExtendedOddsPreview;
}

function normalizeItems(items: unknown): OddsItem[] {
	if (!Array.isArray(items)) {
		return [];
	}

	return items.filter((item): item is OddsItem => {
		if (!item || typeof item !== "object") {
			return false;
		}

		const candidate = item as OddsItem;
		return typeof candidate.combination === "string" && typeof candidate.odds === "string";
	});
}

function getOddsNumber(value?: string) {
	if (!value) {
		return Number.POSITIVE_INFINITY;
	}

	const numeric = Number.parseFloat(value.replace(/,/g, ""));
	return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

function sortOddsItems(items: OddsItem[]) {
	return [...items].sort((left, right) => getOddsNumber(left.odds) - getOddsNumber(right.odds));
}

function parseTrifectaCombination(combination?: string) {
	const parts = String(combination ?? "").split("-").map((value) => value.trim());

	if (parts.length !== 3 || parts.some((value) => !/^[1-6]$/.test(value))) {
		return null;
	}

	return {
		first: Number(parts[0]),
		second: Number(parts[1]),
		third: Number(parts[2]),
	};
}

function createTrifectaLookup(items: OddsItem[]) {
	const lookup = new Map<string, OddsItem>();

	for (const item of items) {
		const parsed = parseTrifectaCombination(item.combination);
		if (!parsed) {
			continue;
		}

		lookup.set(`${parsed.first}-${parsed.second}-${parsed.third}`, item);
	}

	return lookup;
}

function renderTrifectaFullTable(items: OddsItem[]) {
	const lookup = createTrifectaLookup(items);

	if (!lookup.size) {
		return <p style={emptyStyle}>3連単の全オッズはまだ generated JSON に入っていません。</p>;
	}

	return (
		<div style={scrollWrapStyle}>
			<div style={trifectaGridStyle}>
				{[1, 2, 3, 4, 5, 6].map((first) => (
					<div key={first} style={firstBlockStyle}>
						<div style={firstHeaderStyle}>
							<span style={getFrameBadgeStyle(first)}>{first}</span>
							<span>1着 {first}</span>
						</div>

						{[1, 2, 3, 4, 5, 6]
							.filter((second) => second !== first)
							.flatMap((second) =>
								[1, 2, 3, 4, 5, 6]
									.filter((third) => third !== first && third !== second)
									.map((third, thirdIndex) => {
										const item = lookup.get(`${first}-${second}-${third}`);

										return (
											<div key={`${first}-${second}-${third}`} style={comboRowStyle}>
												{thirdIndex === 0 ? (
													<div style={getSecondCellStyle(second)}>
														{second}
													</div>
												) : (
													<div style={getSecondCellStyle(second)} />
												)}
												<div style={thirdCellStyle}>{third}</div>
												<div style={oddsCellStyle}>{item?.odds ?? "-"}</div>
											</div>
										);
									}),
							)}
					</div>
				))}
			</div>
		</div>
	);
}

function renderPairOdds(title: string, items: OddsItem[], emptyText: string) {
	const sortedItems = sortOddsItems(items);

	return (
		<section style={pairPanelStyle}>
			<div style={pairPanelHeaderStyle}>
				<div style={pairPanelTitleWrapStyle}>
					<h5 style={pairPanelTitleStyle}>{title}</h5>
					<p style={pairPanelDescriptionStyle}>
						オッズを見やすく並べて、比較しやすいカード表示にしています。
					</p>
				</div>
				<span style={pairCountBadgeStyle}>{sortedItems.length}件</span>
			</div>

			{sortedItems.length ? (
				<div style={pairListGridStyle}>
					{sortedItems.map((item) => (
						<article key={`${title}-${item.combination}`} style={pairRowCardStyle}>
							<div style={pairRowLeftStyle}>
								<p style={pairRowLabelStyle}>組み合わせ</p>
								<p style={pairRowCombinationStyle}>{item.combination}</p>
							</div>

							<div style={pairRowRightStyle}>
								<p style={pairRowOddsLabelStyle}>オッズ</p>
								<p style={pairRowOddsValueStyle}>{item.odds}</p>
							</div>
						</article>
					))}
				</div>
			) : (
				<p style={emptyStyle}>{emptyText}</p>
			)}
		</section>
	);
}

export function BoatOddsPreview({ odds }: BoatOddsPreviewProps) {
	const oddsObject = normalizeOddsObject(odds);
	const trifectaAll = normalizeItems(oddsObject.trifectaAll);
	const exactaAll = normalizeItems(oddsObject.exactaAll);
	const quinellaAll = normalizeItems(oddsObject.quinellaAll);

	const fallbackTrifectaTop = normalizeItems(oddsObject.trifectaTop);
	const fallbackExactaTop = normalizeItems(oddsObject.exactaTop);
	const fallbackQuinellaTop = normalizeItems(oddsObject.quinellaTop);

	const displayTrifecta = trifectaAll.length ? trifectaAll : fallbackTrifectaTop;
	const displayExacta = exactaAll.length ? exactaAll : fallbackExactaTop;
	const displayQuinella = quinellaAll.length ? quinellaAll : fallbackQuinellaTop;
	const showPairOdds = false as boolean;

	return (
		<section style={sectionStyle}>
			<div style={titleWrapStyle}>
				<h4 style={titleStyle}>オッズ</h4>
				<p style={descriptionStyle}>
					公式オッズに近い形で、3連単の全組み合わせを確認できます。2連単・2連複はデータ保持のみで画面表示は省略しています。
				</p>
				{oddsObject.updatedAt ? (
					<p style={descriptionStyle}>更新時刻：{oddsObject.updatedAt}</p>
				) : null}
			</div>

			<div style={miniPanelStyle}>
				<h5 style={miniTitleStyle}>3連単オッズ</h5>
				{renderTrifectaFullTable(displayTrifecta)}
			</div>

			{showPairOdds ? (
				<div style={pairSectionGridStyle}>
				{renderPairOdds("2連単", displayExacta, "2連単オッズはまだ generated JSON に入っていません。")}
				{renderPairOdds("2連複", displayQuinella, "2連複オッズはまだ generated JSON に入っていません。")}
			</div>
			) : null}
		</section>
	);
}