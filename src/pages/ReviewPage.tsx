import { useMemo } from "react";
import { FeatureCard } from "../components/common/FeatureCard";
import { BoatReviewRaceCard } from "../components/boatrace/BoatReviewRaceCard";
import { BoatReviewSummary } from "../components/boatrace/BoatReviewSummary";
import { SectionCard } from "../components/common/SectionCard";
import { PageShell } from "../components/layout/PageShell";
import { judgeBoatPredictionHit } from "../lib/boatHitJudge";
import { loadBoatPredictionRecords } from "../lib/boatPredictionStorage";
import { loadBoatPracticeResultRecords } from "../lib/boatPracticeResultStorage";

const cards = [
	{
		icon: "🎯",
		title: "的中ログ",
		description: "的中・不的中の履歴をレースごとに確認します。",
	},
	{
		icon: "📊",
		title: "収支",
		description: "投資・払戻・回収率を日別に整理します。",
	},
	{
		icon: "💡",
		title: "反省メモ",
		description: "展示や進入の読み違いを次回に活かします。",
	},
 ] as const;

const gridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: "18px",
};

const reviewSectionStyle = {
	display: "grid",
	gap: "22px",
};

const reviewListStyle = {
	display: "grid",
	gap: "18px",
};

const emptyStateStyle = {
	margin: 0,
	padding: "22px 20px",
	borderRadius: "24px",
	background: "rgba(247, 251, 255, 0.9)",
	border: "1px solid rgba(214, 225, 234, 0.85)",
	color: "#5b7284",
	lineHeight: 1.8,
};

export function ReviewPage() {
	const predictionRecords = useMemo(() => loadBoatPredictionRecords(), []);
	const practiceResultRecords = useMemo(() => loadBoatPracticeResultRecords(), []);

	const raceKeys = useMemo(
		() => Array.from(new Set([...Object.keys(predictionRecords), ...Object.keys(practiceResultRecords)]))
			.sort((leftKey, rightKey) => {
				const leftSavedAt = predictionRecords[leftKey]?.savedAt ?? practiceResultRecords[leftKey]?.savedAt ?? "";
				const rightSavedAt = predictionRecords[rightKey]?.savedAt ?? practiceResultRecords[rightKey]?.savedAt ?? "";
				return new Date(rightSavedAt).getTime() - new Date(leftSavedAt).getTime();
			}),
		[predictionRecords, practiceResultRecords],
	);

	const reviewItems = useMemo(
		() => raceKeys.map((raceKey) => {
			const prediction = predictionRecords[raceKey];
			const practiceResult = practiceResultRecords[raceKey];
			const hitResult = judgeBoatPredictionHit({
				tickets: prediction?.tickets ?? [],
				actualFinishOrderText: practiceResult?.actualFinishOrderText,
			});

			return {
				raceKey,
				prediction,
				practiceResult,
				hitResult,
			};
		}),
		[raceKeys, predictionRecords, practiceResultRecords],
	);

	const predictionCount = Object.keys(predictionRecords).length;
	const practiceResultCount = Object.keys(practiceResultRecords).length;
	const totalInvestment = Object.values(practiceResultRecords).reduce((sum, record) => sum + record.investmentAmount, 0);
	const totalPayout = Object.values(practiceResultRecords).reduce((sum, record) => sum + record.payoutAmount, 0);
	const totalProfitLoss = totalPayout - totalInvestment;
	const totalRoi = totalInvestment > 0 ? (totalPayout / totalInvestment) * 100 : 0;
	const hitCount = reviewItems.filter((item) => item.hitResult.status === "hit").length;
	const missCount = reviewItems.filter((item) => item.hitResult.status === "miss").length;
	const pendingCount = reviewItems.filter((item) => item.hitResult.status === "pending").length;

	return (
		<PageShell
			eyebrow="RACE REVIEW"
			title="振り返り"
			description="予想、結果、展示、風、収支をあとから見返すページです。"
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

			<SectionCard
				title="保存済みレビュー"
				description="PredictionPage で保存した予想本文と実践結果を、レース単位でまとめて見返せる最小版です。"
			>
				<div style={reviewSectionStyle}>
					<BoatReviewSummary
						predictionCount={predictionCount}
						practiceResultCount={practiceResultCount}
						totalInvestment={totalInvestment}
						totalPayout={totalPayout}
						totalProfitLoss={totalProfitLoss}
						totalRoi={totalRoi}
						hitCount={hitCount}
						missCount={missCount}
						pendingCount={pendingCount}
					/>

					<div style={reviewListStyle}>
						{reviewItems.length === 0 ? (
							<p style={emptyStateStyle}>まだ保存済みの予想・実践結果はありません。</p>
						) : (
							reviewItems.map((item) => (
								<BoatReviewRaceCard
									key={item.raceKey}
									raceKey={item.raceKey}
									prediction={item.prediction}
									practiceResult={item.practiceResult}
									hitResult={item.hitResult}
								/>
							))
						)}
					</div>
				</div>
			</SectionCard>
		</PageShell>
	);
}