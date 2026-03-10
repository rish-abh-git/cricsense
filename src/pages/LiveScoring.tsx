import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { BallRepo, InningsRepo, MatchRepo } from '../database/repository';
import Button from '../components/Button';
import Card from '../components/Card';
import { Undo2, ArrowLeftRight, Mic, MicOff, Pointer, X } from 'lucide-react';
import type { WicketType, ExtraType, Ball } from '../database/schema';
import { PlayerRepo } from '../database/repository';

const WICKET_TYPES: WicketType[] = ['bowled', 'caught', 'run_out', 'stumped', 'lbw', 'hit_wicket'];

const LiveScoring: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const match = useLiveQuery(() => db.matches.get(matchId || ''));
  const allPlayers = useLiveQuery(() => db.players.toArray()) || [];
  const inningsList = useLiveQuery(() => db.innings.where('match_id').equals(matchId || '').toArray());
  const balls = useLiveQuery(() => matchId ? db.balls.toArray() : []); // Simplify or filter manually

  const [activeInnings, setActiveInnings] = useState<any>(null);
  const [inningsBalls, setInningsBalls] = useState<Ball[]>([]);

  const [showWicketModal, setShowWicketModal] = useState(false);
  const [selectedWicketType, setSelectedWicketType] = useState<WicketType | null>(null);
  const [showFielderSelectModal, setShowFielderSelectModal] = useState(false);
  const [showPlayerSelectModal, setShowPlayerSelectModal] = useState<{type: 'striker' | 'non_striker' | 'bowler', open: boolean}>({type: 'striker', open: false});
  const [showExtraRunsModal, setShowExtraRunsModal] = useState<'wide' | 'no_ball' | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isTapMode, setIsTapMode] = useState(false);
  const [tapRuns, setTapRuns] = useState(0);

  // Voice Recognition Logic
  useEffect(() => {
    let recognition: any = null;
    if (isVoiceMode && ('webkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        console.log('Voice Command:', transcript);
        
        if (transcript.includes('zero') || transcript.includes('dot')) handleScoreBall(0);
        else if (transcript.includes('one') || transcript.includes('single')) handleScoreBall(1);
        else if (transcript.includes('two') || transcript.includes('double')) handleScoreBall(2);
        else if (transcript.includes('three')) handleScoreBall(3);
        else if (transcript.includes('four') || transcript.includes('boundary')) handleScoreBall(4);
        else if (transcript.includes('six')) handleScoreBall(6);
        else if (transcript.includes('wide')) handleScoreBall(0, 'wide');
        else if (transcript.includes('no ball')) handleScoreBall(0, 'no_ball');
        else if (transcript.includes('wicket')) setShowWicketModal(true);
        else if (transcript.includes('undo')) handleUndo();
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') setIsVoiceMode(false);
      };

      recognition.onend = () => {
        if (isVoiceMode) recognition.start(); // Keep listening
      };

      recognition.start();
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [isVoiceMode]);

  useEffect(() => {
    if (inningsList && inningsList.length > 0) {
      // Pick the latest innings (1 or 2)
      const latest = inningsList.reduce((prev, current) => (prev.innings_number > current.innings_number) ? prev : current);
      setActiveInnings(latest);
    }
  }, [inningsList]);

  useEffect(() => {
    if (activeInnings && balls) {
      const iballs = balls.filter(b => b.innings_id === activeInnings.id);
      iballs.sort((a, b) => {
        if (a.over_number !== b.over_number) return a.over_number - b.over_number;
        return a.ball_number - b.ball_number;
      });
      setInningsBalls(iballs);
    }
  }, [activeInnings, balls]);

  if (!match || !activeInnings) return <div className="p-4 text-center">Loading match...</div>;

  const isInningsComplete = activeInnings.wickets >= 10 || activeInnings.overs >= match.overs;
  const isMatchComplete = match.status === 'completed' || (activeInnings.innings_number === 2 && (isInningsComplete || activeInnings.runs > (inningsList!.find(i => i.innings_number === 1)?.runs || 0)));

  if (isMatchComplete && match.status !== 'completed') {
    // EndMatch Logic
    MatchRepo.updateStatus(match.id, 'completed');
  }

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
    const wickets = bBalls.filter(b => b.is_wicket && b.wicket_type !== 'run_out').length; // Standard wickets
    const legalBalls = bBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'no_ball').length;
    const overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;
    return { runsGiven, wickets, overs, legalBalls };
  };

  const handleScoreBall = async (runs: number, extra: ExtraType = 'none', isWicket: boolean = false, wicketType: WicketType = 'none', outPlayerId?: string, fielderId?: string) => {
    const missing = [];
    if (!striker) missing.push("Striker");
    if (!nonStriker) missing.push("Non-Striker");
    if (!bowler) missing.push("Bowler");
    
    if (missing.length > 0 || !striker || !nonStriker || !bowler) {
      alert(`Please select ${missing.join(', ')} to continue scoring.`);
      return;
    }

    const isLegal = extra !== 'wide' && extra !== 'no_ball';
    const currentOverBalls = inningsBalls.filter(b => b.over_number === Math.floor(activeInnings.overs)).filter(b => b.extra_type !== 'wide' && b.extra_type !== 'no_ball').length;
    
    let nextOverNumber = Math.floor(activeInnings.overs);
    let nextBallNumber = isLegal ? currentOverBalls + 1 : currentOverBalls;

    if (currentOverBalls === 6 && isLegal) {
      nextOverNumber += 1;
      nextBallNumber = 1;
    }

    let extraRuns = 0;
    if (extra === 'wide' || extra === 'no_ball') extraRuns = 1;

    const ball: Omit<Ball, 'id'> = {
      innings_id: activeInnings.id,
      over_number: nextOverNumber,
      ball_number: nextBallNumber,
      batsman_id: striker.id,
      bowler_id: bowler.id,
      runs,
      extra_type: extra,
      extra_runs: extraRuns,
      is_wicket: isWicket,
      wicket_type: wicketType,
      player_out_id: outPlayerId,
      fielder_id: fielderId
    };

    await BallRepo.add(ball);

    // End of over logic - swap strike and prompt for new bowler
    if (nextBallNumber === 6 && isLegal) {
      await db.innings.update(activeInnings.id, {
        striker_id: activeInnings.non_striker_id,
        non_striker_id: activeInnings.striker_id,
        bowler_id: undefined // Require new bowler
      });
    } else {
      // Normal rotation
      if (runs % 2 !== 0) {
        await db.innings.update(activeInnings.id, {
          striker_id: activeInnings.non_striker_id,
          non_striker_id: activeInnings.striker_id
        });
      }
    }

    // Wicket rotation
    if (isWicket && outPlayerId === activeInnings.striker_id) {
       await db.innings.update(activeInnings.id, { striker_id: undefined });
    } else if (isWicket && outPlayerId === activeInnings.non_striker_id) {
       await db.innings.update(activeInnings.id, { non_striker_id: undefined });
    }

    setShowWicketModal(false);
    setSelectedWicketType(null);
    setShowFielderSelectModal(false);
  };

  const handleUndo = async () => {
    if (window.confirm('Undo last ball?')) {
      await BallRepo.undoLastBall(activeInnings.id);
      // It's hard to perfectly reverse batsman strike rotation, but we do standard approach
    }
  };

  const handleEndInnings = async () => {
    if (activeInnings.innings_number === 1) {
      await InningsRepo.create(match.id, activeInnings.bowling_team, activeInnings.batting_team, 2);
    } else {
      await MatchRepo.updateStatus(match.id, 'completed');
      navigate(`/summary/${match.id}`);
    }
  };

  const strStats = striker ? getBatsmanStats(striker.id) : null;
  const nStrStats = nonStriker ? getBatsmanStats(nonStriker.id) : null;
  const bwlStats = bowler ? getBowlerStats(bowler.id) : null;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="bg-primary-600 text-white px-4 py-2.5 shadow flex items-center justify-between">
        <div>
          <div className="font-bold text-base leading-tight">{activeInnings.batting_team}</div>
          <div className="text-xs text-primary-100 font-medium mt-0.5">
            Overs: <span className="text-white font-bold">{activeInnings.overs.toFixed(1)}</span> / {match.overs}
            {activeInnings.innings_number === 2 && (
               <span className="ml-3">Target: <span className="text-white font-bold">{(inningsList!.find(i => i.innings_number === 1)?.runs || 0) + 1}</span></span>
            )}
          </div>
        </div>
        <div className="text-3xl font-black">{activeInnings.runs}/{activeInnings.wickets}</div>
      </div>

      <div className="bg-white dark:bg-gray-800 px-4 py-2 flex gap-2 border-b dark:border-gray-700">
        <button 
          onClick={() => setIsVoiceMode(!isVoiceMode)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${isVoiceMode ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
        >
          {isVoiceMode ? <Mic size={14} /> : <MicOff size={14} />}
          {isVoiceMode ? 'Voice ON' : 'Voice Mode'}
        </button>
        <button 
          onClick={() => setIsTapMode(true)}
          className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-1.5"
        >
          <Pointer size={14} /> Tap Mode
        </button>
      </div>

      <div className="p-3">
        {isMatchComplete ? (
          <Card className="p-6 text-center space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Match Completed</h2>
            <Button onClick={() => navigate(`/summary/${match.id}`)} fullWidth>View Summary</Button>
          </Card>
        ) : isInningsComplete ? (
          <Card className="p-6 text-center space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Innings Break</h2>
            <Button onClick={handleEndInnings} fullWidth>Start Next Innings</Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Card className="p-3 border-l-4 border-l-amber-500 relative">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Batting</div>
                  <button onClick={async () => {
                      await db.innings.update(activeInnings.id, {
                        striker_id: activeInnings.non_striker_id,
                        non_striker_id: activeInnings.striker_id
                      });
                    }} className="text-primary-600 bg-primary-50 p-1 rounded-full active:bg-primary-100 shadow-sm border border-primary-100">
                    <ArrowLeftRight size={14} />
                  </button>
                </div>
                <div 
                  className="flex justify-between items-center py-1 cursor-pointer active:bg-gray-50 dark:bg-gray-900"
                  onClick={() => setShowPlayerSelectModal({type: 'striker', open: true})}
                >
                  <span className="font-bold text-gray-900 dark:text-gray-50 truncate">
                    {striker?.name || 'Select Striker'} <span className="text-amber-500">*</span>
                  </span>
                  {strStats && <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{strStats.runs}({strStats.ballsFaced})</span>}
                </div>
                <div 
                  className="flex justify-between items-center py-1 cursor-pointer active:bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                  onClick={() => setShowPlayerSelectModal({type: 'non_striker', open: true})}
                >
                  <span className="font-medium truncate">{nonStriker?.name || 'Select Non-Striker'}</span>
                  {nStrStats && <span className="text-sm">{nStrStats.runs}({nStrStats.ballsFaced})</span>}
                </div>
              </Card>

              <Card className="p-3 border-l-4 border-l-blue-500">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Bowling</div>
                <div 
                  className="flex justify-between items-center py-1 cursor-pointer active:bg-gray-50 dark:bg-gray-900"
                  onClick={() => setShowPlayerSelectModal({type: 'bowler', open: true})}
                >
                  <span className="font-bold text-gray-900 dark:text-gray-50 truncate">{bowler?.name || 'Select Bowler'}</span>
                  {bwlStats && <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{bwlStats.runsGiven}-{bwlStats.wickets} <span className="text-xs text-gray-400">({bwlStats.overs.toFixed(1)})</span></span>}
                </div>
              </Card>
            </div>

            {/* Last 6 balls */}
            <div className="mb-3">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Recent Balls</div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {inningsBalls.slice(-10).map((b) => {
                  let lbl = b.runs.toString();
                  let color = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200';
                  if (b.extra_type === 'wide') { lbl = b.runs > 0 ? `${b.runs}Wd` : 'Wd'; color = 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'; }
                  else if (b.extra_type === 'no_ball') { lbl = b.runs > 0 ? `${b.runs}Nb` : 'Nb'; color = 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'; }
                  else if (b.is_wicket) { lbl = 'W'; color = 'bg-red-500 border-red-600 text-white'; }
                  else if (b.runs === 4) { color = 'bg-blue-500 border-blue-600 text-white'; }
                  else if (b.runs === 6) { color = 'bg-primary-600 border-primary-700 text-white'; }
                  else if (b.runs === 0) { lbl = '•'; }
                  return (
                     <div key={b.id} className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm ${color}`}>
                        {lbl}
                     </div>
                  );
                })}
              </div>
            </div>

            {/* Over-wise Summary */}
            {inningsBalls.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Over-wise Summary</div>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: Math.max(1, Math.ceil(activeInnings.overs)) }).map((_, idx) => {
                    const overNumber = idx; // 0-indexed over number
                    const overBalls = inningsBalls.filter(b => b.over_number === overNumber);
                    if (overBalls.length === 0) return null;
                    
                    const runsInOver = overBalls.reduce((acc, b) => acc + b.runs + b.extra_runs, 0);
                    const wicketsInOver = overBalls.filter(b => b.is_wicket && b.wicket_type !== 'run_out').length; // exclude runouts from bowler figures unless desired

                    return (
                      <Card key={idx} className="p-3 flex items-center justify-between border-l-2 border-l-primary-500">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-700 font-bold flex items-center justify-center text-sm">
                            {idx + 1}
                          </div>
                          <div className="flex gap-1 overflow-x-auto max-w-[180px] scrollbar-hide items-center">
                            {overBalls.map((b) => {
                              let lbl = b.runs.toString();
                              let color = 'text-gray-600 dark:text-gray-300';
                              if (b.extra_type === 'wide') { lbl = b.runs > 0 ? `${b.runs}Wd` : 'Wd'; }
                              else if (b.extra_type === 'no_ball') { lbl = b.runs > 0 ? `${b.runs}Nb` : 'Nb'; }
                              else if (b.is_wicket) { lbl = 'W'; color = 'text-red-600 font-bold'; }
                              else if (b.runs === 4) { color = 'text-blue-600 font-bold'; }
                              else if (b.runs === 6) { color = 'text-primary-600 font-bold'; }
                              else if (b.runs === 0) { lbl = '•'; }
                              return (
                                <span key={b.id} className={`text-sm ${color}`}>
                                  {lbl}
                                </span>
                              );
                            }).reduce((prev, curr) => [prev, <span className="text-gray-300 text-xs mx-0.5">|</span>, curr] as any)}
                          </div>
                        </div>
                        <div className="font-bold text-gray-900 dark:text-gray-50 border bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-md text-sm">
                          {runsInOver} runs {wicketsInOver > 0 && <span className="text-red-500 ml-1">{wicketsInOver}W</span>}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scoring Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <Button variant="secondary" className="h-16 text-xl font-bold rounded-2xl" onClick={() => handleScoreBall(0)}>•</Button>
              <Button variant="secondary" className="h-16 text-xl font-bold rounded-2xl" onClick={() => handleScoreBall(1)}>1</Button>
              <Button variant="secondary" className="h-16 text-xl font-bold rounded-2xl" onClick={() => handleScoreBall(2)}>2</Button>
              <Button variant="secondary" className="h-16 text-xl font-bold rounded-2xl" onClick={() => handleScoreBall(3)}>3</Button>
            </div>
            
            <div className="grid grid-cols-4 gap-2 mb-2">
              <Button variant="primary" className="h-16 text-xl font-bold rounded-2xl bg-blue-500 hover:bg-blue-600" onClick={() => handleScoreBall(4)}>4</Button>
              <Button variant="primary" className="h-16 text-xl font-bold rounded-2xl" onClick={() => handleScoreBall(6)}>6</Button>
              <Button variant="danger" className="h-16 text-xl font-bold rounded-2xl col-span-2" onClick={() => setShowWicketModal(true)}>WICKET</Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-14 font-bold border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800" onClick={() => setShowExtraRunsModal('wide')}>WD</Button>
              <Button variant="outline" className="h-14 font-bold border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:bg-gray-800" onClick={() => setShowExtraRunsModal('no_ball')}>NB</Button>
              <Button variant="ghost" className="h-14 font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700" onClick={handleUndo}>
                <Undo2 size={20} />
              </Button>
            </div>
          </>
        )}
      </div>

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
                      setShowFielderSelectModal(true);
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
            
            <div className="mt-4 border-t pt-4">
              <Button variant="ghost" fullWidth onClick={() => setShowWicketModal(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {showFielderSelectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">Select Fielder</h3>
            <div className="space-y-2">
              {bowlingTeamPlayers.map(p => (
                <button 
                  key={p.id}
                  onClick={() => handleScoreBall(0, 'none', true, selectedWicketType!, selectedWicketType === 'run_out' ? (Math.random() > 0.5 ? striker?.id : nonStriker?.id) : striker?.id, p.id)}
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
                 const pid = await PlayerRepo.add(newPlayerName.trim());
                 const team = showPlayerSelectModal.type === 'bowler' 
                   ? (activeInnings.bowling_team === match.teamA ? 'A' : 'B')
                   : (activeInnings.batting_team === match.teamA ? 'A' : 'B');
                 await MatchRepo.addPlayerToTeam(match.id, team, pid);
                 
                 const updateObj: any = {};
                 if (showPlayerSelectModal.type === 'striker') updateObj.striker_id = pid;
                 if (showPlayerSelectModal.type === 'non_striker') updateObj.non_striker_id = pid;
                 if (showPlayerSelectModal.type === 'bowler') updateObj.bowler_id = pid;
                 
                 await db.innings.update(activeInnings.id, updateObj);
                 setNewPlayerName('');
                 setShowPlayerSelectModal({type: 'striker', open: false});
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
                    await db.innings.update(activeInnings.id, updateObj);
                    setShowPlayerSelectModal({type: 'striker', open: false});
                  }}
                  className={`w-full py-3 px-4 rounded-xl text-left font-semibold ${
                    activeInnings.striker_id === p.id || activeInnings.non_striker_id === p.id || activeInnings.bowler_id === p.id 
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 opacity-50 cursor-not-allowed' 
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 active:bg-primary-50 active:border-primary-200'
                  }`}
                  disabled={activeInnings.striker_id === p.id || activeInnings.non_striker_id === p.id || activeInnings.bowler_id === p.id}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <Button variant="ghost" fullWidth className="mt-4" onClick={() => setShowPlayerSelectModal({type: 'striker', open: false})}>Close</Button>
          </div>
        </div>
      )}

      {showExtraRunsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-5 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4 text-center">
              Runs on {showExtraRunsModal === 'wide' ? 'Wide' : 'No Ball'}
            </h3>
            
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[0, 1, 2, 3, 4].map(r => (
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
            
            <div className="mt-4 border-t pt-4">
              <Button variant="ghost" fullWidth onClick={() => setShowExtraRunsModal(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {isTapMode && (
        <div className="fixed inset-0 bg-primary-600 z-[100] flex flex-col select-none touch-none">
          <div className="p-4 flex justify-between items-center bg-primary-700 text-white">
            <div className="font-bold">TAP MODE (Pocket Friendly)</div>
            <button onClick={() => setIsTapMode(false)} className="p-2 bg-white/10 rounded-full"><X size={24} /></button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center text-white" onClick={() => setTapRuns(r => r + 1)}>
            <div className="text-sm opacity-70 mb-2">Tap anywhere to count runs</div>
            <div className="text-9xl font-black">{tapRuns}</div>
            <div className="mt-10 text-xl font-bold opacity-80">Striker: {striker?.name}</div>
          </div>
          
          <div className="p-6 grid grid-cols-2 gap-4 bg-primary-700">
            <Button variant="outline" className="h-16 border-white/30 text-white hover:bg-white/10" onClick={() => { handleScoreBall(tapRuns); setTapRuns(0); }}>CONFIRM {tapRuns} RUNS</Button>
            <Button variant="outline" className="h-16 border-white/30 text-white hover:bg-white/10" onClick={() => setTapRuns(0)}>RESET</Button>
          </div>
        </div>
      )}

    </div>
  );
};

export default LiveScoring;
