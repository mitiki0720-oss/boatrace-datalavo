# BOATRACE EX DATA LABO 設計書

作成日: 2026-07-12
対象名: BOATRACE EX DATA LABO / KURARI BOAT EX

## 1. OVERVIEW

BOATRACE EX DATA LABO は、毎日の競艇予想、公式出走表、展示、天候・水面、モーター・ボート、公式結果、払戻、summary、展開メモ、的中/不的中、次回修正点を source-backed data として蓄積し、次回以降の予想精度を上げるための競艇専用データ基盤である。

位置づけは、競輪側で作ってきた KURARI EX / Result Trend Lab の競艇版とする。競艇では「枠」「進入」「展示」「水面」「モーター」「選手」「会場クセ」が結果に強く影響するため、単なる結果保存ではなく、予想時点の根拠と結果後の検証を分けて保存する。

蓄積対象は次の通り。

- 予想前: 出走表、選手、級別、支部、モーター、ボート、オッズ、天候、水面、会場特徴、ユーザー予想、予想時メモ
- 展示後: 展示タイム、スタート展示、進入、チルト、部品交換、周回展示、展示後の評価変更
- 結果後: 着順、決まり手、進入、ST、払戻、返還、気象実績、的中/不的中、収支、summary、次回修正点
- 派生: 会場傾向、荒れ指数、今日の流れ、predictionSignals、予想と結果の差分分析

公式 source と user source は必ず分ける。公式 source は事実データ、user source は予想・メモ・summary・レビューであり、混ぜると「公式に取れていない情報をユーザー推測で補完した」状態になるためである。派生 source は raw official / raw user から生成した分析結果として扱い、生成元と生成日時を持たせる。

## 2. データソース分類

### official source

| source | 現在の主な格納先 | EX への用途 |
| --- | --- | --- |
| BOATRACE公式出走表 | `public/data/boatrace/today.generated.json`, `today-race-details.generated.json` | レース、選手、枠、締切、発走、出走表 coverage |
| BOATRACE公式結果 | `today-race-details.generated.json` の `race.result` | 着順、決まり手、払戻、ST、進入、確定結果 |
| 公式展示情報 | `race.exhibitions`, `race.startExhibition`, `venue-extras.generated.json` の `officialBeforeInfo` | 展示タイム、チルト、進入、展示 ST |
| 公式天候/水面情報 | `weatherActual`, `weatherCondition` | 天候、風向、風速、波高、水温、気温 |
| 公式モーター/ボート情報 | `racers`, `motorSummary`, `entryTable`, 会場 extras | モーター2連率/3連率、ボート2連率/3連率 |
| 会場公式サイト独自データ | `venue-extras.generated.json` | 会場別展示、足色、コメント、水面、得点率、直近成績 |
| 3連単オッズ | `oddsPreview`, `result.finalOdds` | 人気、荒れ予兆、オッズ分布、結果オッズ |
| レース結果/決まり手/進入/ST/払戻 | `race.result` | Result Trend Lab、予想差分、収支、会場傾向 |

### user source

| source | 現在の主な格納先 | EX への用途 |
| --- | --- | --- |
| 予想ファイル/予想本文 | `localStorage` の `kurari-boat-data-labo-prediction-records`, archive txt | 予想根拠、買い目、予想時点スナップショット |
| summary.txt | `public/data/reviews/**`, `ReviewPage` の draft | 日次レビュー、差分学習 |
| 展開予想 | 予想本文、summary、レビュー archive | 展開読みの成否分析 |
| 予想時メモ | prediction record, practice result memo | 判断根拠、次回修正点 |
| GPTレビューsummary | `public/data/reviews/**` または review draft | 予想と結果の解釈 |
| 的中/不的中メモ | `kurari-boat-data-labo-practice-results` | hit/miss、収支、ROI |
| 次回修正点 | summary / practice memo | 改善課題 |

### derived source

| source | 生成元 | EX への用途 |
| --- | --- | --- |
| 会場クセ | official result history + venue extras | イン有利、外枠絡み、決まり手傾向 |
| 荒れ指数 | 払戻、人気、オッズ、外枠絡み | ROUGH INDEX |
| 今日の流れ | 同日同会場のレース結果列 | TODAY FLOW / RACE CHAIN |
| weather傾向 | 天候、水面、結果 | 風・波による崩れやすさ |
| 展示評価 | 展示タイム、ST、進入、結果 | 展示信頼度 |
| モーター評価 | モーター率、節間足、結果 | 過大/過小評価 |
| predictionSignals | official + user + derived | 予想支援シグナル |
| 的中/不的中の差分分析 | 予想、結果、summary | REVIEW DIFF |

