import { useEffect, useRef } from "react";
import { pruneBoatOperationalStorageOnce } from "../lib/boatOperationalStoragePrune";
import { getBoatReviewArchiveVerifiedDates, loadBoatReviewArchiveIndex } from "../lib/boatReviewArchive";

export function useBoatOperationalStorageRollover(): void {
	const runRef = useRef<Promise<unknown> | null>(null);

	useEffect(() => {
		if (typeof window === "undefined" || typeof document === "undefined") {
			return;
		}

		const runPrune = (reason: string) => {
			if (runRef.current) {
				return;
			}

			runRef.current = loadBoatReviewArchiveIndex()
				.then((index) => pruneBoatOperationalStorageOnce({
					reason,
					archiveVerifiedDates: getBoatReviewArchiveVerifiedDates(index),
				}))
				.catch((error) => {
					console.warn("[boat-operational-prune] browser prune failed", error);
					return pruneBoatOperationalStorageOnce({ reason, archiveVerifiedDates: [] });
				})
				.finally(() => {
					runRef.current = null;
				});
		};

		const runWhenVisible = (reason: string) => {
			if (document.visibilityState === "visible") {
				runPrune(reason);
			}
		};

		const handlePageShow = () => runPrune("pageshow");
		const handleFocus = () => runPrune("focus");
		const handleVisibilityChange = () => runWhenVisible("visibilitychange");

		runPrune("mount");
		window.addEventListener("pageshow", handlePageShow);
		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("pageshow", handlePageShow);
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);
}
