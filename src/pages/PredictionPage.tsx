import { useEffect, useMemo, useState } from "react";
import type { BoatPredictionRecord } from "../lib/boatraceTypes";
import { BoatGptMaterialPanel } from "../components/boatrace/BoatGptMaterialPanel";
import { BoatPracticeResultPanel } from "../components/boatrace/BoatPracticeResultPanel";
import { BoatPredictionPastePanel } from "../components/boatrace/BoatPredictionPastePanel";
import { BoatPredictionSummaryStrip } from "../components/boatrace/BoatPredictionSummaryStrip";
import { BoatPredictionVenueRaceChooser } from "../components/boatrace/BoatPredictionVenueRaceChooser";
import { PageShell } from "../components/layout/PageShell";
import { sampleBoatTodayFeed } from "../data/sampleBoatTodayFeed";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import { buildBoatPredictionMaterial } from "../lib/boatPredictionMaterial";
import { parseBoatPredictionTickets } from "../lib/boatPredictionParser";
import type { BoatPracticeResultRecord } from "../lib/boatPracticeResultStorage";
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

const updatedAtStyle = {
	margin: "-4px 0 2px",
	fontSize: "0.82rem",
	fontWeight: 700,
	color: "#6b8799",
};

const refreshPanelStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "14px",
	flexWrap: "wrap" as const,
	padding: "14px 16px",
	borderRadius: "18px",
	background: "rgba(247, 252, 255, 0.9)",
	border: "1px solid rgba(63, 132, 168, 0.14)",
	marginBottom: "4px",
};

const refreshButtonStyle = {
	padding: "10px 14px",
	borderRadius: "999px",
	border: "1px solid rgba(44, 91, 122, 0.18)",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(228, 244, 250, 0.96))",
	color: "#214c68",
	fontSize: "0.92rem",
	fontWeight: 700,
	cursor: "pointer",
};

const refreshHintStyle = {
	margin: 0,
	fontSize: "0.86rem",
	lineHeight: 1.6,
	color: "#6b8799",
};

const refreshMessageStyle = {
	margin: 0,
	fontSize: "0.82rem",
	fontWeight: 700,
	color: "#4f7084",
};

const getRaceKey = (venueId: string, raceId: string | undefined, raceNo: number) => raceId ?? `${venueId}-${raceNo}`;

