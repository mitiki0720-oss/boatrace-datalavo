import { useEffect, useMemo, useState } from "react";
import type { BoatPredictionRecord } from "../lib/boatraceTypes";
import { BoatGptMaterialPanel } from "../components/boatrace/BoatGptMaterialPanel";
import { BoatPracticeResultPanel } from "../components/boatrace/BoatPracticeResultPanel";
import { BoatPredictionPastePanel } from "../components/boatrace/BoatPredictionPastePanel";
import { BoatPredictionVenueRaceChooser } from "../components/boatrace/BoatPredictionVenueRaceChooser";
import { PageShell } from "../components/layout/PageShell";
import { sampleBoatTodayFeed } from "../data/sampleBoatTodayFeed";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import { buildBoatPredictionMaterial } from "../lib/boatPredictionMaterial";
import { parseBoatPredictionTickets } from "../lib/boatPredictionParser";
import {
	findSelectedRaceExtra,
	findSelectedVenueExtra,
	loadBoatVenueExtrasFeed,
	type BoatVenueExtrasFeed,
} from "../lib/boatVenueExtrasFeed";
import {
	loadBoatVenueFeatureIndex,
	loadBoatVenueFeatureNote,
	type BoatVenueFeatureIndex,
	type BoatVenueFeatureNote,
} from "../lib/boatVenueFeatures";
import type { BoatPracticeResultRecord } from "../lib/boatPracticeResultStorage";
import { withBasePath } from "../lib/assetPath";
import {
	calculateBoatPracticeProfitLoss,
	deleteBoatPracticeResultRecord,
	findBoatPracticeResultRecord,
	upsertBoatPracticeResultRecord,
} from "../lib/boatPracticeResultStorage";
import {
	buildBoatPredictionRaceKey,
	deleteBoatPredictionRecord,
	findBoatPredictionRecord,
	upsertBoatPredictionRecord,
} from "../lib/boatPredictionStorage";

const panelGridClassName = "prediction-page-main-panels";

const savedMessageStyle = {
	margin: "-4px 0 0",
	fontSize: "0.9rem",
	fontWeight: 700,
	color: "#2c5b7a",
};

const practiceMessageStyle = {
	margin: "6px 0 -4px",
	fontSize: "0.9rem",
	fontWeight: 700,
	color: "#7a4a5f",
};

const getRaceKey = (venueId: string, raceId: string | undefined, raceNo: number) => raceId ?? `${venueId}-${raceNo}`;

type BoatPredictionTodayFeed = typeof sampleBoatTodayFeed;
type BoatPredictionVenue = BoatPredictionTodayFeed["venues"][number];
type BoatPredictionRace = BoatPredictionVenue["races"][number];

const toArray = <T,>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, T>);
	}

	return [];
};

const getVenueRaces = (venue: BoatPredictionVenue | undefined): BoatPredictionRace[] =>
	toArray<BoatPredictionRace>((venue as { races?: unknown } | undefined)?.races);

type PredictionHeroTimeBand = "morning" | "day" | "night";

const predictionHeroImageSrcMap: Record<PredictionHeroTimeBand, string> = {
	morning: withBasePath("prediction-page/hero/prediction-hero-morning-kurari-funako-naughty.png"),
	day: withBasePath("prediction-page/hero/prediction-hero-day-kurari-funako-naughty.png"),
	night: withBasePath("prediction-page/hero/prediction-hero-night-kurari-funako-naughty.png"),
};

const predictionPageBackgroundImageSrc = withBasePath(
	"prediction-page/backgrounds/prediction-bg-water-sparkle.png",
);

const getPredictionHeroTimeBand = (venue: BoatPredictionVenue | undefined): PredictionHeroTimeBand => {
	const session = String((venue as { session?: unknown } | undefined)?.session ?? "").trim().toLowerCase();
	const title = String((venue as { title?: unknown } | undefined)?.title ?? "").replace(/\s+/g, "").toLowerCase();

	if (session === "morning" || title.includes("モーニング")) {
		return "morning";
	}

	if (session === "night" || session === "midnight" || title.includes("ナイター") || title.includes("ミッドナイト")) {
		return "night";
	}

	return "day";
};

