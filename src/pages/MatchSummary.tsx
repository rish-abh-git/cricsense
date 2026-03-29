import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import Button from '../components/Button';
import Card from '../components/Card';
import { Share2, Home, MessageSquareQuote, Trash2, Edit2 } from 'lucide-react';
import { generateBallWiseSummary } from '../utils/shareUtils';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../database/supabaseClient';
import type { Ball, ExtraType, WicketType } from '../database/schema';
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
  const { isAdmin } = useAuth();

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

  const [editingBall, setEditingBall] = React.useState<Ball | null>(null);
  const [editScore, setEditScore] = React.useState<number>(0);
  const [editExtra, setEditExtra] = React.useState<ExtraType>('none');
  const [editIsWicket, setEditIsWicket] = React.useState(false);
  const [editWicketType, setEditWicketType] = React.useState<WicketType>('none');
  const [showEditInningsModal, setShowEditInningsModal] = React.useState(false);

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const { chartData, topScorer, bestBowler, stats, summaryText } = useMemo(() => {
    if (!match || !innings || !balls || !players) return { chartData: null, topScorer: null, bestBowler: null, stats: null, summaryText: '' };

    // Calculate Winner
    const i1 = innings.find(i => i.innings_number === 1);
    const i2 = innings.find(i => i.innings_number === 2);

    let winnerText = 'Draw / Pending';

    if (match.status === 'completed' || (i2 && (i2.runs > i1!.runs || i2.wickets >= 10 || i2.overs >= match.overs))) {
       if (match.winner) {
         winnerText = `${match.winner} won the match`;
       } else if (i1 && i2) {
         if (i1.runs > i2.runs) winnerText = `${i1.batting_team} won by ${i1.runs - i2.runs} runs`;
         else if (i2.runs > i1.runs) winnerText = `${i2.batting_team} won by ${10 - i2.wickets} wickets`;
         else winnerText = 'Match Tied';
       }
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
      `${winnerText}\n\n`;

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
      stats: { dotPct: Math.round((totalDots / (totalLegalBalls || 1)) * 100), bndPct: Math.round((totalBoundaries / (totalLegalBalls || 1)) * 100), winner: winnerText },
      summaryText: sText
    };
  }, [match, innings, balls, players]);

  if (!match || !innings || !balls) return (
    <div className="p-4 flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center mb-4 animate-pulse">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">CricSense</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-600 font-medium mt-8 opacity-50">Made by Rishabh Masani</p>
    </div>
  );

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
                        <button 
                          onClick={isAdmin ? () => {
                            setEditingBall(b);
                            setEditScore(b.runs);
                            setEditExtra(b.extra_type || 'none');
                            setEditIsWicket(b.is_wicket || false);
                            setEditWicketType(b.wicket_type || 'none');
                          } : undefined} 
                          className={`text-xs ${tColor} ${isAdmin ? 'active:scale-95 transition-transform cursor-pointer font-bold' : ''}`}
                        >
                          {lbl}
                        </button>
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

  const handleDeleteMatch = () => {
    setModalConfig({
      isOpen: true,
      title: 'Permanently Delete Match?',
      message: 'This will delete the match, all innings, and all ball records. This cannot be undone.',
      confirmLabel: 'Delete Forever',
      type: 'danger',
      onConfirm: async () => {
        // Delete balls
        const matchInnings = await db.innings.where('match_id').equals(matchId!).toArray();
        const inningsIds = matchInnings.map(i => i.id);
        for (const iId of inningsIds) {
          const inningsBalls = await db.balls.where('innings_id').equals(iId).toArray();
          await db.balls.bulkDelete(inningsBalls.map(b => b.id));
          // Non-blocking cloud delete
          if (inningsBalls.length > 0) {
            supabase.from('balls').delete().in('id', inningsBalls.map(b => b.id)).then();
          }
        }
        // Delete innings
        await db.innings.bulkDelete(inningsIds);
        if (inningsIds.length > 0) {
          supabase.from('innings').delete().in('id', inningsIds).then();
        }
        // Delete match
        await db.matches.delete(matchId!);
        supabase.from('matches').delete().eq('id', matchId!).then();

        showToast('Match deleted', 'success');
        navigate('/');
      }
    });
  };

  const saveEditedBall = async () => {
    if (!editingBall) return;
    const oldRuns = editingBall.runs;
    const oldExtraRuns = editingBall.extra_runs || 0;
    const oldWicket = editingBall.is_wicket ? 1 : 0;
    const oldLegal = (editingBall.extra_type !== 'wide' && editingBall.extra_type !== 'no_ball') ? 1 : 0;

    let newExtraRuns = 0;
    if (editExtra === 'wide' || editExtra === 'no_ball') newExtraRuns = 1;

    const newWicket = editIsWicket ? 1 : 0;
    const newLegal = (editExtra !== 'wide' && editExtra !== 'no_ball') ? 1 : 0;

    const runDiff = (editScore + newExtraRuns) - (oldRuns + oldExtraRuns);
    const wicketDiff = newWicket - oldWicket;
    const legalDiff = newLegal - oldLegal;

    await db.balls.update(editingBall.id, {
        runs: editScore,
        extra_type: editExtra,
        extra_runs: newExtraRuns,
        is_wicket: editIsWicket,
        wicket_type: editWicketType
    });

    const inn = await db.innings.get(editingBall.innings_id);
    if (inn) {
        const newBallsBowled = Math.max(0, inn.balls_bowled + legalDiff);
        await db.innings.update(inn.id, {
            runs: Math.max(0, inn.runs + runDiff),
            wickets: Math.max(0, inn.wickets + wicketDiff),
            balls_bowled: newBallsBowled,
            overs: Math.floor(newBallsBowled / 6) + (newBallsBowled % 6) / 10
        });
    }

    setEditingBall(null);
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <Card className="relative p-5 text-center bg-gradient-to-br from-primary-600 to-primary-700 text-white border-0 shadow-lg shadow-primary-500/30">
        {isAdmin && (
           <button 
             onClick={() => setShowEditInningsModal(true)}
             className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
           >
             <Edit2 size={16} />
           </button>
        )}
        <h2 className="text-sm font-bold opacity-80 uppercase tracking-wider mb-2">Match Summary</h2>

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
      {isAdmin && (
        <div className="grid grid-cols-1 gap-2 pt-4 border-t dark:border-gray-700">
          <Button variant="ghost" onClick={handleDeleteMatch} className="flex gap-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
            <Trash2 size={18} /> Delete Match
          </Button>
        </div>
      )}

      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        onConfirm={modalConfig.onConfirm}
        type={modalConfig.type}
      />

      {editingBall && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="full max-w-sm p-5 w-full">
            <h3 className="text-xl font-bold mb-4">Edit Ball</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Runs (Batter)</label>
                <input 
                  type="number" 
                  value={editScore} 
                  onChange={(e) => setEditScore(parseInt(e.target.value) || 0)}
                  className="w-full mt-1 p-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700" 
                />
              </div>

              <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">Extra Type</label>
                 <select 
                    value={editExtra} 
                    onChange={(e) => setEditExtra(e.target.value as ExtraType)}
                    className="w-full mt-1 p-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                 >
                    <option value="none">None</option>
                    <option value="wide">Wide</option>
                    <option value="no_ball">No Ball</option>
                    <option value="bye">Bye</option>
                    <option value="leg_bye">Leg Bye</option>
                 </select>
              </div>

              <div className="flex items-center gap-2">
                 <input 
                    type="checkbox" 
                    id="isWicket" 
                    checked={editIsWicket} 
                    onChange={(e) => setEditIsWicket(e.target.checked)} 
                    className="w-5 h-5"
                 />
                 <label htmlFor="isWicket" className="font-bold">Is Wicket?</label>
              </div>

              {editIsWicket && (
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Wicket Type</label>
                    <select 
                       value={editWicketType} 
                       onChange={(e) => setEditWicketType(e.target.value as WicketType)}
                       className="w-full mt-1 p-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                    >
                       <option value="caught">Caught</option>
                       <option value="bowled">Bowled</option>
                       <option value="run_out">Run Out</option>
                       <option value="stumped">Stumped</option>
                       <option value="lbw">LBW</option>
                       <option value="hit_wicket">Hit Wicket</option>
                    </select>
                 </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
               <Button variant="ghost" onClick={() => setEditingBall(null)} fullWidth>Cancel</Button>
               <Button variant="primary" onClick={saveEditedBall} fullWidth>Save</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Match Totals Modal */}
      {showEditInningsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-5 animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <Edit2 size={20} className="text-primary-600"/> Edit Match
            </h3>
            
            <p className="text-sm text-gray-500 mb-6">Which innings would you like to edit? This will open the live scoring screen allowing you to adjust specific balls, wickets, or extra deliveries.</p>

            <div className="space-y-3">
              {innings.map((inn) => (
                <button
                   key={inn.id}
                   onClick={() => navigate(`/scoring/${match.id}`, { state: { editInningsNumber: inn.innings_number } })}
                   className="w-full text-left p-4 bg-gray-50 hover:bg-primary-50 dark:bg-gray-800 dark:hover:bg-primary-900/30 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors group"
                >
                   <div className="font-bold text-gray-900 dark:text-gray-50 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                      Innings {inn.innings_number}: {inn.batting_team}
                   </div>
                   <div className="text-sm font-medium text-gray-500">
                      {inn.runs}/{inn.wickets} ({inn.overs} ov)
                   </div>
                </button>
              ))}
            </div>

            <div className="mt-6">
               <Button variant="ghost" onClick={() => setShowEditInningsModal(false)} fullWidth>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MatchSummary;
