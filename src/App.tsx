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
import Attendance from './pages/Attendance';
import PlayerCompare from './pages/PlayerCompare';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="setup" element={<MatchSetup />} />
            <Route path="scoring/:matchId" element={<LiveScoring />} />
            <Route path="summary/:matchId" element={<MatchSummary />} />
            <Route path="analytics" element={<PlayerAnalytics />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="compare" element={<PlayerCompare />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
