import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
// Import pages (will be created soon)
import Home from './pages/Home';
import MatchSetup from './pages/MatchSetup';
import LiveScoring from './pages/LiveScoring';
import MatchSummary from './pages/MatchSummary';
import PlayerAnalytics from './pages/PlayerAnalytics';
import Settings from './pages/Settings';
import Leaderboard from './pages/Leaderboard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="setup" element={<MatchSetup />} />
        <Route path="scoring/:matchId" element={<LiveScoring />} />
        <Route path="summary/:matchId" element={<MatchSummary />} />
        <Route path="analytics" element={<PlayerAnalytics />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