## 3. 原本データと派生データの分離方針

既存構造は `public/data/boatrace/*.generated.json` と `public/data/reviews/**` が中心である。EX では既存ファイルを壊さず、後続実装で次のように増設する。

```text
public/data/boatrace-ex/
  raw/
    official/YYYY-MM-DD/{venueCode}.json
    user/YYYY-MM-DD/{venueSlug}.json
  history/
    races/YYYY-MM-DD.json
    venues/{venueCode}.json
  derived/
    venue-bias/{venueCode}.json
    rough-index/YYYY-MM-DD.json
    today-flow/YYYY-MM-DD.json
    review-diff/YYYY-MM-DD.json
  signals/
    YYYY-MM-DD/{venueCode}.json
  coverage/
    YYYY-MM-DD.json
    venues/{venueCode}.json
    sources.json
```

分類方針:

- raw official data: 公式/会場公式から取得した事実。`sourceName`, `sourceUrl`, `fetchedAt`, `sourceStatus` を必須にする。
- raw user data: 予想、summary、展開メモ、レビュー。`sourcePath` または localStorage export 元、`createdAt` を必須にする。
- normalized data: 画面や分析で使えるように日付、会場、レース、選手、結果を正規化した履歴。
- derived metrics: raw/normalized から生成した会場傾向、荒れ指数、展示評価、モーター評価。
- prediction signals: 予想前または展示後に使うシグナル。根拠 source と coverage を必須にする。
- UI display data: EX ページが読む軽量集約。raw を直接上書きしない。

既存 `public/data/reviews/**` は review archive として維持し、EX の raw user へ参照またはコピー変換する場合も元ファイルを削除・移動しない。

## 4. EX用データモデル案

共通 metadata:

```ts
type BoatExSourceMeta = {
  sourceName: string;
  sourceUrl?: string;
  sourcePath?: string;
  sourceType: "official" | "user" | "derived";
  fetchedAt?: string;
  generatedAt?: string;
  createdAt?: string;
  sourceStatus:
    | "available"
    | "pending"
    | "not-published"
    | "not-supported"
    | "parse-empty"
    | "http-error"
    | "unknown"
    | "user-only"
    | "derived-ready"
    | "insufficient-sample";
  coverageStatus: "complete" | "partial" | "missing" | "not-supported" | "unknown";
};
```

レース単位:

```ts
type BoatExRaceRecord = {
  date: string;
  venueCode: string;
  venueName: string;
  raceNo: number;
  raceGrade?: string;
  raceStage?: string;
  sessionType: "morning" | "day" | "night" | "unknown";
  officialRace?: BoatExOfficialRace;
  officialResult?: BoatExOfficialResult;
  officialExhibition?: BoatExOfficialExhibition;
  weather?: BoatExWeather;
  waterSurface?: BoatExWaterSurface;
  motor?: BoatExMotor[];
  boat?: BoatExBoat[];
  racer?: BoatExRacer[];
  prediction?: BoatExPrediction;
  summary?: BoatExSummary;
  review?: BoatExReview;
  derivedSignals?: BoatExPredictionSignal[];
  sources: BoatExSourceMeta[];
};
```

各モデルの扱い:

- `officialRace`: 出走表、締切、発走、タイトル、選手。既存 `BoatRaceItem` と `BoatRacerItem` から変換できる。
- `officialResult`: 確定着順、決まり手、進入、ST、払戻、返還、最終オッズ。既存 `BoatRaceResult` から変換できる。
- `officialExhibition`: 展示タイム、チルト、スタート展示、部品交換。`race.exhibitions` と `venue-extras` の `officialBeforeInfo` を source 優先順つきで統合する。
- `weather`: 天候、風向、風速、波高、気温、水温、観測時刻。`weatherActual` / `weatherCondition` を使用する。
- `waterSurface`: 会場公式の水面、潮、安定板、波影響。取れない場合は `not-supported` または `unknown`。
- `motor` / `boat`: 番号、2連率、3連率、勝率、節間足色、source。足色コメントが無い場合は推測しない。
- `racer`: 登録番号、名前、支部、級別、当地成績、平均ST、近況。登録番号が取れなければ `unknown`。
- `prediction`: 予想本文、買い目、parseStatus、stake、予想時 source。既存 `BoatPredictionRecord` を source user として扱う。
- `summary`: summary.txt / draft。本文、作成者、作成日時、参照 race。
- `review`: hit/miss、収支、ROI、反省メモ。既存 `BoatPracticeResultRecord` を変換できる。
- `derivedSignals`: PRIMARY / CAUTION / SAMPLE WARNING / CONFLICT。必ず根拠 source と coverage を持つ。