export function PredictionPage() {
	const [todayFeed, setTodayFeed] = useState(sampleBoatTodayFeed);
	const [dataUpdatedAt, setDataUpdatedAt] = useState("");
	const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const races = todayFeed.venues.flatMap((venue) => venue.races);
	const initialVenue = todayFeed.venues[0];
	const initialRace = initialVenue?.races[0];
	const [selectedVenueId, setSelectedVenueId] = useState<string>(initialVenue?.id ?? "");
	const [selectedRaceId, setSelectedRaceId] = useState<string>(getRaceKey(initialVenue?.id ?? "", initialRace?.raceId, initialRace?.raceNo ?? 0));
	const [predictionText, setPredictionText] = useState<string>("");
	const [savedPredictionRecord, setSavedPredictionRecord] = useState<BoatPredictionRecord | undefined>(undefined);
	const [savedMessage, setSavedMessage] = useState<string>("");
	const [savedPracticeResultRecord, setSavedPracticeResultRecord] = useState<BoatPracticeResultRecord | undefined>(undefined);
	const [practiceMessage, setPracticeMessage] = useState<string>("");
	const [actualFinishOrderText, setActualFinishOrderText] = useState<string>("");
	const [investmentAmount, setInvestmentAmount] = useState<number>(1000);
	const [payoutAmount, setPayoutAmount] = useState<number>(0);
	const [practiceMemo, setPracticeMemo] = useState<string>("");
	const selectedVenue = todayFeed.venues.find((venue) => venue.id === selectedVenueId) ?? initialVenue;
	const selectedRace = selectedVenue?.races.find((race) => getRaceKey(selectedVenue.id, race.raceId, race.raceNo) === selectedRaceId) ?? selectedVenue?.races[0];
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
		? buildBoatPredictionMaterial({ venue: selectedVenue, race: selectedRace })
		: "レース情報が選択されていません。";
	const raceLabel = `${selectedVenue?.venueName ?? "-"} ${selectedRace ? `${selectedRace.raceNo}R` : "-"}`;
	const venueCount = todayFeed.venues.length;
	const raceCount = races.length;
	const racesWithRacers = races.filter((race) => (race.racers?.length ?? 0) > 0).length;
	const racesWithExhibitions = races.filter((race) => (race.exhibitions?.length ?? 0) > 0).length;
	const racesWithOdds = races.filter((race) => (race.oddsPreview?.length ?? 0) > 0).length;
	const confirmedRaceCount = races.filter((race) => race.result?.status === "confirmed").length;

	const refreshTodayFeed = async (options?: { silent?: boolean; isActive?: () => boolean }) => {
		const isSilent = options?.silent ?? false;

		if (!isSilent) {
			setIsRefreshingFeed(true);
			setRefreshMessage("最新データを読み込み中です...");
		}

		try {
			const result = await loadBoatTodayRaceDetailsFeed();

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
		const firstVenue = todayFeed.venues[0];
		const firstRace = firstVenue?.races[0];

		if (!firstVenue || !firstRace) {
			return;
		}

		const currentVenue = todayFeed.venues.find((venue) => venue.id === selectedVenueId);
		const currentRace = currentVenue?.races.find((race) => {
			const raceId = race.raceId || `${currentVenue.id}-${race.raceNo}`;
			return raceId === selectedRaceId;
		});

		if (!currentVenue || !currentRace) {
			setSelectedVenueId(firstVenue.id);
			setSelectedRaceId(firstRace.raceId || `${firstVenue.id}-${firstRace.raceNo}`);
		}
	}, [todayFeed, selectedVenueId, selectedRaceId]);

	const handleSelectVenue = (venueId: string) => {
		const venue = todayFeed.venues.find((item) => item.id === venueId);
		const firstRace = venue?.races[0];

		setSelectedVenueId(venueId);
		setSelectedRaceId(getRaceKey(venueId, firstRace?.raceId, firstRace?.raceNo ?? 0));
	};

	const handleSelectRace = (raceId: string) => {
		setSelectedRaceId(raceId);
	};

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
			eyebrow="PREDICTION NOTE"
			title="予想ノート"
			description="GPTへ渡す素材と、返ってきた予想を整理するためのページです。"
		>
			<style>
				{`.${panelGridClassName} { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 18px; align-items: start; }
				@media (max-width: 900px) { .${panelGridClassName} { grid-template-columns: 1fr; } }`}
			</style>
			<div style={refreshPanelStyle}>
				<div style={{ display: "grid", gap: "4px" }}>
					<p style={refreshHintStyle}>展示・天気・オッズが更新された generated JSON を再取得します。</p>
					{dataUpdatedAt ? <p style={updatedAtStyle}>Data updated: {dataUpdatedAt}</p> : null}
					{isRefreshingFeed ? <p style={refreshMessageStyle}>読み込み中...</p> : null}
					{!isRefreshingFeed && refreshMessage ? <p style={refreshMessageStyle}>{refreshMessage}</p> : null}
				</div>
				<button
					type="button"
					style={{
						...refreshButtonStyle,
						opacity: isRefreshingFeed ? 0.6 : 1,
						cursor: isRefreshingFeed ? "not-allowed" : "pointer",
					}}
					onClick={() => {
						void refreshTodayFeed();
					}}
					disabled={isRefreshingFeed}
				>
					🔄 最新データを再読み込み
				</button>
			</div>
				<BoatPredictionSummaryStrip
					venueCount={venueCount}
					raceCount={raceCount}
					racesWithRacers={racesWithRacers}
					racesWithExhibitions={racesWithExhibitions}
					racesWithOdds={racesWithOdds}
					confirmedRaceCount={confirmedRaceCount}
				/>

				<BoatPredictionVenueRaceChooser
					venues={todayFeed.venues}
					selectedVenueId={selectedVenueId}
					selectedRaceId={selectedRaceId}
					onSelectVenue={handleSelectVenue}
					onSelectRace={handleSelectRace}
				/>

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
		</PageShell>
	);
}