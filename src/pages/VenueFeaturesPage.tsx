import { FeatureCard } from "../components/common/FeatureCard";
import { SectionCard } from "../components/common/SectionCard";
import { PageShell } from "../components/layout/PageShell";

const cards = [
	{
		icon: "🌊",
		title: "水面特徴",
		description: "場ごとの水面クセやイン有利度を整理します。",
	},
	{
		icon: "🍃",
		title: "風と波",
		description: "風向き・波高・季節差による荒れ方を記録します。",
	},
	{
		icon: "⚙️",
		title: "モーター傾向",
		description: "モーター相場や展示気配の見方を蓄積します。",
	},
 ] as const;

const gridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: "18px",
};

export function VenueFeaturesPage() {
	return (
		<PageShell
			eyebrow="VENUE NOTES"
			title="競艇場メモ"
			description="全国24場の水面特徴・風・イン逃げ傾向を整理します。"
		>
			<SectionCard>
				<div style={gridStyle}>
					{cards.map((card) => (
						<FeatureCard
							key={card.title}
							icon={card.icon}
							title={card.title}
							description={card.description}
						/>
					))}
				</div>
			</SectionCard>
		</PageShell>
	);
}