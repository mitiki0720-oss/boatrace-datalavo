import { useEffect, useState } from "react";
import { SiteHeader } from "./components/layout/SiteHeader";
import { boatTheme } from "./lib/theme";
import { DashboardPage } from "./pages/DashboardPage";
import { MobilePage } from "./pages/MobilePage";
import { PredictionPage } from "./pages/PredictionPage";
import { RacesPage } from "./pages/RacesPage";
import { ReviewPage } from "./pages/ReviewPage";
import { VenueFeaturesPage } from "./pages/VenueFeaturesPage";

const DEFAULT_HASH = "#dashboard-page";

const pageMap = {
  "#dashboard-page": DashboardPage,
  "#races-page": RacesPage,
  "#prediction-page": PredictionPage,
  "#review-page": ReviewPage,
  "#venue-features-page": VenueFeaturesPage,
  "#mobile-page": MobilePage,
} as const;

type PageHash = keyof typeof pageMap;

function normalizeHash(hash: string): PageHash {
  if (hash in pageMap) {
    return hash as PageHash;
  }

  return DEFAULT_HASH;
}

const appStyle = {
  minHeight: "100vh",
  background: boatTheme.background.canvas,
  color: boatTheme.colors.ink,
};

const bodyStyle = {
  width: "min(1180px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "24px 0 56px",
};

export default function App() {
  const [currentHash, setCurrentHash] = useState<PageHash>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_HASH;
    }

    return normalizeHash(window.location.hash);
  });

  useEffect(() => {
    const syncHash = () => {
      const nextHash = normalizeHash(window.location.hash);

      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
        return;
      }

      setCurrentHash(nextHash);
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  const CurrentPage = pageMap[currentHash];

  return (
    <div style={appStyle}>
      <SiteHeader currentHash={currentHash} />
      <main style={bodyStyle}>
        <CurrentPage />
      </main>
    </div>
  );
}