fake 禁止のため、値が取れない場合は空文字や仮値を入れず、`sourceStatus: "unknown"`、`coverageStatus: "missing"`、値は `null` または `"unknown"` とする。

## 5. 競艇特有の分析軸

### 会場傾向

- イン逃げ率: 1号艇1着率。結果 history が一定数未満なら `insufficient-sample`。
- 2コース差し率: 2コース1着かつ決まり手が差し系の割合。
- 3〜6号艇の3連対率: 外枠が3着内に入る割合。
- 外枠絡み率: 3連単に4〜6号艇が含まれる割合。
- 万舟率: 3連単払戻が10,000円以上の割合。
- 決まり手傾向: 逃げ、差し、まくり、まくり差し、抜き、恵まれ。
- 進入固定/進入変動: 展示進入と本番進入の差、進入コースの変動頻度。
- 枠なり率: 進入が 1-2-3-4-5-6 になる割合。
- 荒れやすさ: 外枠絡み、万舟、人気薄、風波条件を総合した指数。

### レース条件

- レース番号別: 1R〜12R で堅さと荒れ方を分ける。
- 朝/昼/ナイター別: `session` を morning / day / night に正規化する。
- 初日/2日目/準優/優勝戦/一般戦別: `raceStage` と開催日 label から分類する。
- グレード別: SG/G1/G2/G3/一般など。未取得なら `unknown`。
- 予選/準優/優勝戦別: タイトル・開催情報から分類。曖昧なら `pending`。

### 天候/水面

- 風向: 追い風、向かい風、横風に会場ごとの水面向きで変換する。
- 風速: 強風 threshold を会場別に調整する。
- 波高: 波高が高い日は荒れ指数に寄与させる。
- 雨/晴れ: 水面変化の補助条件。
- 安定板あり/なし: 公式 source が取れる場合のみ採用。
- 荒天影響: 風速、波高、安定板、中止/欠場/返還から判定する。

### 展示

- 展示タイム上位の信頼度: 展示上位が3着内に入った割合。
- スタート展示: 展示STと本番STの差。
- 本番STとの差: 公式結果 ST が取れてから算出する。
- 展示なし事前予想との差: 予想保存時点の coverage と展示取得後の signal を比較する。
- 展示で評価を上げる選手/下げる選手: 展示評価と結果の一致度から派生。
- 周回展示コメント: 会場公式 source で取れる場合のみ user/official source を分ける。

### モーター/ボート

- モーター2連率、3連率、勝率。
- モーター節間足色、出足/伸び/回り足。
- ボート2連率、勝率。
- モーター評価と結果の一致度。
- 過大評価/過小評価: モーター評価は高いが結果が伴わない、または逆のケース。

### 選手

- コース別成績。
- ST安定度。
- 逃げ/差し/まくり/まくり差し傾向。
- 地元水面適性。
- 支部、級別 A1/A2/B1/B2。
- 近況調子、節間上昇/下降。

登録番号、選手詳細、支部、級別は公式 source で取れない限り補完しない。

## 6. Result Trend Lab 競艇版

