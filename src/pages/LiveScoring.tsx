import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { BallRepo, InningsRepo, MatchRepo } from '../database/repository';
import Button from '../components/Button';
import Card from '../components/Card';
import { Undo2, ArrowLeftRight, Pointer, X, RotateCcw } from 'lucide-react';
import type { WicketType, ExtraType, Ball } from '../database/schema';
import { PlayerRepo } from '../database/repository';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { formatOvers } from '../utils/dataUtils';
import { supabase } from '../database/supabaseClient';
import { mapMatchPayload } from '../database/syncUtils';

const WICKET_TYPES: WicketType[] = ['bowled', 'caught', 'run_out', 'stumped', 'lbw', 'hit_wicket'];

const LiveScoring: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAdmin } = useAuth();

  const match = useLiveQuery(() => db.matches.get(matchId || ''));
  const allPlayers = useLiveQuery(() => db.players.toArray()) || [];
  const inningsList = useLiveQuery(() => db.innings.where('match_id').equals(matchId || '').toArray());
  const location = useLocation();
  const editInningsNumber = location.state?.editInningsNumber as number | undefined;

  const activeInnings = useLiveQuery(async () => {
    if (!matchId) return null;
    const list = await db.innings.where('match_id').equals(matchId).toArray();
    if (list.length === 0) return null;
    if (editInningsNumber) {
      const found = list.find(i => i.innings_number === editInningsNumber);
      if (found) return found;
    }
    return list.reduce((prev, current) => (prev.innings_number > current.innings_number) ? prev : current);
  }, [matchId, editInningsNumber]);

  const rawInningsBalls = useLiveQuery(async () => {
    if (!activeInnings) return [];
    const iballs = await db.balls.where('innings_id').equals(activeInnings.id).toArray();
    iballs.sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      return a.ball_number - b.ball_number;
    });
    return iballs;
  }, [activeInnings?.id]) ?? [];

  const inningsBalls = useMemo(() => rawInningsBalls.filter(b => b.innings_id === activeInnings?.id), [rawInningsBalls, activeInnings?.id]);

  const innings1Balls = useLiveQuery(async () => {
    if (!matchId) return [];
    const list = await db.innings.where('match_id').equals(matchId).toArray();
    const i1 = list.find(i => i.innings_number === 1);
    if (!i1) return [];
    const iballs = await db.balls.where('innings_id').equals(i1.id).toArray();
    iballs.sort((a, b) => {
      if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      return a.ball_number - b.ball_number;
    });
    return iballs;
  }, [matchId]) ?? [];

  const [showSkipInningsModal, setShowSkipInningsModal] = useState(false);
  const [skipInningsScore, setSkipInningsScore] = useState('');
  const [showEditInnings1Score, setShowEditInnings1Score] = useState(false);
  const [editInnings1ScoreValue, setEditInnings1ScoreValue] = useState('');
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [selectedWicketType, setSelectedWicketType] = useState<WicketType | null>(null);
  const [showFielderSelectModal, setShowFielderSelectModal] = useState(false);
  const [showPlayerSelectModal, setShowPlayerSelectModal] = useState<{ type: 'striker' | 'non_striker' | 'bowler', open: boolean }>({ type: 'striker', open: false });
  const [showExtraRunsModal, setShowExtraRunsModal] = useState<'wide' | 'no_ball' | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');

  // Run Out logic
  const [showRunOutModal, setShowRunOutModal] = useState(false);
  const [runOutRuns, setRunOutRuns] = useState(0);
  const [runOutBatsmanId, setRunOutBatsmanId] = useState<string>('');
  const [runOutFielderId, setRunOutFielderId] = useState<string>('');

  const [editingBall, setEditingBall] = useState<Ball | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [editExtra, setEditExtra] = useState<ExtraType>('none');
  const [editIsWicket, setEditIsWicket] = useState(false);
  const [editWicketType, setEditWicketType] = useState<WicketType>('none');

  const [isProcessing, setIsProcessing] = useState(false);

  // For run out on extras (feature 2.1)
  const [pendingExtraRunOut, setPendingExtraRunOut] = useState<{ extra: ExtraType, runs: number } | null>(null);

  // Snackbar undo (feature 2.9)
  const [snackbarUndo, setSnackbarUndo] = useState(false);
  const snackbarTimer = useRef<any>(null);

  // Revert to ball modal (feature 2.2)
  const [revertBall, setRevertBall] = useState<Ball | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean,
    title: string,
    message: string,
    confirmLabel?: string,
    onConfirm?: () => void,
    type?: 'danger' | 'info' | 'success'
  }>({ isOpen: false, title: '', message: '' });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  // Ball timeline scroll ref (feature 2.6)
  const ballTimelineRef = useRef<HTMLDivElement>(null);
  // Over-wise summary scroll ref (feature 2.4)
  const overSummaryRef = useRef<HTMLDivElement>(null);

  // Removed manual activeInnings useEffect in favor of useLiveQuery

  // Auto-scroll ball timeline to the right (feature 2.6)
  useEffect(() => {
    if (ballTimelineRef.current) {
      ballTimelineRef.current.scrollLeft = ballTimelineRef.current.scrollWidth;
    }
  }, [inningsBalls]);

  // Auto-scroll over-wise summary to the right (feature 2.4)
  useEffect(() => {
    if (overSummaryRef.current) {
      overSummaryRef.current.scrollLeft = overSummaryRef.current.scrollWidth;
    }
  }, [inningsBalls]);

  const totalLegalBalls = useMemo(() =>
    inningsBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'no_ball').length
  , [inningsBalls]);

  const isInningsComplete = (activeInnings && match)
    ? (activeInnings.wickets >= ((match.is_box_cricket || match.isBoxCricket) ? 999 : 10) || totalLegalBalls >= match.overs * 6)
    : false;
  const innings1 = inningsList?.find(i => i.innings_number === 1);
  const innings1Runs = innings1?.runs || match?.first_innings_total || 0;
  const isMatchComplete = (match && activeInnings) ? (match.status === 'completed' || (activeInnings.innings_number === 2 && (isInningsComplete || activeInnings.runs > innings1Runs))) : false;

  // Handle Match Completion globally in a side-effect
  useEffect(() => {
    if (!match || !activeInnings) return;
    // Only update if criteria met AND it's not already 'completed' in DB
    if (isMatchComplete && match.status !== 'completed' && !(window as any).__isRealtimeUpdate) {
      console.log('LiveScoring: Flagging match as completed');
      MatchRepo.updateStatus(match.id, 'completed');
    }
  }, [match?.id, match?.status, isMatchComplete]);

  if (!match || !activeInnings) return (
    <div className="p-4 flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center mb-4 animate-pulse">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">CricSense</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-600 font-medium mt-8 opacity-50">Made by Rishabh Masani</p>
    </div>
  );

  const battingTeamPlayers = allPlayers.filter(p =>
    (activeInnings.batting_team === match.teamA ? match.teamAPlayers : (match.teamBPlayers || [])).includes(p.id)
  );
  const bowlingTeamPlayers = allPlayers.filter(p =>
    (activeInnings.bowling_team === match.teamA ? match.teamAPlayers : (match.teamBPlayers || [])).includes(p.id)
  );

  const striker = allPlayers.find(p => p.id === activeInnings.striker_id);
  const nonStriker = allPlayers.find(p => p.id === activeInnings.non_striker_id);
  const bowler = allPlayers.find(p => p.id === activeInnings.bowler_id);

  // Stats calculation
  const getBatsmanStats = (id: string) => {
    const bBalls = inningsBalls.filter(b => b.batsman_id === id);
    const runs = bBalls.reduce((acc, b) => acc + b.runs, 0);
    const ballsFaced = bBalls.filter(b => b.extra_type !== 'wide').length;
    return { runs, ballsFaced };
  };

  const getBowlerStats = (id: string) => {
    const bBalls = inningsBalls.filter(b => b.bowler_id === id);
    const runsGiven = bBalls.reduce((acc, b) => acc + b.runs + b.extra_runs, 0);
    const wickets = bBalls.filter(b => b.is_wicket && b.wicket_type !== 'run_out').length;
    const legalBalls = bBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'no_ball').length;
    const overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;
    return { runsGiven, wickets, overs, legalBalls };
  };

  // Second innings chase info (feature 2.7)
  const getChaseInfo = () => {
    if (activeInnings.innings_number !== 2) return null;
    const target = innings1Runs + 1;
    const runsNeeded = target - activeInnings.runs;
    const totalBalls = match.overs * 6;
    const ballsBowled = totalLegalBalls;
    const ballsRemaining = totalBalls - ballsBowled;
    const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6) : 0;
    return { runsNeeded, ballsRemaining, rrr: rrr > 0 ? rrr.toFixed(1) : '0.0' };
  };

  const chaseInfo = getChaseInfo();

  const showSnackbar = () => {
    setSnackbarUndo(true);
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    snackbarTimer.current = setTimeout(() => setSnackbarUndo(false), 3000);
  };


  const handleScoreBall = async (runs: number, extra: ExtraType = 'none', isWicket: boolean = false, wicketType: WicketType = 'none', outPlayerId?: string, fielderId?: string, noStrikeChange: boolean = false) => {
    if (isProcessing) return;
    if (!editInningsNumber && (isMatchComplete || isInningsComplete)) return; // Prevent fast clicking unless editing
    if (editInningsNumber && totalLegalBalls >= match.overs * 6 && extra !== 'wide' && extra !== 'no_ball') {
      showToast("Over limit reached for this innings", "error");
      return;
    }

    if (!(match.is_box_cricket || match.isBoxCricket) && (!striker || !nonStriker || !bowler)) {
      showToast("Missing players. Please select them manually.", "info");
      setShowPlayerSelectModal({ type: !striker ? 'striker' : (!nonStriker ? 'non_striker' : 'bowler'), open: true });
      return; 
    }

    setIsProcessing(true);
    try {
      const isLegal = extra !== 'wide' && extra !== 'no_ball';
      const actualBalls = await db.balls.where('innings_id').equals(activeInnings.id).toArray();
      const legalBallsCount = actualBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'no_ball').length;
      
      let nextOverNumber = Math.floor(legalBallsCount / 6);
      let currentOverBalls = legalBallsCount % 6;
      let nextBallNumber = isLegal ? currentOverBalls + 1 : currentOverBalls;

      let extraRuns = 0;
      if (extra === 'wide' || extra === 'no_ball') extraRuns = 1;

      const ball: Omit<Ball, 'id'> = {
        innings_id: activeInnings.id,
        over_number: nextOverNumber,
        ball_number: nextBallNumber,
        batsman_id: striker?.id || 'box_ghost',
        bowler_id: bowler?.id || 'box_ghost',
        runs,
        extra_type: extra,
        extra_runs: extraRuns,
        is_wicket: isWicket,
        wicket_type: wicketType,
        player_out_id: outPlayerId,
        fielder_id: fielderId
      };

      await BallRepo.add(ball, noStrikeChange || match.is_box_cricket || match.isBoxCricket);

      setShowWicketModal(false);
      setSelectedWicketType(null);
      setShowFielderSelectModal(false);
      setPendingExtraRunOut(null);

      // Show undo snackbar
      showSnackbar();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditBall = (ball: Ball) => {
    setEditingBall(ball);
    setEditScore(ball.runs);
    setEditExtra(ball.extra_type);
    setEditIsWicket(ball.is_wicket);
    setEditWicketType(ball.wicket_type);
  };

  const saveEditedBall = async () => {
    if (!editingBall) return;
    const oldRuns = editingBall.runs;
    const oldExtraRuns = editingBall.extra_runs;
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

    const innings = await db.innings.get(activeInnings.id);
    if (innings) {
      const newBallsBowled = Math.max(0, innings.balls_bowled + legalDiff);
      await db.innings.update(activeInnings.id, {
        runs: Math.max(0, innings.runs + runDiff),
        wickets: Math.max(0, innings.wickets + wicketDiff),
        balls_bowled: newBallsBowled,
        overs: Math.floor(newBallsBowled / 6) + (newBallsBowled % 6) / 10
      });
    }

    setEditingBall(null);
  };

  const handleUndo = async () => {
    setModalConfig({
      isOpen: true,
      title: 'Undo Last Ball?',
      message: 'This will remove the previous ball from the current innings and restore the match state.',
      confirmLabel: 'Undo',
      type: 'info',
      onConfirm: async () => {
        await BallRepo.undoLastBall(activeInnings.id);
      }
    });
  };

  const handleQuickUndo = async () => {
    setSnackbarUndo(false);
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    await BallRepo.undoLastBall(activeInnings.id);
  };

  const handleRevertToBall = async () => {
    if (!revertBall) return;
    await BallRepo.revertToBall(activeInnings.id, revertBall.id);
    setRevertBall(null);
    showToast("Match reverted successfully", "success");
  };

  const handleManualEndMatch = async () => {
    setModalConfig({
      isOpen: true,
      title: 'Close Match Mid-way?',
      message: 'This will end the match immediately and move to the summary. Do you want to continue?',
      confirmLabel: 'End Match',
      type: 'danger',
      onConfirm: async () => {
        await MatchRepo.updateStatus(match.id, 'completed');
        navigate(`/summary/${match.id}`);
      }
    });
  };

  const handleEndInnings = async () => {
    if (activeInnings.innings_number === 1) {
      await InningsRepo.create(match.id, activeInnings.bowling_team, activeInnings.batting_team, 2);
    } else {
      await MatchRepo.updateStatus(match.id, 'completed');
      navigate(`/summary/${match.id}`);
    }
  };

  const handleAllOut = async () => {
    if (!match || !activeInnings) return;
    const maxWickets = (match.is_box_cricket || match.isBoxCricket) ? 999 : 10;
    if (activeInnings.wickets < maxWickets) {
      await db.innings.update(activeInnings.id, { wickets: maxWickets });
      showToast(`${activeInnings.batting_team} all out`, 'success');
    }
    await handleEndInnings();
  };

  const strStats = striker ? getBatsmanStats(striker.id) : null;
  const nStrStats = nonStriker ? getBatsmanStats(nonStriker.id) : null;
  const bwlStats = bowler ? getBowlerStats(bowler.id) : null;

  // Helper to get ball label and color
  const getBallDisplay = (b: Ball) => {
    let lbl = b.runs.toString();
    let color = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200';
    if (b.extra_type === 'wide') { lbl = b.runs > 0 ? `${b.runs}Wd` : 'Wd'; color = 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'; }
    else if (b.extra_type === 'no_ball') { lbl = b.runs > 0 ? `${b.runs}Nb` : 'Nb'; color = 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'; }
    else if (b.is_wicket) { lbl = 'W'; color = 'bg-red-500 border-red-600 text-white'; }
    else if (b.runs === 4) { color = 'bg-blue-500 border-blue-600 text-white'; }
    else if (b.runs === 6) { color = 'bg-primary-600 border-primary-700 text-white'; }
    else if (b.runs === 0) { lbl = '•'; }
    return { lbl, color };
  };

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

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="bg-primary-600 text-white px-3 py-1.5 shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-bold text-base leading-tight flex items-center gap-2">
              {activeInnings.batting_team}
              {editInningsNumber && (
                <span className="bg-amber-400 text-amber-950 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">EDITING</span>
              )}
              {isAdmin && !editInningsNumber && (
                <button
                  onClick={handleManualEndMatch}
                  className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                  title="End Match"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="text-xs text-primary-100 font-medium mt-0.5">
              Overs: <span className="text-white font-bold">{activeInnings.overs.toFixed(1)}</span> / {match.overs}
            </div>
          </div>
          {editInningsNumber && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="bg-white text-primary-700 h-8 px-3 font-bold shadow-sm"
              onClick={() => navigate(`/summary/${match.id}`)}
            >
              Done
            </Button>
          )}
          <div className="text-2xl font-black">{activeInnings.runs}/{activeInnings.wickets}</div>
        </div>
        {/* Second innings chase info + target */}
        {activeInnings.innings_number === 2 && (
          <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-white/20 text-xs font-medium text-primary-100">
            <span className="bg-white/15 px-2 py-0.5 rounded-full text-white font-bold">Target: {innings1Runs + 1}</span>
            {chaseInfo && chaseInfo.runsNeeded > 0 && (
              <>
                <span>Need <span className="text-white font-bold">{chaseInfo.runsNeeded}</span> in <span className="text-white font-bold">{chaseInfo.ballsRemaining}</span> balls</span>
                <span className="bg-white/15 px-2 py-0.5 rounded-full text-white font-bold">RRR: {chaseInfo.rrr}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-3 overflow-y-auto flex-1">
        {(isMatchComplete && !editInningsNumber) ? (
          <Card className="p-6 text-center space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Match Completed</h2>
            <Button onClick={() => navigate(`/summary/${match.id}`)} fullWidth>View Summary</Button>
          </Card>
        ) : (isInningsComplete && !editInningsNumber) ? (
          <>
            <Card className="p-6 text-center space-y-4 mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Innings Break</h2>
              <div className="text-gray-600 dark:text-gray-300 font-semibold">
                {activeInnings.batting_team}: <span className="text-primary-600 font-black text-xl">{activeInnings.runs}/{activeInnings.wickets}</span>
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Button onClick={handleEndInnings} fullWidth>▶ Start 2nd Innings</Button>
                  <Button 
                    variant="outline" 
                    fullWidth 
                    onClick={() => setShowSkipInningsModal(true)}
                    className="border-amber-400 text-amber-700 dark:text-amber-400 dark:border-amber-600"
                  >
                    ⏭ Skip — Enter Opponent Score
                  </Button>
                </div>
              )}
              {!isAdmin && (
                <div className="text-gray-500 dark:text-gray-400">Waiting for next innings to start...</div>
              )}
            </Card>
            <div className="mb-2">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Over-wise Summary</div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {Array.from({ length: (inningsBalls.length > 0 ? Math.max(...inningsBalls.map(b => b.over_number)) : 0) + 1 }).map((_, idx) => {
                  const overNumber = idx;
                  const overBalls = inningsBalls.filter(b => b.over_number === overNumber);
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
                              <button onClick={isAdmin ? () => setRevertBall(b) : undefined} className={`text-xs ${tColor} ${isAdmin ? 'active:scale-95 transition-transform font-semibold cursor-pointer' : 'font-semibold cursor-default'}`}>{lbl}</button>
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
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Card className="p-2 border-l-4 border-l-amber-500 relative">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Batting</div>
                  {isAdmin && (
                    <button onClick={async () => {
                      await db.innings.update(activeInnings.id, {
                        striker_id: activeInnings.non_striker_id,
                        non_striker_id: activeInnings.striker_id
                      });
                    }} className="text-primary-600 bg-primary-50 p-1 rounded-full active:bg-primary-100 shadow-sm border border-primary-100">
                      <ArrowLeftRight size={14} />
                    </button>
                  )}
                </div>
                <div
                  className={`flex justify-between items-center py-1 ${isAdmin ? 'cursor-pointer active:bg-gray-50 dark:bg-gray-900' : ''}`}
                  onClick={() => {
                    if (isAdmin) {
                      if (!striker || window.confirm(`Do you want to replace/retire ${striker.name}?`)) {
                        setShowPlayerSelectModal({ type: 'striker', open: true });
                      }
                    }
                  }}
                >
                  <span className="font-bold text-gray-900 dark:text-gray-50 truncate">
                    {striker?.name || 'Select Striker'} <span className="text-amber-500">*</span>
                  </span>
                  {strStats && <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{strStats.runs}({strStats.ballsFaced})</span>}
                </div>
                {!(match.is_box_cricket || match.isBoxCricket) && (
                  <div
                    className={`flex justify-between items-center py-1 text-gray-600 dark:text-gray-300 ${isAdmin ? 'cursor-pointer active:bg-gray-50 dark:bg-gray-900' : ''}`}
                    onClick={() => {
                      if (isAdmin) {
                        if (!nonStriker || window.confirm(`Do you want to replace/retire ${nonStriker.name}?`)) {
                          setShowPlayerSelectModal({ type: 'non_striker', open: true });
                        }
                      }
                    }}
                  >
                    <span className="font-medium truncate">{nonStriker?.name || 'Select Non-Striker'}</span>
                    {nStrStats && <span className="text-sm">{nStrStats.runs}({nStrStats.ballsFaced})</span>}
                  </div>
                )}
              </Card>

              <Card className="p-2 border-l-4 border-l-blue-500">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Bowling</div>
                <div
                  className={`flex justify-between items-center py-1 ${isAdmin ? 'cursor-pointer active:bg-gray-50 dark:bg-gray-900' : ''}`}
                  onClick={() => isAdmin && setShowPlayerSelectModal({ type: 'bowler', open: true })}
                >
                  <span className="font-bold text-gray-900 dark:text-gray-50 truncate">{bowler?.name || 'Select Bowler'}</span>
                  {bwlStats && <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{bwlStats.runsGiven}-{bwlStats.wickets} <span className="text-xs text-gray-400">({formatOvers(bwlStats.legalBalls)})</span></span>}
                </div>
              </Card>
            </div>

            { (match.is_box_cricket || match.isBoxCricket) && isAdmin && (
              <div className="mb-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-wide mb-2">Quick Select Chips</div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {bowlingTeamPlayers.map(p => (
                    <button key={'bowl_'+p.id} onClick={() => db.innings.update(activeInnings.id, { bowler_id: p.id })} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${bowler?.id === p.id ? 'bg-blue-500 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>🥎 {p.name}</button>
                  ))}
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-2">
                  {battingTeamPlayers.map(p => (
                    <button key={'bat_'+p.id} onClick={() => db.innings.update(activeInnings.id, { striker_id: p.id })} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${striker?.id === p.id ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>🏏 {p.name}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Scoring Buttons (Admin Only) */}
            {isAdmin && (
              <>
                <div className="grid grid-cols-4 gap-2 mb-2 mt-4">
                  <Button variant="secondary" className="h-14 text-lg font-bold rounded-xl" onClick={() => handleScoreBall(0)}>•</Button>
                  <Button variant="secondary" className="h-14 text-lg font-bold rounded-xl" onClick={() => handleScoreBall(1)}>1</Button>
                  <Button variant="secondary" className="h-14 text-lg font-bold rounded-xl" onClick={() => handleScoreBall(2)}>2</Button>
                  <Button variant="secondary" className="h-14 text-lg font-bold rounded-xl" onClick={() => handleScoreBall(3)}>3</Button>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-2">
                  <Button variant="primary" className="h-14 text-lg font-bold rounded-xl bg-blue-500 hover:bg-blue-600" onClick={() => handleScoreBall(4)}>4</Button>
                  <Button variant="primary" className="h-14 text-lg font-bold rounded-xl" onClick={() => handleScoreBall(6)}>6</Button>
                  <Button variant="danger" className="h-14 text-lg font-bold rounded-xl col-span-2" onClick={() => setShowWicketModal(true)}>WICKET</Button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Button variant="secondary" className="h-12 font-bold rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800" onClick={() => handleScoreBall(1, 'none', false, 'none', undefined, undefined, true)}>1d</Button>
                  <Button variant="secondary" className="h-12 font-bold rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800" onClick={() => handleScoreBall(2, 'none', false, 'none', undefined, undefined, true)}>2d</Button>
                  <Button variant="secondary" className="h-12 font-bold rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800" onClick={() => {
                    const r = prompt("Enter declared runs:");
                    if (r !== null) {
                      const runs = parseInt(r);
                      if (!isNaN(runs)) handleScoreBall(runs, 'none', false, 'none', undefined, undefined, true);
                    }
                  }}>Declare...</Button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Button variant="outline" className="h-12 font-bold border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800" onClick={() => setShowExtraRunsModal('wide')}>WD</Button>
                  <Button variant="outline" className="h-12 font-bold border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800" onClick={() => setShowExtraRunsModal('no_ball')}>NB</Button>
                  <Button variant="ghost" className="h-12 font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700" onClick={handleUndo}>
                    <Undo2 size={20} />
                  </Button>
                </div>

              </>
            )}

            {/* Recent balls — right-anchored (feature 2.6) */}
            <div className={`mb-2 ${!isAdmin ? 'mt-6' : ''}`}>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Recent Balls</div>
              <div
                ref={ballTimelineRef}
                className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              >
                {inningsBalls.map((b) => {
                  const { lbl, color } = getBallDisplay(b);
                  return (
                    <button
                      key={b.id}
                      onClick={isAdmin ? () => setRevertBall(b) : undefined}
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm ${isAdmin ? 'transition-transform active:scale-95 cursor-pointer' : 'cursor-default'} ${color}`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Over-wise Summary — single-line scrollable (feature 2.4) */}
            {inningsBalls.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Over-wise Summary</div>
                <div
                  ref={overSummaryRef}
                  className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
                >
                  {Array.from({ length: (inningsBalls.length > 0 ? Math.max(...inningsBalls.map(b => b.over_number)) : 0) + 1 }).map((_, idx) => {
                    const overNumber = idx;
                    const overBalls = inningsBalls.filter(b => b.over_number === overNumber);
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
            )}

            {/* Edit 1st Innings Score — shown in 2nd innings */}
            {activeInnings.innings_number === 2 && isAdmin && (
              <div className="mb-3">
                {!showEditInnings1Score ? (
                  <button
                    onClick={() => {
                      setEditInnings1ScoreValue(String(innings1Runs));
                      setShowEditInnings1Score(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-sm font-semibold"
                  >
                    <span>1st Innings: <span className="font-black">{innings1Runs}</span> runs</span>
                    <span className="text-xs bg-amber-100 dark:bg-amber-800 px-2 py-0.5 rounded-full">✏️ Edit</span>
                  </button>
                ) : (
                  <div className="flex gap-2 items-center px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl">
                    <span className="text-amber-700 dark:text-amber-300 text-sm font-bold flex-shrink-0">1st Innings:</span>
                    <input
                      type="number"
                      value={editInnings1ScoreValue}
                      onChange={e => setEditInnings1ScoreValue(e.target.value)}
                      className="flex-1 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 font-bold text-sm outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="e.g. 85"
                    />
                    <button
                      onClick={async () => {
                        const newScore = parseInt(editInnings1ScoreValue);
                        if (isNaN(newScore) || newScore < 0) { showToast('Invalid score', 'error'); return; }
                        // Update innings1 record in local DB + Supabase
                        if (innings1) {
                          await db.innings.update(innings1.id, { runs: newScore });
                          const fullInnings = await db.innings.get(innings1.id);
                          if (fullInnings) supabase.from('innings').upsert(fullInnings).then();
                        }
                        // Update match firstInningsTotal in local DB + Supabase
                        await db.matches.update(match.id, { firstInningsTotal: newScore, first_innings_total: newScore });
                        const fullMatch = await db.matches.get(match.id);
                        if (fullMatch) supabase.from('matches').upsert(mapMatchPayload(fullMatch)).then();
                        setShowEditInnings1Score(false);
                        showToast('1st innings score updated', 'success');
                      }}
                      className="px-3 py-1.5 bg-amber-500 text-white font-bold rounded-lg text-sm flex-shrink-0"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowEditInnings1Score(false)}
                      className="px-2 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-lg text-sm flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 1st Innings Over-wise Summary in Innings 2 */}
            {activeInnings.innings_number === 2 && innings1Balls.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">1st Innings Over-wise Summary</div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {Array.from({ length: (innings1Balls.length > 0 ? Math.max(...innings1Balls.map(b => b.over_number)) : 0) + 1 }).map((_, idx) => {
                    const overNumber = idx;
                    const overBalls = innings1Balls.filter(b => b.over_number === overNumber);
                    if (overBalls.length === 0) return null;

                    const runsInOver = overBalls.reduce((acc, b) => acc + b.runs + b.extra_runs, 0);

                    return (
                      <div key={idx} className="flex-shrink-0 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm opacity-80">
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold flex items-center justify-center text-xs">
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
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded ml-1">{runsInOver}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dismissed Batsmen Scorecard */}
            {(() => {
              const wicketBalls = inningsBalls.filter(b => b.is_wicket && b.player_out_id && b.player_out_id !== 'box_ghost');
              if (wicketBalls.length === 0) return null;
              return (
                <div className="mb-4">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1 flex items-center gap-1.5">
                    <span>🏏</span> Dismissed Batsmen
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                    {wicketBalls.map((wb, idx) => {
                      const outPlayer = allPlayers.find(p => p.id === wb.player_out_id);
                      if (!outPlayer) return null;
                      const pBalls = inningsBalls.filter(b => b.batsman_id === wb.player_out_id);
                      const pRuns = pBalls.reduce((acc, b) => acc + b.runs, 0);
                      const pBallsFaced = pBalls.filter(b => b.extra_type !== 'wide').length;
                      const pFours = pBalls.filter(b => b.runs === 4 && b.extra_type === 'none').length;
                      const pSixes = pBalls.filter(b => b.runs === 6 && b.extra_type === 'none').length;
                      const dismissalType = wb.wicket_type?.replace('_', ' ') || 'out';
                      return (
                        <div key={wb.id} className={`flex items-center justify-between px-3 py-2 ${idx > 0 ? 'border-t border-gray-100 dark:border-gray-700/60' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 dark:text-gray-50 text-sm truncate">{outPlayer.name}</div>
                            <div className="text-[10px] text-red-500 capitalize font-medium">{dismissalType}</div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <div className="font-black text-gray-900 dark:text-gray-50">
                              {pRuns} <span className="text-gray-400 font-normal text-xs">({pBallsFaced})</span>
                            </div>
                            {(pFours > 0 || pSixes > 0) && (
                              <div className="text-[10px] text-gray-400">
                                {pFours > 0 && <span className="text-blue-500 font-bold">{pFours}×4</span>}
                                {pFours > 0 && pSixes > 0 && <span className="mx-0.5"> </span>}
                                {pSixes > 0 && <span className="text-primary-500 font-bold">{pSixes}×6</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Skip 2nd Innings Modal */}
      {showSkipInningsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200 space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 text-center">Skip 2nd Innings</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Enter how many runs the opponent scored. The match will be ended immediately.
            </p>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">
                Opponent's Final Score
              </label>
              <input
                type="number"
                value={skipInningsScore}
                onChange={e => setSkipInningsScore(e.target.value)}
                placeholder="e.g. 72"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 font-bold text-lg outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => { setShowSkipInningsModal(false); setSkipInningsScore(''); }}>Cancel</Button>
              <Button
                variant="primary"
                fullWidth
                onClick={async () => {
                  const opponentRuns = parseInt(skipInningsScore);
                  if (isNaN(opponentRuns) || opponentRuns < 0) { showToast('Enter a valid score', 'error'); return; }
                  // Create a skeletal 2nd innings record with the entered score
                  const bowlingTeam = activeInnings.bowling_team;
                  const battingTeam = activeInnings.batting_team;
                  const inningsId = await InningsRepo.create(match.id, bowlingTeam, battingTeam, 2);
                  await db.innings.update(inningsId, { runs: opponentRuns });
                  // Determine winner
                  const firstInningsRuns = activeInnings.runs;
                  let winner: string | undefined;
                  if (opponentRuns > firstInningsRuns) winner = bowlingTeam;
                  else if (opponentRuns < firstInningsRuns) winner = battingTeam;
                  await MatchRepo.updateStatus(match.id, 'completed', winner);
                  setShowSkipInningsModal(false);
                  setSkipInningsScore('');
                  navigate(`/summary/${match.id}`);
                }}
              >
                End Match
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Undo snackbar (feature 2.9) */}
      {snackbarUndo && (
        <div className="fixed bottom-24 left-4 right-4 z-[90] flex justify-center animate-in slide-in-from-bottom-4 duration-200">
          <button
            onClick={handleQuickUndo}
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Undo2 size={16} /> Undo Last Ball
          </button>
        </div>
      )}

      {/* Wicket Modal */}
      {showWicketModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-5 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4 text-center">Wicket Details</h3>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {WICKET_TYPES.map(w => (
                <button
                  key={w}
                  onClick={() => {
                    if (w === 'caught' || w === 'run_out' || w === 'stumped') {
                      setSelectedWicketType(w);
                      setShowWicketModal(false);
                      if (w === 'run_out') {
                        setRunOutBatsmanId(striker?.id || '');
                        setRunOutRuns(0);
                        setRunOutFielderId('');
                        setShowRunOutModal(true);
                      } else {
                        setShowFielderSelectModal(true);
                      }
                    } else {
                      handleScoreBall(0, 'none', true, w, striker?.id);
                    }
                  }}
                  className="py-3 bg-gray-100 dark:bg-gray-800 active:bg-primary-100 active:text-primary-700 rounded-xl font-semibold text-gray-700 dark:text-gray-200 capitalize border border-transparent active:border-primary-300"
                >
                  {w.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <Button variant="danger" fullWidth className="mb-3" onClick={async () => {
                setShowWicketModal(false);
                await handleAllOut();
              }}>
                All Out
              </Button>
            </div>

            <div className="mt-4 border-t pt-4">
              <Button variant="ghost" fullWidth onClick={() => setShowWicketModal(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Fielder Select Modal */}
      {showFielderSelectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">Select Fielder</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleScoreBall(0, 'none', true, selectedWicketType!, striker?.id, undefined)}
                className="w-full py-3 px-4 rounded-xl text-left font-bold bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 active:bg-primary-100"
              >
                👤 Unknown / Skip Fielder
              </button>
              {bowlingTeamPlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleScoreBall(0, 'none', true, selectedWicketType!, striker?.id, p.id)}
                  className="w-full py-3 px-4 rounded-xl text-left font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 active:bg-primary-50 active:border-primary-200"
                >
                  {p.name}
                </button>
              ))}
            </div>
            <Button variant="ghost" fullWidth className="mt-4" onClick={() => setShowFielderSelectModal(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Run Out Modal */}
      {showRunOutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-sm p-5 animate-in slide-in-from-bottom duration-200">
            <h3 className="text-xl font-bold mb-4">Run Out Details</h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300">Runs completed</label>
                <div className="flex gap-2 mt-1">
                  {[0, 1, 2, 3].map(r => (
                    <button 
                      key={r}
                      onClick={() => setRunOutRuns(r)}
                      className={`flex-1 py-2 rounded-xl border ${runOutRuns === r ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 font-bold' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300">Who got out?</label>
                <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => setRunOutBatsmanId(striker?.id || '')}
                    className={`flex-1 py-3 font-semibold rounded-xl border truncate px-2 ${runOutBatsmanId === striker?.id ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    {striker?.name} (Striker)
                  </button>
                  <button 
                    onClick={() => setRunOutBatsmanId(nonStriker?.id || '')}
                    className={`flex-1 py-3 font-semibold rounded-xl border truncate px-2 ${runOutBatsmanId === nonStriker?.id ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    {nonStriker?.name} (Non-Striker)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300">Fielder (Optional)</label>
                <select 
                  className="w-full mt-1 p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900"
                  value={runOutFielderId}
                  onChange={(e) => setRunOutFielderId(e.target.value)}
                >
                  <option value="">Unknown Fielder</option>
                  {bowlingTeamPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="ghost" fullWidth onClick={() => setShowRunOutModal(false)}>Cancel</Button>
              <Button 
                variant="danger" 
                fullWidth 
                onClick={() => {
                  handleScoreBall(
                    runOutRuns, 'none', true, 'run_out', 
                    runOutBatsmanId, 
                    runOutFielderId || undefined, 
                    false 
                  );
                }}
              >
                Confirm Out
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Player Select Modal */}
      {showPlayerSelectModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4 capitalize">Select {showPlayerSelectModal.type.replace('_', ' ')}</h3>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Add new player"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-primary-500"
              />
              <Button onClick={async () => {
                if (!newPlayerName.trim()) return;
                const searchLower = newPlayerName.trim().toLowerCase();
                const existing = allPlayers.find(p => p.name.toLowerCase() === searchLower);
                let pid = '';
                if (existing) {
                  const alreadyInTeam = (activeInnings.batting_team === match.teamA ? match.teamAPlayers : match.teamBPlayers).includes(existing.id) ||
                                        (activeInnings.bowling_team === match.teamA ? match.teamAPlayers : match.teamBPlayers).includes(existing.id);
                  if (alreadyInTeam) {
                    showToast("Player already exists in a team.", "error");
                    return;
                  }
                  pid = existing.id;
                } else {
                  pid = await PlayerRepo.add(newPlayerName.trim());
                }
                const team = showPlayerSelectModal.type === 'bowler'
                  ? (activeInnings.bowling_team === match.teamA ? 'A' : 'B')
                  : (activeInnings.batting_team === match.teamA ? 'A' : 'B');
                await MatchRepo.addPlayerToTeam(match.id, team, pid);

                const updateObj: any = {};
                if (showPlayerSelectModal.type === 'striker') updateObj.striker_id = pid;
                if (showPlayerSelectModal.type === 'non_striker') updateObj.non_striker_id = pid;
                if (showPlayerSelectModal.type === 'bowler') updateObj.bowler_id = pid;

                await InningsRepo.updatePlayers(activeInnings.id, updateObj);
                setNewPlayerName('');
                setShowPlayerSelectModal({ type: 'striker', open: false });
              }} size="sm">Add</Button>
            </div>

            <div className="space-y-2">
              {(showPlayerSelectModal.type === 'bowler' ? bowlingTeamPlayers : battingTeamPlayers).map(p => (
                <button
                  key={p.id}
                  onClick={async () => {
                    const updateObj: any = {};
                    if (showPlayerSelectModal.type === 'striker') updateObj.striker_id = p.id;
                    if (showPlayerSelectModal.type === 'non_striker') updateObj.non_striker_id = p.id;
                    if (showPlayerSelectModal.type === 'bowler') updateObj.bowler_id = p.id;
                    await InningsRepo.updatePlayers(activeInnings.id, updateObj);
                    setShowPlayerSelectModal({ type: 'striker', open: false });
                  }}
                  className={`w-full py-3 px-4 rounded-xl text-left font-semibold ${activeInnings.striker_id === p.id || activeInnings.non_striker_id === p.id || activeInnings.bowler_id === p.id
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-50 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 active:bg-primary-50 active:border-primary-200'
                    }`}
                  disabled={activeInnings.striker_id === p.id || activeInnings.non_striker_id === p.id || activeInnings.bowler_id === p.id}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <Button variant="ghost" fullWidth className="mt-4" onClick={() => setShowPlayerSelectModal({ type: 'striker', open: false })}>Close</Button>
          </div>
        </div>
      )}

      {/* Extra Runs Modal — with 6 option (fix 1.2) and Run Out option (feature 2.1) */}
      {showExtraRunsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-5 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4 text-center">
              Runs on {showExtraRunsModal === 'wide' ? 'Wide' : 'No Ball'}
            </h3>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[0, 1, 2, 3, 4, 6].map(r => (
                <button
                  key={r}
                  onClick={() => {
                    handleScoreBall(r, showExtraRunsModal);
                    setShowExtraRunsModal(null);
                  }}
                  className="py-3 bg-gray-100 dark:bg-gray-800 active:bg-primary-100 active:text-primary-700 rounded-xl font-semibold text-gray-700 dark:text-gray-200 border border-transparent active:border-primary-300"
                >
                  +{r}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
               <button
                  onClick={() => {
                    handleScoreBall(1, showExtraRunsModal, false, 'none', undefined, undefined, true);
                    setShowExtraRunsModal(null);
                  }}
                  className="py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold border border-indigo-200 dark:border-indigo-800 text-xs"
                >
                  +1d
                </button>
                <button
                  onClick={() => {
                    handleScoreBall(2, showExtraRunsModal, false, 'none', undefined, undefined, true);
                    setShowExtraRunsModal(null);
                  }}
                  className="py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold border border-indigo-200 dark:border-indigo-800 text-xs"
                >
                  +2d
                </button>
            </div>

            {/* Run Out on extra (feature 2.1) */}
            <div className="border-t pt-3 mb-3">
              <button
                onClick={() => {
                  setPendingExtraRunOut({ extra: showExtraRunsModal, runs: 0 });
                  setShowExtraRunsModal(null);
                }}
                className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold border border-red-200 dark:border-red-800 active:bg-red-100"
              >
                Run Out
              </button>
            </div>

            <div className="border-t pt-4">
              <Button variant="ghost" fullWidth onClick={() => setShowExtraRunsModal(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Run Out on Extra — Select who is out (feature 2.1) */}
      {pendingExtraRunOut && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Run Out on {pendingExtraRunOut.extra === 'wide' ? 'Wide' : 'No Ball'}</h3>
            
            <p className="text-sm text-gray-500 mb-2">Runs completed before wicket:</p>
            <div className="flex gap-2 mb-4">
              {[0, 1, 2, 3].map(r => (
                <button
                  key={r}
                  onClick={() => setPendingExtraRunOut({ ...pendingExtraRunOut, runs: r })}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-colors ${pendingExtraRunOut.runs === r ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'}`}
                >
                  {r}
                </button>
              ))}
            </div>

            <p className="text-sm text-gray-500 mb-2">Who got run out?</p>
            <div className="space-y-2">
              {striker && (
                <button
                  onClick={() => {
                    handleScoreBall(pendingExtraRunOut.runs, pendingExtraRunOut.extra, true, 'run_out', striker.id);
                  }}
                  className="w-full py-3 px-4 rounded-xl text-left font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 active:bg-red-50 active:border-red-200"
                >
                  {striker.name} <span className="text-amber-500">(Striker)</span>
                </button>
              )}
              {nonStriker && (
                <button
                  onClick={() => {
                    handleScoreBall(pendingExtraRunOut.runs, pendingExtraRunOut.extra, true, 'run_out', nonStriker.id);
                  }}
                  className="w-full py-3 px-4 rounded-xl text-left font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 active:bg-red-50 active:border-red-200"
                >
                  {nonStriker.name} <span className="text-gray-400">(Non-Striker)</span>
                </button>
              )}
            </div>
            <Button variant="ghost" fullWidth className="mt-4" onClick={() => setPendingExtraRunOut(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Revert to Ball Modal (feature 2.2) */}
      {revertBall && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-6 animate-in zoom-in duration-200 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2 flex items-center gap-2">
              <RotateCcw size={20} className="text-primary-500" />
              Ball {revertBall.over_number}.{revertBall.ball_number}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {(() => { const d = getBallDisplay(revertBall); return d.lbl; })()} — {revertBall.runs + revertBall.extra_runs} runs
              {revertBall.is_wicket ? ' (Wicket)' : ''}
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  handleEditBall(revertBall);
                  setRevertBall(null);
                }}
                className="w-full py-3 px-4 rounded-xl text-left font-semibold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 active:bg-primary-50"
              >
                ✏️ Edit This Ball
              </button>
              <button
                onClick={() => {
                  handleRevertToBall();
                }}
                className="w-full py-3 px-4 rounded-xl text-left font-semibold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 active:bg-red-100"
              >
                ⏪ Revert Match to This Ball
              </button>
            </div>

            <Button variant="ghost" fullWidth className="mt-4" onClick={() => setRevertBall(null)}>Cancel</Button>
          </Card>
        </div>
      )}




      {/* Edit Ball Modal */}
      {editingBall && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-6 animate-in zoom-in duration-200 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4 flex items-center gap-2">
              <Pointer size={20} className="text-primary-500" />
              Edit Ball {editingBall.over_number}.{editingBall.ball_number}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Runs</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3, 4, 6].map(r => (
                    <button
                      key={r}
                      onClick={() => setEditScore(r)}
                      className={`py-2 rounded-lg font-bold border transition-all ${editScore === r ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}
                    >
                      {r === 0 ? '•' : r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Extra Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['none', 'wide', 'no_ball', 'bye', 'leg_bye'].map(e => (
                    <button
                      key={e}
                      onClick={() => setEditExtra(e as ExtraType)}
                      className={`py-2 rounded-lg font-bold text-[10px] border transition-all capitalize ${editExtra === e ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}
                    >
                      {e.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${editIsWicket ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="font-bold text-gray-700 dark:text-gray-200">Wicket?</span>
                </div>
                <button
                  onClick={() => {
                    setEditIsWicket(!editIsWicket);
                    if (!editIsWicket) setEditWicketType('bowled');
                    else setEditWicketType('none');
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative ${editIsWicket ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editIsWicket ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {editIsWicket && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Wicket Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {WICKET_TYPES.map(w => (
                      <button
                        key={w}
                        onClick={() => setEditWicketType(w)}
                        className={`py-2 rounded-lg font-bold text-[10px] border transition-all capitalize ${editWicketType === w ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}
                      >
                        {w.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setEditingBall(null)}>Cancel</Button>
              <Button variant="primary" fullWidth onClick={saveEditedBall}>Save Changes</Button>
            </div>
          </Card>
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
    </div>
  );
};

export default LiveScoring;
