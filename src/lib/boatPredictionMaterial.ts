import type {
	BoatExhibitionItem,
	BoatOddsItem,
	BoatRaceItem,
	BoatRacerItem,
	BoatTodayVenueItem,
} from "./boatraceTypes";

const toMaterialArray = <T,>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, T>);
	}

	return [];
};

const toDisplay = (value: string | number | undefined | null, fallback = "未取得") => {
	if (value === undefined || value === null || value === "") {
		return fallback;
	}

	return String(value);
};

const evaluationMap: Record<string, string> = {
	good: "良",
	normal: "普通",
	bad: "注意",
	unknown: "未評価",
};

const buildRacerBlock = (racer: BoatRacerItem) => {
	const flText = `${racer.fCount ?? "-"}/${racer.lCount ?? "-"}`;

	return [
		`### ${racer.frameNo}号艇 ${racer.name}`,
		`- 支部: ${toDisplay(racer.branch)}`,
		`- 級別: ${toDisplay(racer.class)}`,
		`- 年齢: ${toDisplay(racer.age)}`,
		`- 体重: ${toDisplay(racer.weight)}`,
		`- F/L: ${flText}`,
		`- 平均ST: ${toDisplay(racer.averageStart)}`,
		`- 勝率: ${toDisplay(racer.winRate)}`,
		`- 2連率: ${toDisplay(racer.secondRate)}`,
		`- 3連率: ${toDisplay(racer.thirdRate)}`,
		`- モーター: ${toDisplay(racer.motorNo)}`,
		`- モーター2連率: ${toDisplay(racer.motorSecondRate)}`,
		`- ボート: ${toDisplay(racer.boatMotorNo)}`,
		`- ボート2連率: ${toDisplay(racer.boatSecondRate)}`,
		`- コメント: ${toDisplay(racer.comment)}`,
	].join("\n");
};

const buildExhibitionBlock = (item: BoatExhibitionItem) => [
	`### ${item.frameNo}号艇`,
	`- 展示タイム: ${toDisplay(item.exhibitionTime)}`,
	`- チルト: ${toDisplay(item.tilt)}`,
	`- 展示ST: ${toDisplay(item.startTiming)}`,
	`- 進入: ${toDisplay(item.course)}`,
	`- 評価: ${evaluationMap[item.evaluation ?? "unknown"]}`,
	`- メモ: ${toDisplay(item.memo)}`,
].join("\n");

const buildOddsBlock = (odds: unknown) => {
	const oddsRows = toMaterialArray<BoatOddsItem>(odds);

	if (oddsRows.length === 0) {
		return "オッズサンプルなし";
	}

	return oddsRows
		.map((item) => `- ${item.betType} ${item.combination} ${item.odds}倍 人気:${toDisplay(item.popularity)}`)
		.join("\n");
};

const buildStartExhibitionBlock = (race: BoatRaceItem) => {
	const startExhibition = toMaterialArray<NonNullable<BoatRaceItem["startExhibition"]>[number]>(
		(race as { startExhibition?: unknown }).startExhibition,
	);

	if (startExhibition.length > 0) {
		const slow = startExhibition.filter((item) => Number(item.course) <= 3).map((item) => item.frameNo).join("-") || "未取得";
		const dash = startExhibition.filter((item) => Number(item.course) > 3).map((item) => item.frameNo).join("-") || "未取得";
		const formation = startExhibition.map((item) => item.course).join("-") || "未取得";

		return [
			`進入想定: ${formation}`,
			`スロー候補: ${slow}`,
			`ダッシュ候補: ${dash}`,
			"スタート展示:",
			...startExhibition.map((item) => `- ${item.frameNo}号艇 コース${item.course} ST ${toDisplay(item.startTiming)}`),
		].join("\n");
	}

	const exhibitions = toMaterialArray<BoatExhibitionItem>((race as { exhibitions?: unknown }).exhibitions);

	if (exhibitions.length === 0) {
		return "進入想定: 未取得\nスロー候補: 未取得\nダッシュ候補: 未取得\nスタート展示:\n- 未取得";
	}

	const sorted = [...exhibitions].sort((left, right) => Number(left.course ?? 99) - Number(right.course ?? 99));
	const formation = sorted.map((item) => item.course ?? "-").join("-");
	const slow = sorted.filter((item) => Number(item.course ?? 99) <= 3).map((item) => item.frameNo).join("-") || "未取得";
	const dash = sorted.filter((item) => Number(item.course ?? 99) > 3).map((item) => item.frameNo).join("-") || "未取得";

	return [
		`進入想定: ${formation || "未取得"}`,
		`スロー候補: ${slow}`,
		`ダッシュ候補: ${dash}`,
		"スタート展示:",
		...sorted.map((item) => `- ${item.frameNo}号艇 コース${toDisplay(item.course)} ST ${toDisplay(item.startTiming)}`),
	].join("\n");
};

