import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Toaster from "./components/Toaster";
import SplashScreen from "./components/SplashScreen";
import MusicPlayer from "./components/MusicPlayer";
import ReportBugButton from "./components/ReportBugButton";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Play from "./pages/Play";
import DashboardPage from "./pages/DashboardPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import GuidePage from "./pages/GuidePage";
import DocsPage from "./pages/DocsPage";
import EmpiresPage from "./pages/EmpiresPage";
import GovernancePage from "./pages/GovernancePage";
import AdminBugsPage from "./pages/AdminBugsPage";
import ChangelogPage from "./pages/ChangelogPage";
import SpectateView from "./game/SpectateView";
import MarketPage from "./pages/MarketPage";
import { useGame } from "./lib/store";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useGame((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const token = useGame((s) => s.token);
  const connect = useGame((s) => s.connect);
  const location = useLocation();

  // restore a live game connection on reload if we have a token
  useEffect(() => {
    if (token) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPlay = location.pathname.startsWith("/play");

  return (
    <div className="flex min-h-screen flex-col">
      <SplashScreen />
      <MusicPlayer />
      <ReportBugButton />
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/empires" element={<EmpiresPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/spectate" element={<SpectateView />} />
          <Route path="/marketplace" element={<MarketPage />} />
          <Route path="/market" element={<Navigate to="/marketplace" replace />} />
          <Route path="/admin" element={<AdminBugsPage />} />
          <Route
            path="/play"
            element={
              <ProtectedRoute>
                <Play />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isPlay && <Footer />}
      <Toaster />
    </div>
  );
}
