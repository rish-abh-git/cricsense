import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import Button from '../components/Button';
import Card from '../components/Card';
import { Share2, Home, MessageSquareQuote, Trash2 } from 'lucide-react';
import { generateBallWiseSummary } from '../utils/shareUtils';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import type { Ball } from '../database/schema';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const MatchSummary: React.FC = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const match = useLiveQuery(() => db.matches.get(matchId || ''));
  const innings = useLiveQuery(() => db.innings.where('match_id').equals(matchId || '').toArray());
  const balls = useLiveQuery(() => db.balls.toArray());
  const players = useLiveQuery(() => db.players.toArray());

  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean,
    title: string,
    message: string,
    confirmLabel?: string,
    onConfirm?: () => void,
    type?: 'danger' | 'info' | 'success'
  }>({ isOpen: false, title: '', message: '' });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const { chartData, topScorer, bestBowler, stats, summaryText } = useMemo(() => {
    if (!match || !innings || !balls || !players) return { chartData: null, topScorer: null, bestBowler: null, stats: null, summaryText: '' };

    // Calculate Winner
    const i1 = innings.find(i => i.innings_number === 1);
    const i2 = innings.find(i => i.innings_number === 2);

    let winner = 'Draw / Pending';
    if (i1 && i2 && match.status === 'completed') {
      if (i1.runs > i2.runs) winner = `${i1.batting_team} won by ${i1.runs - i2.runs} runs`;
      else if (i2.runs > i1.runs) winner = `${i2.batting_team} won by ${10 - i2.wickets} wickets`;
      else winner = 'Match Tied';
    }

    // Top Scorer
    const batsmanStats = new Map<string, { runs: number, balls: number, fours: number, sixes: number }>();
    const bowlerStats = new Map<string, { wickets: number, runs: number, legalBalls: number, dots: number }>();
    let totalDots = 0;
    let totalBoundaries = 0;
    let totalLegalBalls = 0;

    const mBalls = balls.filter(b => innings.some(i => i.id === b.innings_id));

    mBalls.forEach(b => {
      // Batter stats
      const bStat = batsmanStats.get(b.batsman_id) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
      bStat.runs += b.runs;
      if (b.extra_type !== 'wide') bStat.balls += 1;
      if (b.runs === 4) bStat.fours += 1;
      if (b.runs === 6) bStat.sixes += 1;
      batsmanStats.set(b.batsman_id, bStat);

      // Bowler stats
      if (b.bowler_id) {
         const blStat = bowlerStats.get(b.bowler_id) || { wickets: 0, runs: 0, legalBalls: 0, dots: 0 };
         blStat.runs += b.runs + b.extra_runs;
         if (b.is_wicket && b.wicket_type !== 'run_out') blStat.wickets += 1;
         if (b.extra_type !== 'wide' && b.extra_type !== 'no_ball') blStat.legalBalls += 1;
         if (b.runs === 0 && !b.is_wicket && b.extra_type === 'none') blStat.dots += 1;
         bowlerStats.set(b.bowler_id, blStat);
      }

      // Team analytics
      if (b.extra_type !== 'wide' && b.extra_type !== 'no_ball') totalLegalBalls++;
      if (b.runs === 0 && !b.is_wicket && b.extra_type === 'none') totalDots++;
      if (b.runs === 4 || b.runs === 6) totalBoundaries++;
    });

    let topSm = { id: '', runs: -1, balls: 0 };
    batsmanStats.forEach((stat, id) => {
      if (stat.runs > topSm.runs) { topSm = { id, ...stat }; }
    });

    let bestBm = { id: '', wickets: -1, runs: 999 };
    bowlerStats.forEach((stat, id) => {
      if (stat.wickets > bestBm.wickets || (stat.wickets === bestBm.wickets && stat.runs < bestBm.runs)) {
        bestBm = { id, ...stat };
      }
    });

    const tsPlayer = players.find(p => p.id === topSm.id);
    const bbPlayer = players.find(p => p.id === bestBm.id);

    // Chart logic
    const overLabels = Array.from({ length: match.overs }, (_, i) => `Over ${i + 1}`);
    const team1Data = new Array(match.overs).fill(0);
    const team2Data = new Array(match.overs).fill(0);

    if (i1) {
      mBalls.filter(b => b.innings_id === i1.id && b.over_number < match.overs).forEach(b => {
        team1Data[b.over_number] += (b.runs + b.extra_runs);
      });
    }
    if (i2) {
      mBalls.filter(b => b.innings_id === i2.id && b.over_number < match.overs).forEach(b => {
        team2Data[b.over_number] += (b.runs + b.extra_runs);
      });
    }

    const cdata = {
      labels: overLabels,
      datasets: [
        { label: i1?.batting_team || 'Team 1', data: team1Data, backgroundColor: '#3b82f6' },
        ...(i2 ? [{ label: i2.batting_team, data: team2Data, backgroundColor: '#10b981' }] : [])
      ]
    };

    let sText = `🏆 Match Result\n\n` +
      `${i1?.batting_team}: ${i1?.runs}/${i1?.wickets} (${i1?.overs.toFixed(1)} ov)\n` +
      `${i2 ? `${i2.batting_team}: ${i2.runs}/${i2.wickets} (${i2.overs.toFixed(1)} ov)\n` : ''}\n` +
      `${winner}\n\n`;

    sText += `🏏 Batting:\n`;
    batsmanStats.forEach((stat, id) => {
      const p = players.find(x => x.id === id);
      if (p && stat.balls > 0) {
        sText += `- ${p.name}: ${stat.runs} (${stat.balls}) [4s:${stat.fours} 6s:${stat.sixes}]\n`;
      }
    });

    sText += `\n🎯 Bowling:\n`;
    bowlerStats.forEach((stat, id) => {
      const p = players.find(x => x.id === id);
      if (p && (stat.legalBalls > 0 || stat.runs > 0)) {
        const ovs = Math.floor(stat.legalBalls / 6) + (stat.legalBalls % 6) / 10;
        sText += `- ${p.name}: ${stat.wickets}/${stat.runs} (${ovs.toFixed(1)} ov) [Dots:${stat.dots}]\n`;
      }
    });

    sText += `\n📊 Extras & Info:\n` +
      `Dot Balls: ${Math.round((totalDots / Math.max(1, totalLegalBalls)) * 100)}% | Boundaries: ${Math.round((totalBoundaries / Math.max(1, totalLegalBalls)) * 100)}%`;

    return {
      chartData: cdata,
      topScorer: tsPlayer ? `${tsPlayer.name} ${topSm.runs} (${topSm.balls})` : '-',
      bestBowler: bbPlayer ? `${bbPlayer.name} ${bestBm.wickets}/${bestBm.runs}` : '-',
      stats: { dotPct: Math.round((totalDots / (totalLegalBalls || 1)) * 100), bndPct: Math.round((totalBoundaries / (totalLegalBalls || 1)) * 100), winner },
      summaryText: sText
    };
  }, [match, innings, balls, players]);

  if (!match || !innings || !balls) return <div className="p-4 flex justify-center mt-10">Loading summary...</div>;

  const getBallTextDisplay = (b: Ball) => {
    let lbl = b.runs.toString();
    let color = 'text-gray-600 dark:text-gray-300';
    if (b.extra_type === 'wide') { lbl = b.runs > 0 ? `${b.runs}Wd` : 'Wd'; }
    else if (b.extra_type === 'no_ball') { lbl = b.runs > 0 ? `${b.runs}Nb` : 'Nb'; }
    else if (b.is_wicket) { lbl = 'W'; color = 'text-red-600 font-bold'; }
    else if (b.runs === 4) { color = 'text-blue-600 font-bold'; }
    else if (b.runs === 6) { color = 'text-primary-600 font-bold'; }
    else if (b.runs === 0) { lbl = '•'; }
    return { lbl, color };
  };

  const renderOverSummary = (inn: typeof innings[0]) => {
    const innBalls = balls?.filter(b => b.innings_id === inn.id) || [];
    if (innBalls.length === 0) return null;
    innBalls.sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      return a.ball_number - b.ball_number;
    });

    return (
      <div className="mb-4">
        <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-2">{inn.batting_team} Innings</h4>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: Math.max(1, Math.ceil(inn.overs)) }).map((_, idx) => {
            const overNumber = idx;
            const overBalls = innBalls.filter(b => b.over_number === overNumber);
            if (overBalls.length === 0) return null;
            const runsInOver = overBalls.reduce((acc, b) => acc + b.runs + b.extra_runs, 0);

            return (
              <div key={idx} className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
                <div className="w-6 h-6 rounded-full bg-primary-50 text-primary-700 font-bold flex items-center justify-center text-xs">
                  {idx + 1}
                </div>
                <div className="flex gap-1 items-center">
                  {overBalls.map((b, bIdx) => {
                    const { lbl, color: tColor } = getBallTextDisplay(b);
                    return (
                      <React.Fragment key={b.id}>
                        {bIdx > 0 && <span className="text-gray-300 text-xs">·</span>}
                        <span className={`text-xs ${tColor}`}>{lbl}</span>
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="text-xs font-bold text-gray-900 dark:text-gray-50 bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded ml-1">{runsInOver}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CricSense Match Summary',
          text: summaryText,
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      // Fallback
      window.location.href = `whatsapp://send?text=${encodeURIComponent(summaryText)}`;
    }
  };

  const handleExportChatGPT = async () => {
    const detailedText = await generateBallWiseSummary([matchId!]);
    const chatGPTText = `Analyze this cricket match record from CricSense:\n\n` +
      `${detailedText}\n\n` +
      `Match Summary:\n${summaryText}\n\n` +
      `Match Context:\n` +
      `- Played on: ${new Date(match.date).toLocaleDateString()}\n` +
      `- Format: ${match.overs} overs match\n\n` +
      `Please provide a breakdown of player performances, key turning points, and detailed stats (dots, boundaries faced).`;

    navigator.clipboard.writeText(chatGPTText).then(() => {
      showToast('Detailed match data copied for ChatGPT!', 'success');
    });
  };

  const handleArchiveMatch = () => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Match?',
      message: 'This match will be hidden from your home screen, but its data will be kept in the database if you ever need to re-fetch it. Permanent deletion is not recommended if you want to keep history.',
      confirmLabel: 'Delete (Archive)',
      type: 'danger',
      onConfirm: async () => {
        await db.matches.update(matchId!, { is_archived: true });
        showToast('Match archived successfully', 'success');
        navigate('/');
      }
    });
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <Card className="p-5 text-center bg-gradient-to-br from-primary-600 to-primary-700 text-white border-0 shadow-lg shadow-primary-500/30">
        <h2 className="text-xl font-bold mb-4 opacity-90">Match Result</h2>

        {innings.map(inn => (
          <div key={inn.id} className="flex justify-between items-center mb-2 px-2">
            <span className="font-semibold text-lg">{inn.batting_team}</span>
            <span className="font-black text-2xl">{inn.runs}<span className="text-base text-primary-200">/{inn.wickets}</span> <span className="text-xs text-primary-200 font-medium">({inn.overs.toFixed(1)})</span></span>
          </div>
        ))}

        <div className="mt-4 pt-3 border-t border-primary-500/50">
          <p className="font-bold text-lg text-amber-300">{stats?.winner}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 flex items-center gap-1">⭐ Top Scorer</p>
          <p className="font-semibold text-gray-900 dark:text-gray-50">{topScorer}</p>
        </Card>
        <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 flex items-center gap-1">🎯 Best Bowler</p>
          <p className="font-semibold text-gray-900 dark:text-gray-50">{bestBowler}</p>
        </Card>
      </div>

      <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm">
        <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-4">Runs per Over</h3>
        <div className="h-48">
          {chartData && (
            <Bar
              data={chartData}
              options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { position: 'bottom' } } }}
            />
          )}
        </div>
      </Card>

      <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm">
        <div className="mb-2">
          <p className="font-bold text-gray-900 dark:text-gray-50 uppercase mb-2">Over-wise Summary</p>
          {innings.slice().sort((a,b) => a.innings_number - b.innings_number).map(inn => (
            <div key={inn.id}>
              {renderOverSummary(inn)}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Dot Balls</p>
          <p className="text-2xl font-black text-gray-800 dark:text-gray-100">{stats?.dotPct}%</p>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Boundaries</p>
          <p className="text-2xl font-black text-primary-600">{stats?.bndPct}%</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Button variant="outline" onClick={handleExportChatGPT} className="flex gap-2.5 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <MessageSquareQuote size={18} className="text-primary-600" /> Copy for ChatGPT Analysis
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 mt-4">
        <Button variant="primary" onClick={handleShare} className="flex justify-center gap-2.5 shadow-md shadow-primary-500/20">
          <Share2 size={18} /> Share Results
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 mt-2">
        <Button variant="secondary" onClick={() => navigate('/')} className="flex gap-2.5">
          <Home size={18} /> Back to Home
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 pt-4 border-t dark:border-gray-700">
        <Button variant="ghost" onClick={handleArchiveMatch} className="flex gap-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
          <Trash2 size={18} /> Delete Match (Keep Data)
        </Button>
      </div>

      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        onConfirm={modalConfig.onConfirm}
        type={modalConfig.type}
      />
    </div>
  );
};

export default MatchSummary;
