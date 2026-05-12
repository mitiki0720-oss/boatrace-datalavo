import { boatTheme } from "../lib/theme";

const panelStyle = {
	borderRadius: "28px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.88)",
	boxShadow: boatTheme.shadow.soft,
};

const mobileCards = [
	{
		title: "Today Summary",
		detail: "今日の開催場とセッションをスマホ向けに絞り込んで見せる予定です。",
	},
	{
		title: "Prediction Log",
		detail: "展示評価や買い目メモを縦スクロールで追いやすい形に整理します。",
	},
	{
		title: "Result Review",
		detail: "結果比較と振り返りカードを、後で片手操作しやすいUIへ拡張します。",
	},
];

export function MobilePage() {
	return (
		<div style={{ display: "grid", gap: "20px" }}>
			<section
				style={{
					...panelStyle,
					padding: "28px",
					background:
						"linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(223, 245, 255, 0.94) 55%, rgba(139, 225, 208, 0.28) 100%)",
				}}
			>
				<p
					style={{
						margin: 0,
						fontSize: "0.8rem",
						letterSpacing: "0.16em",
						textTransform: "uppercase",
						fontWeight: 800,
						color: boatTheme.colors.aquaDeep,
					}}
				>
					Mobile View
				</p>
				<h2 style={{ margin: "12px 0 0", fontSize: "clamp(1.9rem, 4vw, 2.8rem)", color: boatTheme.colors.navy }}>
					Mobile View
				</h2>
				<p style={{ margin: "12px 0 0", color: boatTheme.colors.muted, lineHeight: 1.8 }}>
					スマホで見やすい競艇データビューは後で作成します。
				</p>
			</section>

			<section
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
					gap: "16px",
				}}
			>
				{mobileCards.map((card) => (
					<article key={card.title} style={{ ...panelStyle, padding: "20px" }}>
						<h3 style={{ margin: 0, fontSize: "1.1rem", color: boatTheme.colors.navy }}>{card.title}</h3>
						<p style={{ margin: "12px 0 0", color: boatTheme.colors.muted, lineHeight: 1.75 }}>{card.detail}</p>
					</article>
				))}
			</section>
		</div>
	);
}
