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
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function App() {
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);

  useEffect(() => {
    initSyncService();
    const cleanup = initRealtimeService();

    // Check for weekly backup (Sunday evening >= 17:00)
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() >= 17) {
      const lastBackup = localStorage.getItem('last_sunday_backup');
      const todayStr = now.toDateString();
      if (lastBackup !== todayStr) {
        setShowBackupPrompt(true);
      }
    }

    return () => cleanup();
  }, []);

  const handleWeeklyBackup = async () => {
    try {
      const { exportDataByMail } = await import('./utils/dataUtils');
      await exportDataByMail();
      localStorage.setItem('last_sunday_backup', new Date().toDateString());
      setShowBackupPrompt(false);
    } catch (error) {
      console.error("Backup failed", error);
    }
  };

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
          
          {showBackupPrompt && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Weekly DB Backup</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 leading-relaxed">
                  It's Sunday evening! Time to backup your CricSense database. Would you like to send this backup securely to your email now?
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setShowBackupPrompt(false)}
                    className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 bg-gray-100 active:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:active:bg-gray-600 transition-colors"
                  >
                    Skip
                  </button>
                  <button 
                    onClick={handleWeeklyBackup}
                    className="flex-[1.5] py-3.5 rounded-xl font-bold text-white bg-blue-600 active:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
                  >
                    Send Email Backup
                  </button>
                </div>
              </div>
            </div>
          )}
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