const formatJstDateTimeLabel = (value: string | undefined): string => {
	if (!value) {
		return "未取得";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
};

const hasRaceOddsPreview = (race: BoatPredictionRace): boolean => {
	const oddsPreview = (race as { oddsPreview?: unknown }).oddsPreview;

	if (Array.isArray(oddsPreview)) {
		return oddsPreview.length > 0;
	}

	if (oddsPreview && typeof oddsPreview === "object") {
		return Object.values(oddsPreview as Record<string, unknown>).some((value) => {
			if (Array.isArray(value)) {
				return value.length > 0;
			}

			return Boolean(value);
		});
	}

	return false;
};

const hasVenueWeather = (venue: BoatPredictionVenue): boolean => {
	const weatherActual = (venue as { weatherActual?: unknown }).weatherActual;
	const weather = (venue as { weather?: unknown }).weather;

	return Boolean(weatherActual || weather);
};

export function PredictionPage() {
	const [todayFeed, setTodayFeed] = useState(sampleBoatTodayFeed);
	const [venueExtrasFeed, setVenueExtrasFeed] = useState<BoatVenueExtrasFeed | null>(null);
	const [dataUpdatedAt, setDataUpdatedAt] = useState("");
	const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [selectedVenueId, setSelectedVenueId] = useState<string>("");
	const [selectedRaceId, setSelectedRaceId] = useState<string>("");
	const [venueFeatureIndex, setVenueFeatureIndex] = useState<BoatVenueFeatureIndex | null>(null);
	const [selectedVenueFeatureNote, setSelectedVenueFeatureNote] = useState<BoatVenueFeatureNote | null>(null);
	const [predictionText, setPredictionText] = useState<string>("");
	const [savedPredictionRecord, setSavedPredictionRecord] = useState<BoatPredictionRecord | undefined>(undefined);
	const [savedMessage, setSavedMessage] = useState<string>("");
	const [savedPracticeResultRecord, setSavedPracticeResultRecord] = useState<BoatPracticeResultRecord | undefined>(undefined);
	const [practiceMessage, setPracticeMessage] = useState<string>("");
	const [actualFinishOrderText, setActualFinishOrderText] = useState<string>("");
	const [investmentAmount, setInvestmentAmount] = useState<number>(1000);
	const [payoutAmount, setPayoutAmount] = useState<number>(0);
	const [practiceMemo, setPracticeMemo] = useState<string>("");

	const venues = useMemo<BoatPredictionVenue[]>(
		() =>
			toArray<BoatPredictionVenue>((todayFeed as { venues?: unknown }).venues).map((venue) => ({
				...venue,
				races: getVenueRaces(venue),
			})),
		[todayFeed],
	);

	const races = useMemo<BoatPredictionRace[]>(() => venues.flatMap((venue) => getVenueRaces(venue)), [venues]);
	const initialVenue = venues[0];
	const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? initialVenue;
	const selectedVenueRaces = useMemo(() => getVenueRaces(selectedVenue), [selectedVenue]);
	const selectedRace =
		selectedVenueRaces.find((race) => getRaceKey(selectedVenue?.id ?? "", race.raceId, race.raceNo) === selectedRaceId) ??
		selectedVenueRaces[0];
	const selectedVenueExtra = useMemo(
		() => findSelectedVenueExtra(venueExtrasFeed, selectedVenue),
		[venueExtrasFeed, selectedVenue],
	);
	const selectedRaceExtra = useMemo(
		() => findSelectedRaceExtra(selectedVenueExtra, selectedRace),
		[selectedVenueExtra, selectedRace],
	);

	const parsedTickets = useMemo(() => parseBoatPredictionTickets(predictionText), [predictionText]);
	const selectedRaceKey = useMemo(() => {
		if (!selectedVenue || !selectedRace) {
			return "";
		}

		return buildBoatPredictionRaceKey({
			date: selectedVenue.date,
			venueName: selectedVenue.venueName,
			raceNo: selectedRace.raceNo,
			raceId: selectedRace.raceId,
		});
	}, [selectedVenue, selectedRace]);

	const materialText = selectedVenue && selectedRace
		? buildBoatPredictionMaterial({
				venue: selectedVenue,
				race: selectedRace,
				venueExtra: selectedVenueExtra,
				raceExtra: selectedRaceExtra,
				venueFeatureNote: selectedVenueFeatureNote,
			})
		: "レース情報が選択されていません。";
	const raceLabel = `${selectedVenue?.venueName ?? "-"} ${selectedRace ? `${selectedRace.raceNo}R` : "-"}`;
	const venueCount = venues.length;
	const raceCount = races.length;
	const confirmedRaceCount = races.filter((race) => race.result?.status === "confirmed").length;
	const materialReadyRaceCount = races.filter((race) => {
		const racerCount = toArray<unknown>((race as { racers?: unknown }).racers).length;
		const exhibitionCount = toArray<unknown>((race as { exhibitions?: unknown }).exhibitions).length;

		return racerCount > 0 && exhibitionCount > 0 && hasRaceOddsPreview(race);
	}).length;
	const copyReadyRaceCount = materialReadyRaceCount;
	const weatherReadyVenueCount = venues.filter(hasVenueWeather).length;
	const currentSelectionLabel = `${selectedVenue?.venueName ?? "-"} / ${selectedRace?.raceNo ? `${selectedRace.raceNo}R` : "-"}`;
	const currentSelectionMeta = selectedRace?.deadlineTime
		? `締切 ${selectedRace.deadlineTime}`
		: selectedRace?.startTime
			? `発走 ${selectedRace.startTime}`
			: "時刻未取得";
	const venueFeatureStatusLabel = selectedVenueFeatureNote ? "会場特徴ノート: 連携済み" : "会場特徴ノート: 未登録";
	const predictionHeroTimeBand = getPredictionHeroTimeBand(selectedVenue);
	const predictionHeroImageSrc = predictionHeroImageSrcMap[predictionHeroTimeBand];
	const predictionHeroImageAlt =
		predictionHeroTimeBand === "morning"
			? "モーニング開催の予想ヒーロー画像"
			: predictionHeroTimeBand === "night"
				? "ナイター開催の予想ヒーロー画像"
				: "デイ開催の予想ヒーロー画像";

	const heroStats = [
		{
			eyebrow: "TODAY VENUES",
			value: `${venueCount}会場`,
			description: "今日の開催会場数",
		},
		{
			eyebrow: "TARGET RACES",
			value: `${raceCount}R`,
			description: "素材確認の対象レース数",
		},
		{
			eyebrow: "READY MATERIAL",
			value: `${materialReadyRaceCount}R`,
			description: "展示・選手・オッズが揃う仮基準",
		},
		{
			eyebrow: "COPY READY",
			value: `${copyReadyRaceCount}R`,
			description: `天気反映 ${weatherReadyVenueCount}/${venueCount}会場`,
		},
		{
			eyebrow: "TODAY RESULTS",
			value: `${confirmedRaceCount}R`,
			description: `結果確定 ${confirmedRaceCount}R / 保存集計は次フェーズ`,
		},
		{
			eyebrow: "HIT RATE",
			value: "--%",
			description: "保存済み結果の的中率を次フェーズで接続",
		},
		{
			eyebrow: "ROI",
			value: "--%",
			description: "保存済み投資 / 払戻を次フェーズで集計",
		},
		{
			eyebrow: "PROFIT",
			value: "--円",
			description: "当日保存済み結果データを集計予定",
		},
	];

	const hitNotificationItems = [
		{
			title: "的中ログ準備中",
			meta: "保存済み結果データと接続予定",
			badge: "準備中",
			result: "-",
			payout: "払戻 -",
			profit: "収支 -",
		},
	];

	const hitNotificationLoopItems = [
		...hitNotificationItems,
		...hitNotificationItems,
		...hitNotificationItems,
		...hitNotificationItems,
	];

	const refreshTodayFeed = async (options?: { silent?: boolean; isActive?: () => boolean }) => {
		const isSilent = options?.silent ?? false;

		if (!isSilent) {
			setIsRefreshingFeed(true);
			setRefreshMessage("最新データを読み込み中です...");
		}

		try {
			const [result, extrasResult] = await Promise.all([
				loadBoatTodayRaceDetailsFeed(),
				loadBoatVenueExtrasFeed(),
			]);

			if (options?.isActive && !options.isActive()) {
				return;
			}

			if (!result) {
				if (!isSilent) {
					setRefreshMessage("最新データを取得できませんでした。現在表示中のデータを維持します。");
				}
				return;
			}

			setTodayFeed(result);
			setVenueExtrasFeed(extrasResult);
			setDataUpdatedAt(result.generatedAt ?? "");

			if (!isSilent) {
				setRefreshMessage("最新データを読み込みました。");
			}
		} catch {
			if (options?.isActive && !options.isActive()) {
				return;
			}

			if (!isSilent) {
				setRefreshMessage("データ更新中にエラーが発生しました。");
			}
		} finally {
			if (!isSilent && (!options?.isActive || options.isActive())) {
				setIsRefreshingFeed(false);
			}
		}
	};

	useEffect(() => {
		let isActive = true;

		void refreshTodayFeed({ silent: true, isActive: () => isActive });

		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		const firstVenue = venues[0];
		const firstRace = getVenueRaces(firstVenue)[0];

		if (!firstVenue || !firstRace) {
			return;
		}

		const currentVenue = venues.find((venue) => venue.id === selectedVenueId);
		const currentRace = currentVenue
			? getVenueRaces(currentVenue).find((race) => {
					const raceId = race.raceId || `${currentVenue.id}-${race.raceNo}`;
					return raceId === selectedRaceId;
				})
			: undefined;

		if (!currentVenue || !currentRace) {
			setSelectedVenueId(firstVenue.id);
			setSelectedRaceId(firstRace.raceId || `${firstVenue.id}-${firstRace.raceNo}`);
		}
	}, [venues, selectedVenueId, selectedRaceId]);

	const handleSelectVenue = (venueId: string) => {
		const venue = venues.find((item) => item.id === venueId);
		const firstRace = getVenueRaces(venue)[0];

		setSelectedVenueId(venueId);
		setSelectedRaceId(getRaceKey(venueId, firstRace?.raceId, firstRace?.raceNo ?? 0));
	};

	const handleSelectRace = (raceId: string) => {
		setSelectedRaceId(raceId);
	};

	useEffect(() => {
		let cancelled = false;
		loadBoatVenueFeatureIndex().then((loadedIndex) => {
			if (!cancelled) {
				setVenueFeatureIndex(loadedIndex);
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!selectedVenue?.venueName) {
			setSelectedVenueFeatureNote(null);
			return;
		}

		let cancelled = false;
		setSelectedVenueFeatureNote(null);
		loadBoatVenueFeatureNote(selectedVenue.venueName, venueFeatureIndex).then((note) => {
			if (!cancelled) {
				setSelectedVenueFeatureNote(note);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [selectedVenue, venueFeatureIndex]);

	useEffect(() => {
		if (!selectedVenue || !selectedRace || !selectedRaceKey) {
			return;
		}

		const record = findBoatPredictionRecord({
			date: selectedVenue.date,
			venueName: selectedVenue.venueName,
			raceNo: selectedRace.raceNo,
			raceId: selectedRace.raceId,
		});

		if (record) {
			setSavedPredictionRecord(record);
			setPredictionText(record.predictionText);
			setSavedMessage("保存済み予想を読み込みました");
			return;
		}

		setSavedPredictionRecord(undefined);
		setPredictionText("");
		setSavedMessage("");
	}, [selectedVenue, selectedRace, selectedRaceKey]);

	useEffect(() => {
		if (!selectedRaceKey || !selectedRace) {
			return;
		}

		const record = findBoatPracticeResultRecord(selectedRaceKey);

		if (record) {
			setSavedPracticeResultRecord(record);
			setActualFinishOrderText(record.actualFinishOrderText);
			setInvestmentAmount(record.investmentAmount);
			setPayoutAmount(record.payoutAmount);
			setPracticeMemo(record.practiceMemo);
			setPracticeMessage("保存済み実践結果を読み込みました");
			return;
		}

		setSavedPracticeResultRecord(undefined);
		setActualFinishOrderText(selectedRace.result?.finishOrder?.slice(0, 3).join("-") ?? "");
		setInvestmentAmount(1000);
		setPayoutAmount(0);
		setPracticeMemo("");
		setPracticeMessage("");
	}, [selectedRace, selectedRaceKey]);

	const handleSavePrediction = () => {
		if (!selectedVenue || !selectedRace || !selectedRaceKey) {
			return;
		}

		if (!predictionText.trim()) {
			setSavedMessage("予想本文が空です");
			return;
		}

		const record: BoatPredictionRecord = {
			raceKey: selectedRaceKey,
			raceId: selectedRace.raceId,
			venueName: selectedVenue.venueName,
			date: selectedVenue.date,
			raceNo: selectedRace.raceNo,
			predictionText,
			tickets: parsedTickets,
			savedAt: new Date().toISOString(),
		};

		upsertBoatPredictionRecord(record);
		setSavedPredictionRecord(record);
		setSavedMessage("予想を保存しました");
	};

	const handleClearPrediction = () => {
		setPredictionText("");

		if (savedPredictionRecord?.raceKey) {
			deleteBoatPredictionRecord(savedPredictionRecord.raceKey);
		}

		setSavedPredictionRecord(undefined);
		setSavedMessage("予想をクリアしました");
	};

	const handleSavePracticeResult = () => {
		if (!selectedVenue || !selectedRace || !selectedRaceKey) {
			return;
		}

		const { profitLoss, roi } = calculateBoatPracticeProfitLoss({
			investmentAmount,
			payoutAmount,
		});

		const record: BoatPracticeResultRecord = {
			raceKey: selectedRaceKey,
			raceId: selectedRace.raceId,
			venueName: selectedVenue.venueName,
			date: selectedVenue.date,
			raceNo: selectedRace.raceNo,
			raceTitle: selectedRace.title,
			actualFinishOrderText,
			investmentAmount,
			payoutAmount,
			profitLoss,
			roi,
			practiceMemo,
			savedAt: new Date().toISOString(),
		};

		upsertBoatPracticeResultRecord(record);
		setSavedPracticeResultRecord(record);
		setPracticeMessage("実践結果を保存しました");
	};

	const handleClearPracticeResult = () => {
		if (selectedRaceKey) {
			deleteBoatPracticeResultRecord(selectedRaceKey);
		}

		setSavedPracticeResultRecord(undefined);
		setActualFinishOrderText("");
		setInvestmentAmount(1000);
		setPayoutAmount(0);
		setPracticeMemo("");
		setPracticeMessage("実践結果をクリアしました");
	};

	return (
		<PageShell
			hideHero
			eyebrow=""
			title=""
			description=""
			contentMaxWidth="1680px"
			contentPaddingInline="24px"
			heroMaxWidth="1680px"
		>
			<style>
				{`

body:has(.prediction-page-root) {
	background: #eefbff;
}

#root:has(.prediction-page-root) {
	position: relative;
	min-height: 100vh;
	background: #eefbff;
}

#root:has(.prediction-page-root)::before {
	content: "";
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background-color: #eefbff;
	background-image:
		linear-gradient(180deg, rgba(238, 250, 253, 0.08) 0%, rgba(246, 252, 255, 0.12) 46%, rgba(230, 248, 247, 0.18) 100%),
		url("${predictionPageBackgroundImageSrc}");
	background-size: cover;
	background-position: center top;
	background-repeat: no-repeat;
}

.prediction-page-root {
	position: relative;
	z-index: 1;
	isolation: auto;
	display: grid;
	gap: 22px;
	padding-top: 22px;
	padding-bottom: 36px;
}

#root:has(.prediction-page-root) > div {
	z-index: 1;
	background: transparent !important;
}

#root:has(.prediction-page-root) main {
	position: relative;
	z-index: 1;
}

.prediction-page-root > * {
	position: relative;
	z-index: 1;
}

					.prediction-page-main-panels {
						display: grid;
						grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
						gap: 18px;
						align-items: start;
						width: 100%;
						max-width: 100%;
						min-width: 0;
						box-sizing: border-box;
					}

					.prediction-hero-card,
					.prediction-section-card {
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: rgba(255, 255, 255, 0.94);
						box-shadow: 0 24px 54px rgba(80, 64, 120, 0.08);
					}

					.prediction-hero-card {
						padding: 28px;
						border-radius: 34px;
					}

					.prediction-hero-grid {
						display: grid;
						grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
						gap: 28px;
						align-items: center;
					}

					.prediction-hero-copy {
						display: grid;
						gap: 14px;
						align-content: center;
					}

					.prediction-hero-image {
						position: relative;
						min-height: 320px;
						border-radius: 28px;
						overflow: hidden;
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: linear-gradient(135deg, rgba(236, 232, 255, 0.86), rgba(247, 252, 255, 0.98));
						box-shadow: 0 18px 38px rgba(80, 64, 120, 0.12);
					}

					.prediction-hero-img {
						display: block;
						width: 100%;
						height: 100%;
						min-height: 320px;
						object-fit: cover;
						object-position: center;
					}

					.prediction-eyebrow {
						margin: 0;
						font-size: 0.72rem;
						font-weight: 900;
						letter-spacing: 0.24em;
						color: #9f89d8;
						text-transform: uppercase;
					}

					.prediction-hero-title {
						margin: 0;
						font-size: clamp(2.4rem, 4vw, 4.2rem);
						line-height: 1.05;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-text {
						margin: 0;
						font-size: 0.9rem;
						line-height: 1.8;
						color: #60788a;
					}

					.prediction-update-meta {
						display: inline-flex;
						width: fit-content;
						padding: 8px 12px;
						border-radius: 999px;
						background: rgba(240, 248, 253, 0.94);
						border: 1px solid rgba(93, 199, 232, 0.18);
						color: #2c7fa3;
						font-size: 0.78rem;
						font-weight: 800;
					}

					.prediction-stats-grid {
						display: grid;
						grid-template-columns: repeat(4, minmax(0, 1fr));
						gap: 16px;
					}

					.prediction-stat-card {
						padding: 20px;
						border-radius: 24px;
						background: rgba(255, 255, 255, 0.96);
						border: 1px solid rgba(176, 137, 216, 0.18);
						box-shadow: 0 14px 30px rgba(80, 64, 120, 0.06);
						display: grid;
						gap: 10px;
					}

					.prediction-stat-value {
						margin: 0;
						font-size: 1.55rem;
						line-height: 1.1;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-stat-description {
						margin: 0;
						font-size: 0.8rem;
						line-height: 1.6;
						color: #60788a;
					}

					.prediction-section-card {
						padding: 24px;
						border-radius: 30px;
						display: grid;
						gap: 18px;
					}

					.prediction-section-header {
						display: flex;
						align-items: flex-start;
						justify-content: space-between;
						gap: 16px;
						flex-wrap: wrap;
					}

					.prediction-section-title {
						margin: 0;
						font-size: 2rem;
						line-height: 1.15;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-count-pill {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						min-width: 64px;
						padding: 10px 14px;
						border-radius: 999px;
						background: rgba(176, 137, 216, 0.14);
						color: #8a70d2;
						font-size: 0.82rem;
						font-weight: 900;
					}

					.prediction-notification-grid {
						position: relative;
						overflow: hidden;
						padding: 2px 0 6px;
						mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
					}

					.prediction-notification-track {
						display: flex;
						width: max-content;
						gap: 12px;
						animation: predictionNotificationMarquee 34s linear infinite;
						will-change: transform;
					}

					.prediction-notification-grid:hover .prediction-notification-track {
						animation-play-state: paused;
					}

					.prediction-notification-card {
						width: 260px;
						flex: 0 0 260px;
						min-width: 0;
						padding: 14px;
						border-radius: 20px;
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: rgba(250, 247, 255, 0.9);
						display: grid;
						gap: 10px;
					}

					@keyframes predictionNotificationMarquee {
						from {
							transform: translateX(0);
						}

						to {
							transform: translateX(calc(-50% - 6px));
						}
					}

					.prediction-notification-top {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 10px;
					}

					.prediction-badge {
						display: inline-flex;
						width: fit-content;
						align-items: center;
						justify-content: center;
						padding: 5px 10px;
						border-radius: 999px;
						background: rgba(176, 137, 216, 0.16);
						color: #8a70d2;
						font-size: 0.7rem;
						font-weight: 900;
					}

					.prediction-quick-head {
						display: grid;
						grid-template-columns: minmax(0, 1fr) auto;
						gap: 18px;
						align-items: start;
					}

					.prediction-current-card {
						min-width: 190px;
						padding: 18px 20px;
						border-radius: 22px;
						border: 1px solid rgba(176, 137, 216, 0.24);
						background: rgba(250, 247, 255, 0.92);
						display: grid;
						gap: 8px;
					}

					.prediction-current-value {
						margin: 0;
						font-size: 1.18rem;
						line-height: 1.25;
						font-weight: 900;
						color: #132f45;
					}

					@media (max-width: 1200px) {
						.prediction-hero-grid {
							grid-template-columns: 1fr;
						}

						.prediction-stats-grid {
							grid-template-columns: repeat(2, minmax(0, 1fr));
						}
					}

					@media (max-width: 900px) {


						.prediction-page-root {
							padding-top: 14px;
						}

						.prediction-page-main-panels {
							grid-template-columns: 1fr;
						}

						.prediction-stats-grid {
							grid-template-columns: 1fr;
						}

						.prediction-quick-head {
							grid-template-columns: 1fr;
						}

						.prediction-hero-card,
						.prediction-section-card {
							padding: 18px;
							border-radius: 24px;
						}

						.prediction-hero-image,
						.prediction-hero-img {
							min-height: 220px;
						}
					}
				`}
			</style>

			<div className="prediction-page-root">
				<section className="prediction-hero-card">
					<div className="prediction-hero-grid">
						<div className="prediction-hero-copy">
							<p className="prediction-eyebrow">PREDICTION</p>
							<h1 className="prediction-hero-title">今日の予想を考える</h1>
							<p className="prediction-text">
								会場特徴・天気・出走表・展示・オッズをまとめ、GPTへそのまま渡せる予想素材を整えるページです。
							</p>

							{dataUpdatedAt ? (
								<p className="prediction-update-meta">
									基本データ更新：{formatJstDateTimeLabel(dataUpdatedAt)}
								</p>
							) : null}

							{isRefreshingFeed || refreshMessage ? (
								<p className="prediction-text">
									{isRefreshingFeed ? "最新データを確認中です。" : refreshMessage}
								</p>
							) : null}
						</div>

						<div className="prediction-hero-image">
							<img src={predictionHeroImageSrc} alt={predictionHeroImageAlt} className="prediction-hero-img" />
						</div>
					</div>
				</section>

				<div className="prediction-stats-grid">
					{heroStats.map((item) => (
						<article key={item.eyebrow} className="prediction-stat-card">
							<p className="prediction-eyebrow">{item.eyebrow}</p>
							<p className="prediction-stat-value">{item.value}</p>
							<p className="prediction-stat-description">{item.description}</p>
						</article>
					))}
				</div>

				<section className="prediction-section-card">
					<div className="prediction-section-header">
						<div>
							<p className="prediction-eyebrow">HIT NOTIFICATIONS</p>
							<h2 className="prediction-section-title">的中通知ログ</h2>
							<p className="prediction-text">
								的中したレースを自動で記録していく想定のエリアです。将来は通知ログ・Slack通知・PWA通知の土台にします。
							</p>
						</div>

						<span className="prediction-count-pill">{hitNotificationItems.length}件</span>
					</div>

					<div className="prediction-notification-grid">
						<div className="prediction-notification-track">
							{hitNotificationLoopItems.map((item, index) => (
								<article key={`${item.title}-${index}`} className="prediction-notification-card">
									<div className="prediction-notification-top">
										<strong style={{ color: "#132f45", fontSize: "0.92rem" }}>{item.title}</strong>
										<span className="prediction-badge">{item.badge}</span>
									</div>

									<p className="prediction-text">{item.meta}</p>

									<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
										<span className="prediction-badge">{item.result}</span>
										<span className="prediction-badge">{item.payout}</span>
									</div>

									<p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 900, color: "#5575d9" }}>
										{item.profit}
									</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<section className="prediction-section-card">
					<div className="prediction-quick-head">
						<div>
							<p className="prediction-eyebrow">QUICK SELECT</p>
							<h2 className="prediction-section-title">会場とレースを選ぶ</h2>
							<p className="prediction-text">
								会場とレースを選び、そのまま下の予想素材確認へ進めます。
							</p>
						</div>

						<div className="prediction-current-card">
							<p className="prediction-eyebrow">CURRENT</p>
							<p className="prediction-current-value">{currentSelectionLabel}</p>
							<p className="prediction-text">{currentSelectionMeta}</p>
							<span className="prediction-badge" style={{ marginTop: "8px" }}>{venueFeatureStatusLabel}</span>
						</div>
					</div>

					<BoatPredictionVenueRaceChooser
						venues={venues}
						selectedVenueId={selectedVenueId}
						selectedRaceId={selectedRaceId}
						onSelectVenue={handleSelectVenue}
						onSelectRace={handleSelectRace}
					/>
				</section>

				<div className={panelGridClassName}>
					<BoatGptMaterialPanel materialText={materialText} raceLabel={raceLabel} />
					<div style={{ display: "grid", gap: "10px" }}>
						{savedMessage ? <p style={savedMessageStyle}>{savedMessage}</p> : null}
						<BoatPredictionPastePanel
							value={predictionText}
							raceLabel={raceLabel}
							tickets={parsedTickets}
							savedAt={savedPredictionRecord?.savedAt}
							isSaved={Boolean(savedPredictionRecord && savedPredictionRecord.predictionText === predictionText)}
							onSave={handleSavePrediction}
							onChange={setPredictionText}
							onClear={handleClearPrediction}
						/>
					</div>
				</div>

				{practiceMessage ? <p style={practiceMessageStyle}>{practiceMessage}</p> : null}
				<BoatPracticeResultPanel
					venueName={selectedVenue?.venueName ?? "-"}
					raceNo={selectedRace?.raceNo ?? 0}
					raceTitle={selectedRace?.title}
					tickets={parsedTickets}
					savedAt={savedPracticeResultRecord?.savedAt}
					isSaved={Boolean(savedPracticeResultRecord)}
					onSave={handleSavePracticeResult}
					onClear={handleClearPracticeResult}
					actualFinishOrderText={actualFinishOrderText}
					investmentAmount={investmentAmount}
					payoutAmount={payoutAmount}
					practiceMemo={practiceMemo}
					onChangeFinishOrder={setActualFinishOrderText}
					onChangeInvestmentAmount={setInvestmentAmount}
					onChangePayoutAmount={setPayoutAmount}
					onChangePracticeMemo={setPracticeMemo}
				/>
			</div>
		</PageShell>
	);
}