export function buildBoatPredictionMaterial(params: {
	venue: BoatTodayVenueItem;
	race: BoatRaceItem;
}): string {
	const { venue, race } = params;
	const weather = race.result?.weatherActual ?? venue.weatherActual;
	const racers = toMaterialArray<BoatRacerItem>((race as { racers?: unknown }).racers);
    const exhibitions = toMaterialArray<BoatExhibitionItem>((race as { exhibitions?: unknown }).exhibitions);
    const odds = toMaterialArray<BoatOddsItem>((race as { oddsPreview?: unknown }).oddsPreview);
    const result = race.result;
    const finishOrder = toMaterialArray<string | number>((result as { finishOrder?: unknown } | undefined)?.finishOrder);

	const sections = [
		[
			"[A. レース基本情報]",
			`会場名: ${venue.venueName}`,
			`日付: ${venue.date}`,
			`レース番号: ${race.raceNo}R`,
			`締切予定: ${toDisplay(race.deadlineTime)}`,
			`発走予定: ${toDisplay(race.startTime)}`,
			`レースタイトル: ${toDisplay(race.title)}`,
			`時間帯: ${toDisplay(venue.session, "未設定")}`,
			`race_id: ${toDisplay(race.raceId)}`,
		].join("\n"),
		[
			"[B. 水面 / 会場特徴]",
			"水面特徴: サンプル未登録",
			"イン逃げ傾向: サンプル未登録",
			"まくり・差し傾向: サンプル未登録",
			"風の影響: サンプル未登録",
			"荒れそう度: サンプル未登録",
			"会場メモ: サンプル未登録",
		].join("\n"),
		[
			"[C. 天気 / 風 / 波]",
			`天候: ${toDisplay(weather?.weather)}`,
			`気温: ${toDisplay(weather?.temperature)}`,
			`水温: ${toDisplay(weather?.waterTemperature)}`,
			`風向: ${toDisplay(weather?.windDirection)}`,
			`風速: ${toDisplay(weather?.windSpeed)}`,
			`波高: ${toDisplay(weather?.waveHeight)}`,
			`データソース: ${toDisplay(weather?.source ?? venue.source)}`,
		].join("\n"),
		[
			"[D. 出走表 基本データ]",
			racers.length > 0 ? racers.map((racer) => buildRacerBlock(racer)).join("\n\n") : "出走表サンプルなし",
		].join("\n"),
		[
			"[E. モーター / ボート評価]",
			racers.length > 0
				? racers
						.map(
							(racer) =>
								`- ${racer.frameNo}号艇 モーター${toDisplay(racer.motorNo)} (${toDisplay(racer.motorSecondRate)}) / ボート${toDisplay(racer.boatMotorNo)} (${toDisplay(racer.boatSecondRate)})`,
						)
						.join("\n")
				: "モーター / ボート評価サンプルなし",
		].join("\n"),
		[
			"[F. 展示情報]",
			exhibitions.length > 0 ? exhibitions.map((item) => buildExhibitionBlock(item)).join("\n\n") : "展示情報サンプルなし",
		].join("\n"),
		[
			"[G. 進入 / スタート展示]",
			buildStartExhibitionBlock(race),
		].join("\n"),
		[
			"[H. オッズ]",
			buildOddsBlock(odds),
		].join("\n"),
		[
			"[I. 結果情報]",
			result?.status === "confirmed"
				? [
						`- 結果: ${toDisplay(finishOrder.slice(0, 3).join("-"))}`,
						`- 決まり手: ${toDisplay(result.winningMethod)}`,
						`- 3連単: ${toDisplay(result.payout3tan?.combination)} ${toDisplay(result.payout3tan?.payout)}`,
						`- 2連単: ${toDisplay(result.payout2tan?.combination)} ${toDisplay(result.payout2tan?.payout)}`,
					].join("\n")
				: "結果はまだ確定していません。",
		].join("\n"),
		[
			"[J. GPTへの予想依頼メモ]",
			"この資料をもとに、展示・進入・モーター・ボート・風・波・オッズを総合して競艇予想をしてください。",
			"買い目は合計10点。",
			"3連単は厚め2点、本線6点。",
			"2連単は穴狙い2点。",
			"展開の根拠、危険な人気、穴候補も短く説明してください。",
		].join("\n"),
	];

	return sections.join("\n\n");
}