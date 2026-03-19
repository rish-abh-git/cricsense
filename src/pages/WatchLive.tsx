import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { ArrowLeft, Trophy, Timer, Zap } from 'lucide-react';
import Card from '../components/Card';
import type { Ball } from '../database/schema';

const WatchLive: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();

  const match = useLiveQuery(() => db.matches.get(matchId || ''));
  const allPlayers = useLiveQuery(() => db.players.toArray()) || [];
  
  const activeInnings = useLiveQuery(async () => {
    if (!matchId) return null;
    const list = await db.innings.where('match_id').equals(matchId).toArray();
    if (list.length === 0) return null;
    return list.reduce((prev, current) => (prev.innings_number > current.innings_number) ? prev : current);
  }, [matchId]);

  const balls = useLiveQuery(() => 
    matchId ? db.balls.where('innings_id').equals(activeInnings?.id || '').toArray() : []
  , [activeInnings?.id]);

  const [inningsBalls, setInningsBalls] = useState<Ball[]>([]);
  const ballTimelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (balls) {
      const iballs = [...balls].sort((a, b) => {
        if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
        if (a.over_number !== b.over_number) return a.over_number - b.over_number;
        return a.ball_number - b.ball_number;
      });
      setInningsBalls(iballs);
    }
  }, [balls]);

  useEffect(() => {
    if (ballTimelineRef.current) {
      ballTimelineRef.current.scrollLeft = ballTimelineRef.current.scrollWidth;
    }
  }, [inningsBalls]);

  if (!match || !activeInnings) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-950 text-white">
        <div className="w-20 h-20 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-primary-400 font-black uppercase tracking-[0.2em] animate-pulse">Initializing Broadcast Feed...</p>
      </div>
    );
  }

  const striker = allPlayers.find(p => p.id === activeInnings.striker_id);
  const nonStriker = allPlayers.find(p => p.id === activeInnings.non_striker_id);
  const bowler = allPlayers.find(p => p.id === activeInnings.bowler_id);

  const getBatsmanStats = (id: string) => {
    const bBalls = inningsBalls.filter(b => b.batsman_id === id);
    const runs = bBalls.reduce((acc, b) => acc + b.runs, 0);
    const ballsFaced = bBalls.filter(b => b.extra_type !== 'wide').length;
    const history = bBalls.map(b => {
      if (b.is_wicket) return 'W';
      if (b.extra_type === 'wide') return 'Wd';
      if (b.extra_type === 'no_ball') return 'Nb';
      return b.runs.toString();
    }).slice(-8); // Only last 8 balls for mini-sparkline
    return { runs, ballsFaced, history };
  };

  const getBowlerStats = (id: string) => {
    const bBalls = inningsBalls.filter(b => b.bowler_id === id);
    const runsGiven = bBalls.reduce((acc, b) => acc + b.runs + b.extra_runs, 0);
    const wickets = bBalls.filter(b => b.is_wicket && b.wicket_type !== 'run_out').length;
    const legalBalls = bBalls.filter(b => b.extra_type !== 'wide' && b.extra_type !== 'no_ball').length;
    const overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;
    return { runsGiven, wickets, overs };
  };

  const strStats = striker ? getBatsmanStats(striker.id) : null;
  const nStrStats = nonStriker ? getBatsmanStats(nonStriker.id) : null;
  const bwlStats = bowler ? getBowlerStats(bowler.id) : null;

  const getBallDisplay = (b: Ball) => {
    let lbl = b.runs.toString();
    let color = 'bg-white/10 border-white/20 text-white';
    if (b.extra_type === 'wide') { lbl = 'WD'; color = 'bg-amber-500 border-amber-600 text-black'; }
    else if (b.extra_type === 'no_ball') { lbl = 'NB'; color = 'bg-amber-500 border-amber-600 text-black'; }
    else if (b.is_wicket) { lbl = 'W'; color = 'bg-red-600 border-red-700 text-white animate-bounce shadow-lg shadow-red-500/50'; }
    else if (b.runs === 4) { color = 'bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-500/50'; }
    else if (b.runs === 6) { color = 'bg-primary-600 border-primary-700 text-white shadow-lg shadow-primary-500/50 animate-pulse'; }
    else if (b.runs === 0) { lbl = '•'; }
    return { lbl, color };
  };

  const innings1Runs = match.firstInningsTotal || 0;
  const target = innings1Runs + 1;
  const runsNeeded = target - activeInnings.runs;
  const totalBalls = match.overs * 6;
  const ballsRemaining = totalBalls - activeInnings.balls_bowled;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-primary-500/30 overflow-x-hidden">
      {/* Top Banner - Target/Status */}
      <div className="bg-primary-600 text-black py-1 px-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2">
          <Zap size={10} fill="currentColor" />
          {activeInnings.innings_number === 2 
            ? `TARGET: ${target} | NEED ${runsNeeded} RUNS IN ${ballsRemaining} BALLS`
            : `FIRST INNINGS | OVERS: ${match.overs}`
          }
          <Zap size={10} fill="currentColor" />
        </p>
      </div>

      {/* Main Scoreboard Section */}
      <div className="relative pt-8 pb-12 px-6 overflow-hidden">
        {/* Abstract Background Decorations */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-600/10 rounded-full -mr-64 -mt-64 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-600/10 rounded-full -ml-32 -mb-32 blur-[80px]" />

        <div className="max-w-6xl mx-auto flex flex-col items-center">
          <div className="flex items-center gap-4 mb-2">
            <span className="px-2 py-0.5 bg-red-600 text-[10px] font-black uppercase tracking-widest rounded animate-pulse">Live</span>
            <div className="h-px w-12 bg-white/20" />
            <span className="text-gray-400 font-black uppercase tracking-widest text-xs">{match.teamA} VS {match.teamB}</span>
            <div className="h-px w-12 bg-white/20" />
          </div>

          <h2 className="text-primary-500 text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2">
            {activeInnings.batting_team}
          </h2>

          <div className="flex flex-col items-center justify-center">
             <div className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter tabular-nums flex items-baseline gap-2">
                {activeInnings.runs}
                <span className="text-white/20 text-7xl md:text-9xl">/</span>
                <span className="text-primary-500">{activeInnings.wickets}</span>
             </div>
             <div className="flex items-center gap-8 -mt-4 md:-mt-8">
                <div className="flex flex-col items-center">
                  <div className="text-4xl md:text-6xl font-black text-white tabular-nums">
                    {activeInnings.overs.toFixed(1)}
                  </div>
                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Overs Bowled</div>
                </div>
                {activeInnings.innings_number === 2 && (
                   <div className="h-12 w-px bg-white/10" />
                )}
                {activeInnings.innings_number === 2 && (
                  <div className="flex flex-col items-center text-primary-500">
                    <div className="text-4xl md:text-6xl font-black tabular-nums">{runsNeeded}</div>
                    <div className="text-[10px] font-black text-primary-500/60 uppercase tracking-[0.2em]">Required</div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Ticker Section */}
      <div className="bg-white/5 border-y border-white/10 py-4 shadow-2xl relative overflow-hidden group">
         <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-950 to-transparent z-10" />
         <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-950 to-transparent z-10" />
         
         <div 
           ref={ballTimelineRef}
           className="flex gap-6 overflow-x-auto px-12 scrollbar-hide snap-x"
         >
            {inningsBalls.slice(-15).map((b, idx) => {
              const { lbl, color } = getBallDisplay(b);
              return (
                <div key={idx} className="flex flex-col items-center gap-2 snap-end group-hover:scale-110 transition-transform">
                   <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center font-black text-xl md:text-2xl border-4 ${color}`}>
                      {lbl}
                   </div>
                   <div className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                      {b.over_number}.{b.ball_number}
                   </div>
                </div>
              );
            })}
         </div>
      </div>

      {/* Players Section */}
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Batsmen List */}
        <div className="space-y-4">
           <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-4">
              <span className="w-8 h-px bg-gray-800" /> Current Batting <span className="w-8 h-px bg-gray-800" />
           </h3>
           {[ {p: striker, s: strStats, active: true}, {p: nonStriker, s: nStrStats, active: false} ].map((item, idx) => (
             <Card key={idx} className={`p-6 border-none bg-gradient-to-br transition-all duration-500 ${item.active ? 'from-white/10 to-white/5 shadow-primary-500/5 shadow-2xl scale-[1.02]' : 'from-transparent to-transparent opacity-40 grayscale-[0.8]'}`}>
                <div className="flex justify-between items-center">
                   <div className="flex gap-4 items-center">
                      <div className={`w-1.5 h-12 rounded-full ${item.active ? 'bg-primary-500 animate-pulse' : 'bg-gray-700'}`} />
                      <div>
                        <div className="text-2xl md:text-3xl font-black tracking-tight">{item.p?.name || '---'}</div>
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
                          {item.active ? 'STRIKER' : 'NON-STRIKER'}
                        </div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-5xl font-black tabular-nums">{item.s?.runs || 0}</div>
                      <div className="text-xs font-bold text-primary-500/60 uppercase tracking-widest leading-none">
                        ({item.s?.ballsFaced || 0} BALLS)
                      </div>
                   </div>
                </div>
                {item.s && item.s.history.length > 0 && (
                   <div className="mt-6 flex gap-1.5 justify-end">
                      {item.s.history.map((ball, bIdx) => (
                        <div key={bIdx} className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-black ${
                          ball === 'W' ? 'bg-red-500' : ball === '4' ? 'bg-blue-600' : ball === '6' ? 'bg-primary-600' : 'bg-white/10 text-gray-400'
                        }`}>
                          {ball === '0' ? '•' : ball}
                        </div>
                      ))}
                   </div>
                )}
             </Card>
           ))}
        </div>

        {/* Bowler Details */}
        <div className="space-y-4">
           <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-4">
              <span className="w-8 h-px bg-gray-800" /> Current Bowling <span className="w-8 h-px bg-gray-800" />
           </h3>
           <Card className="p-8 border-none bg-gradient-to-br from-blue-900/40 to-blue-950/20 shadow-2xl flex flex-col justify-center min-h-[220px]">
              <div className="flex justify-between items-start mb-8">
                 <div className="flex-1">
                    <div className="text-3xl md:text-4xl font-black tracking-tight leading-tight">{bowler?.name || '---'}</div>
                    <div className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest mt-2 flex items-center gap-2">
                       <Timer size={12} /> SPELL: {bwlStats?.overs.toFixed(1) || '0.0'} OVERS
                    </div>
                 </div>
                 <div className="text-right">
                    <div className="text-6xl font-black text-primary-500 tabular-nums leading-none">
                       {bwlStats?.wickets || 0}
                    </div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Wickets</div>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
                 <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Runs Given</div>
                    <div className="text-2xl font-black tabular-nums">{bwlStats?.runsGiven || 0}</div>
                 </div>
                 <div className="text-right">
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Economy</div>
                    <div className="text-2xl font-black tabular-nums">
                      {bwlStats && bwlStats.overs > 0 ? (bwlStats.runsGiven / bwlStats.overs).toFixed(2) : '0.00'}
                    </div>
                 </div>
              </div>
           </Card>
        </div>
      </div>

      {/* Exit Button - Bottom Floating */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
         <Link to="/" className="bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 px-6 py-3 rounded-full flex items-center gap-3 transition-all active:scale-95 group shadow-2xl">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-black uppercase tracking-widest text-xs">Exit Feed</span>
         </Link>
      </div>

      <div className="pb-10 pt-4 text-center opacity-20 flex flex-col items-center">
         <Trophy size={20} className="mb-2" />
         <p className="text-[8px] font-black uppercase tracking-[0.5em]">CricSense Broadcaster Pro</p>
      </div>
    </div>
  );
};

export default WatchLive;