| タブ | 何を見る画面か | 入力データ | 出力指標 | coverage条件 | sample warning |
| --- | --- | --- | --- | --- | --- |
| VENUE BIAS | 会場クセと枠/進入傾向 | result history, venue extras | イン逃げ率、外枠絡み率、決まり手 | 結果/進入/STが一定数以上 | 履歴不足、進入未取得 |
| ROUGH INDEX | 荒れやすさ | 払戻、人気、外枠、風波 | 万舟率、人気薄率、荒れ指数 | 払戻と着順が必要 | 払戻未取得、件数不足 |
| TODAY FLOW | 今日の流れ | 同日同会場の結果 | 前半堅い/荒れ、外枠流れ | 当日結果が複数R必要 | 1Rのみ、結果未確定 |
| RACE CHAIN | 直前レースからの連鎖 | 今日の流れ、風波、進入 | 次Rへの注意 signal | 前レース結果が必要 | 前レース未確定 |
| WEATHER | 天候・水面影響 | weatherActual, weatherCondition | 風向/風速/波高別傾向 | 気象 source が必要 | 天候未取得 |
| EXHIBITION | 展示の効き | exhibitions, startExhibition, result | 展示上位信頼度、展示ST差 | 展示6艇 + 結果 | 展示未取得/一部 |
| MOTOR / BOAT | 機力評価 | motor/boat, result | 上位機信頼度、過大評価 | モーター/ボート source | 新モーター、source不足 |
| RACER | 選手傾向 | racer, result, venue extras | ST安定、地元適性 | 選手情報 source | 登録番号不明 |
| RESULT TREND LAB | 結果傾向の総合 | history derived | 的中しやすい条件 | normalized history | 件数不足 |
| PREDICTION SIGNALS | 予想支援 | official/user/derived | PRIMARY/CAUTION等 | 根拠 source 必須 | official不足 |
| REVIEW / SUMMARY | 予想差分と改善 | prediction, practice, summary | hit/miss理由、次回修正 | user source 必須 | summaryのみ/結果なし |

## 7. predictionSignals 設計

共通構造:

```ts
type BoatExPredictionSignal = {
  id: string;
  category: "PRIMARY" | "CAUTION" | "SAMPLE_WARNING" | "CONFLICT";
  label: string;
  severity: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high" | "unknown";
  raceKey: string;
  evidence: {
    field: string;
    value: string | number | null;
    source: BoatExSourceMeta;
  }[];
  coverageStatus: "complete" | "partial" | "missing" | "unknown";
  generatedAt: string;
};
```

PRIMARY:

- 1号艇信頼: 会場イン率、1号艇選手、モーター、展示、風波が揃う。
- モーター上位: モーター率または節間足色が上位。
- 展示気配上位: 展示タイム、周回、STが上位。
- ST安定: 平均STまたは展示/本番STが安定。
- 会場イン有利: 会場 bias がイン優勢。
- 地元水面適性: 地元/当地成績が source-backed。
- コース実績良好: コース別結果が良い。

CAUTION:

- 外枠絡み注意。
- 風強め。
- 波高あり。
- 展示と事前評価が逆。
- 進入変動注意。
- 1号艇不安。
- 万舟警戒。
- モーター過大評価注意。

SAMPLE WARNING:

- サンプル不足。
- 初出場/データ少。
- 新モーター期間。
- 展示未取得。
- 公式結果未確定。
- user summaryのみ。
- official source不足。

CONFLICT:

- モーターは良いが選手近況が悪い。
- 展示は良いがコース実績が弱い。
- 1号艇有利だが風が逆方向。
- 会場傾向は堅いが今日の流れは荒れ気味。
- 事前予想と展示評価が逆。
- モーター評価と実結果が合わない。

## 8. 予想と結果の差分分析

summary と practice result から、次の項目を race 単位で保存する。

```ts
type BoatExReviewDiff = {
  raceKey: string;
  date: string;
  venueCode?: string;
  venueName: string;
  raceNo: number;
  hitStatus: "hit" | "miss" | "pending" | "parse-warning";
  whyHit?: string;
  whyMiss?: string;
  couldFixWithExhibition: "yes" | "no" | "unknown";
  preExhibitionPriorityShouldHaveBeen?: string[];
  venueBiasMisread?: "yes" | "no" | "unknown";
  motorOverestimated?: "yes" | "no" | "unknown";
  weatherMissed?: "yes" | "no" | "unknown";
  lane1OverOrUnderEstimated?: "over" | "under" | "no" | "unknown";
  outsideFrameWarningMissed?: "yes" | "no" | "unknown";
  nextFixes: string[];
  sources: BoatExSourceMeta[];
};
```

蓄積する観点:

- なぜ当たったか。
- なぜ外れたか。
- 展示を見ていれば修正できたか。
- 展示なし事前予想では何を重視すべきだったか。
- 会場クセを読み違えたか。
- モーター評価を過大評価したか。
- 風/波の影響を見落としたか。
- 1号艇信頼を過大評価/過小評価したか。
- 外枠絡み警戒が足りなかったか。
- 次回修正点。

