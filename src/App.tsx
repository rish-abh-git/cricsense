import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
// Import pages
import Home from './pages/Home';
import MatchSetup from './pages/MatchSetup';
import LiveScoring from './pages/LiveScoring';
import MatchSummary from './pages/MatchSummary';
import PlayerAnalytics from './pages/PlayerAnalytics';
import Settings from './pages/Settings';
import Leaderboard from './pages/Leaderboard';
import PlayerCompare from './pages/PlayerCompare';
import WatchLive from './pages/WatchLive';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import Attendance from './pages/Attendance';
import SyncFeedback from './components/SyncFeedback';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initSyncService } from './database/syncService';
import { initRealtimeService } from './database/realtimeService';
import Login from './pages/Login';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function App() {
  useEffect(() => {
    initSyncService();
    const cleanup = initRealtimeService();
    return () => cleanup();
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SyncFeedback />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="setup" element={<ProtectedRoute><MatchSetup /></ProtectedRoute>} />
              <Route path="scoring/:matchId" element={<LiveScoring />} />
              <Route path="summary/:matchId" element={<MatchSummary />} />
              <Route path="live/:matchId" element={<WatchLive />} />
              <Route path="analytics" element={<PlayerAnalytics />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="compare" element={<PlayerCompare />} />
              <Route path="attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
