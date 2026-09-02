import { PageShell } from "../components/layout/PageShell";
import { boatTheme } from "../lib/theme";

const panelStyle = {
	display: "grid",
	gap: "12px",
	padding: "18px",
	borderRadius: "8px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.94)",
	boxShadow: boatTheme.shadow.soft,
};

const metricGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
	gap: "12px",
};

const sectionGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
	gap: "12px",
};

const labelStyle = {
	margin: 0,
	fontSize: "0.76rem",
	fontWeight: 800,
	letterSpacing: "0.08em",
	color: boatTheme.colors.aquaDeep,
	textTransform: "uppercase" as const,
};

const valueStyle = {
	margin: 0,
	fontSize: "1.35rem",
	fontWeight: 850,
	color: boatTheme.colors.navy,
};

const textStyle = {
	margin: 0,
	lineHeight: 1.7,
	color: boatTheme.colors.muted,
};

const monthlySections = [
	["外れ方分析", "結果確定後に、軸・相手・3着保護のどこで外れたかを整理します。"],
	["10点役割分析", "厚め・本線・中穴・大穴の役割別結果を確認します。"],
	["会場別", "会場特徴ノートとEX会場傾向を月単位で照合します。"],
	["時間帯別", "モーニング・デイ・ナイターなどの時間帯差を確認します。"],
	["EX照合", "会場傾向、天候・水面、当日フローと結果を照合します。"],
	["次月改善ルール", "source-backedな振り返りから次月の確認ルールを整理します。"],
	["GPT MATERIAL PREVIEW", "翌月のPrediction GPT素材へ渡す改善ルールを確認します。"],
	["RAW REPORT", "月次レポートの原文と出典を確認します。"],
] as const;

export function BoatMonthlyReviewPage() {
	return (
		<PageShell
			eyebrow="MONTHLY RETROSPECTIVE"
			title="月次振り返り・予想改善ラボ"
			description="1か月の予想・結果・EX分析を振り返り、外れ方と的中パターンを分析し、翌月のPrediction GPT素材へ改善ルールを反映します。"
		>
			<section style={{ ...panelStyle, background: boatTheme.background.highlight }} aria-label="月次レポート状態">
				<p style={labelStyle}>Status</p>
				<p style={valueStyle}>月次レポート 未登録 / 準備中</p>
				<p style={textStyle}>確定結果と保存済み予想を月単位で照合するデータ契約は次フェーズで接続します。</p>
			</section>

			<section style={metricGridStyle} aria-label="月次指標">
				{["対象月", "確定予想R", "3連単的中率", "回収率"].map((label) => (
					<article key={label} style={panelStyle}>
						<p style={labelStyle}>{label}</p>
						<p style={valueStyle}>未登録</p>
					</article>
				))}
			</section>

			<section style={{ ...panelStyle, borderLeft: `4px solid ${boatTheme.colors.aquaDeep}` }} aria-label="BOAT買い目契約">
				<p style={labelStyle}>BOAT TICKET CONTRACT</p>
				<p style={valueStyle}>3連単10点固定</p>
				<p style={textStyle}>厚め2点 / 本線3点 / 中穴3点 / 大穴2点。2連単は使わない。</p>
			</section>

			<section style={sectionGridStyle} aria-label="月次分析セクション">
				{monthlySections.map(([title, description]) => (
					<article key={title} style={panelStyle}>
						<p style={labelStyle}>準備中</p>
						<h3 style={{ ...valueStyle, fontSize: "1rem" }}>{title}</h3>
						<p style={textStyle}>{description}</p>
					</article>
				))}
			</section>
		</PageShell>
	);
}