自然文 summary からの抽出は derived source とし、原文への `sourcePath` を必ず残す。抽出できない項目は `unknown` のままにする。

## 9. coverage / source status 設計

coverage は venue別、date別、race別、source別、official/user/derived別に持つ。

```ts
type BoatExCoverage = {
  date: string;
  venueCode?: string;
  venueName?: string;
  raceNo?: number;
  scope: "venue" | "date" | "race" | "source";
  official: Record<string, BoatExSourceMeta["sourceStatus"]>;
  user: Record<string, BoatExSourceMeta["sourceStatus"]>;
  derived: Record<string, BoatExSourceMeta["sourceStatus"]>;
  completeness: number;
  warnings: string[];
  generatedAt: string;
};
```

coverage対象:

- 出走表
- 結果
- 払戻
- 決まり手
- 進入
- ST
- 展示
- 天候
- 風
- 波
- モーター
- ボート
- 選手
- 予想
- summary
- review

sourceStatus:

- `available`: source から取得済み。
- `pending`: まだ取得時刻前、または後続取得待ち。
- `not-published`: 公式未公開。
- `not-supported`: 会場/公式で提供されない。
- `parse-empty`: 取得したがパース結果が空。
- `http-error`: 通信失敗。
- `unknown`: 判定不能。
- `user-only`: user source のみ存在。
- `derived-ready`: 派生生成可能。
- `insufficient-sample`: 分析件数不足。

coverage が不足する場合、UI は値を補完せず sample warning を表示する。

## 10. 画面タブ構成案

- OVERVIEW: 対象日、会場、取得状況、今日の主要 warning、EX 指標の要約。
- DATA COVERAGE: source 別・race 別の coverage 表。公式/user/derived の欠損を確認する。
- VENUE BIAS: イン逃げ率、外枠絡み率、決まり手、枠なり率、万舟率。
- WEATHER: 風向、風速、波高、雨、安定板、結果への影響。
- EXHIBITION: 展示タイム順位、展示ST、本番ST差、展示評価の的中度。
- MOTOR / BOAT: モーター/ボート率、節間足、結果との一致度、過大/過小評価。
- RACER: 級別、支部、当地/コース/ST/近況。source が無い項目は unknown。
- RESULT TREND LAB: 日別・会場別・レース番号別の結果傾向。
- PREDICTION SIGNALS: PRIMARY / CAUTION / SAMPLE WARNING / CONFLICT を race 単位で表示。
- REVIEW / SUMMARY: 予想本文、結果、hit/miss、summary、次回修正点。
- SOURCE AUDIT: sourceName、sourceUrl/sourcePath、fetchedAt/generatedAt、sourceStatus の監査。

## 11. データ更新フロー案

```text
1. 予想作成
   PredictionPage で予想を保存し、BoatPredictionRecord として localStorage に保存する。

2. 公式出走表取得
   scripts/updateBoatData.mjs が updateBoatTodayRaceDetails.mjs を呼び、today-race-details.generated.json / today.generated.json を更新する。

3. 公式展示取得
   updateBoatData.mjs の active/final mode と updateBoatVenueExtras.mjs が beforeInfo, exhibitions, venue extras を取得する。

4. 公式結果取得
   updateBoatData.mjs の results/final mode が resultList, detailedResults, odds を取得する。

5. summary作成
   ReviewPage が live localStorage と archive fallback を使って summary / result summary を作成する。

6. raw source 保存
   将来の EX 実装で today/venue-extras/review/localStorage export を boatrace-ex/raw に保存する。

7. normalized history生成
   date/venue/race 単位に officialRace, officialResult, officialExhibition, prediction, review を正規化する。

8. derived metrics生成
   会場傾向、荒れ指数、weather傾向、展示評価、モーター評価を history から生成する。

9. predictionSignals生成
   coverage が満たされた項目だけ signal 化する。不足時は SAMPLE_WARNING にする。

10. coverage更新
    sourceStatus と completeness を date/venue/race/source 単位で生成する。

11. UI表示
    EX ページは raw ではなく derived/signals/coverage/UI display data を読む。
```

既存接続:

- `updateBoatData.mjs`: daily official feed の起点。EX の raw official 生成前段にする。
- `updateBoatVenueExtras.mjs`: 会場公式 extras の起点。展示、モーター、水面、独自データを raw official にする。
- `PredictionPage.tsx`: 予想保存、買い目 parse、practice result、Johnson export の user source 起点。
- `ReviewPage.tsx`: localStorage と `public/data/reviews/index.json` をまとめる review/summary 起点。
- `boatReviewSummaryBuilder.ts`: 予想・結果・展示・払戻・coverage summary 生成ロジックの参照元。
- `checkBoatVenueOfficialStatus.mjs`, `checkBoatVenueExtrasCoverage.mjs`, `checkBoatVenueOriginalExhibitionCoverage.mjs`: sourceStatus と coverage の検査設計に流用する。

## 12. Phase設計

| Phase | 目的 | 作成ファイル候補 | 入力データ | 出力データ | 検査方法 | 完了条件 |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 1 | 既存データ棚卸しとEX設計書作成 | `docs/boat-ex-data-labo-design.md` | 既存コード、generated JSON、reviews | 設計書 | `git diff --check` | 実装せず設計が揃う |
| Phase 2 | raw / normalized / derived のJSONスキーマ作成 | `src/lib/boatExTypes.ts`, docs schema | 既存型 | schema/types | `npx.cmd tsc --noEmit` | source meta と status が型化される |
| Phase 3 | 公式結果から history データ作成 | `scripts/generateBoatExHistory.mjs` | today/result generated | `boatrace-ex/history` | fixture + build | 着順/払戻/ST/進入が正規化される |
| Phase 4 | 会場クセ / 荒れ指数 / WEATHER / 今日の流れ | `scripts/generateBoatExDerived.mjs` | history/weather | `derived/venue-bias`, `rough-index`, `today-flow` | サンプル不足判定 test | insufficient-sample が出せる |
| Phase 5 | 展示 / モーター / ボート / 選手分析追加 | parser/derived 拡張 | venue-extras | exhibition/motor/racer metrics | coverage check | fake 補完なしで指標化 |
| Phase 6 | predictionSignals 作成 | `scripts/generateBoatExSignals.mjs` | official/user/derived | `signals/YYYY-MM-DD` | signal fixture | evidence/source付きで出力 |
| Phase 7 | Review summary から差分学習データ作成 | `scripts/generateBoatExReviewDiff.mjs` | reviews, practice | `derived/review-diff` | archive fixture | unknown を保持して抽出 |
| Phase 8 | EXページ UI 作成 | `src/pages/BoatExDataLaboPage.tsx` | coverage/derived/signals | UI | Playwright/build | タブ表示と欠損表示 |
| Phase 9 | 自動更新・coverage監査・source audit | check scripts | all EX data | audit report | CI / npm scripts | sourceStatus regressions を検出 |

## 13. MVP提案

最初の MVP:

- OVERVIEW: 当日・会場別の EX 概要。
- DATA COVERAGE: 出走表、結果、展示、天候、モーター、予想、summary の取得状況。
- VENUE BIAS v1: イン逃げ率、外枠絡み率、万舟率、決まり手。
- RESULT TREND LAB v1: 日別/会場別/レース番号別の結果履歴。
- WEATHER v1: 風速、風向、波高と結果の関係。
- REVIEW DIFF v1: 的中/不的中、収支、次回修正点。
- predictionSignals v0: PRIMARY / CAUTION / SAMPLE WARNING / CONFLICT の最小版。

MVPでやらないこと:

- 選手詳細の完全統合は後回し。
- 展示ST本番差は公式結果 ST と展示 ST が安定してから。
- モーター足色の細分類は source が取れてから。
- 周回展示コメントの自然言語評価は source が安定してから。
- 登録番号、支部、級別の推測補完は禁止。
- fake 補完は禁止。
- review archive の移動/削除/再生成 commit はしない。

## 14. 安全ルール

- fake補完禁止。
- official優先。
- user source分離。
- source-backed only。
- unknownをunknownのまま残す。
- coverage不足時はsample warning。
- generated dataとraw dataを分ける。
- review archiveを消さない。
- `public/data/reviews/**` を触らない。
- localStorage整理はブラウザ内だけ。
- GitHub上のarchiveは消さない。
- 実装時は変更対象ファイルを限定する。
- `git add .` 禁止。
- `git clean` 禁止。
- `git reset --hard` 禁止。

今回の作業では設計書のみを追加し、React 実装、生成スクリプト実装、generated JSON 更新、review archive 更新は行わない。
