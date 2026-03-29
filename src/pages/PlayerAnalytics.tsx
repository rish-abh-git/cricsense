import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import Card from '../components/Card';
import { Activity, BarChart2, Trophy } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useLocation } from 'react-router-dom';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PlayerAnalytics: React.FC = () => {
  const location = useLocation();
  const [selectedPlayer, setSelectedPlayer] = useState<string>(location.state?.selectedPlayer || '');

  const players = useLiveQuery(async () => {
    const all = await db.players.toArray();
    return all.filter(p => p.is_morya_warrior && !/\d/.test(p.name)).sort((a, b) => a.name.localeCompare(b.name));
  }) || [];
  const matches = useLiveQuery(() => db.matches.toArray()) || [];
  const activeMatches = useMemo(() => matches.filter(m => !m.is_archived), [matches]);
  const activeMatchIds = useMemo(() => new Set(activeMatches.map(m => m.id)), [activeMatches]);

  const innings = useLiveQuery(() => db.innings.toArray()) || [];
  const activeInningsIds = useMemo(() => new Set(innings.filter(i => activeMatchIds.has(i.match_id)).map(i => i.id)), [innings, activeMatchIds]);

  const balls = useLiveQuery(() => db.balls.toArray()) || [];
  const activeBalls = useMemo(() => balls.filter(b => activeInningsIds.has(b.innings_id)), [balls, activeInningsIds]);

  const playerStats = useMemo(() => {
    if (!selectedPlayer || !activeBalls.length) return null;

    const pb = activeBalls.filter(b => b.batsman_id === selectedPlayer);

    const matchRunsMap = new Map<string, { runs: number, balls: number, dots: number, fours: number, sixes: number, wickets: number, runsGiven: number, bowledLegalBalls: number }>();

    pb.forEach(b => {
      const inn = innings.find(i => i.id === b.innings_id);
      if (!inn) return;
      const mId = inn.match_id;

      const st = matchRunsMap.get(mId) || { runs: 0, balls: 0, dots: 0, fours: 0, sixes: 0, wickets: 0, runsGiven: 0, bowledLegalBalls: 0 };
      st.runs += b.runs;
      if (b.extra_type !== 'wide') st.balls += 1;
      if (b.runs === 0 && !b.is_wicket && b.extra_type === 'none') st.dots += 1;
      if (b.runs === 4) st.fours += 1;
      if (b.runs === 6) st.sixes += 1;
      matchRunsMap.set(mId, st);
    });

    const runTrend: number[] = [];
    const srTrend: number[] = [];
    const labels: string[] = [];

    let totalRuns = 0;
    let totalBallsFaced = 0;
    let dotsFaced = 0;
    let fours = 0;
    let sixes = 0;

    pb.forEach(b => {
      totalRuns += b.runs;
      if (b.extra_type !== 'wide') totalBallsFaced++;
      if (b.runs === 0 && !b.is_wicket && b.extra_type === 'none') dotsFaced++;
      if (b.runs === 4) fours++;
      if (b.runs === 6) sixes++;
    });

    // Bowling Stats
    const bowlingBalls = activeBalls.filter(b => b.bowler_id === selectedPlayer);
    let runsGiven = 0;
    let wickets = 0;
    let bowledLegalBalls = 0;

    bowlingBalls.forEach(b => {
      runsGiven += (b.runs + b.extra_runs);
      if (b.is_wicket && b.wicket_type !== 'run_out') wickets++;
      if (b.extra_type !== 'wide' && b.extra_type !== 'no_ball') bowledLegalBalls++;
      
      const inn = innings.find(i => i.id === b.innings_id);
      if (inn) {
        const mId = inn.match_id;
        const st = matchRunsMap.get(mId) || { runs: 0, balls: 0, dots: 0, fours: 0, sixes: 0, wickets: 0, runsGiven: 0, bowledLegalBalls: 0 };
        st.runsGiven += (b.runs + b.extra_runs);
        if (b.is_wicket && b.wicket_type !== 'run_out') st.wickets++;
        if (b.extra_type !== 'wide' && b.extra_type !== 'no_ball') st.bowledLegalBalls++;
        matchRunsMap.set(mId, st);
      }
    });

    // Fielding Stats
    const fieldingBalls = activeBalls.filter(b => b.fielder_id === selectedPlayer);
    let catches = 0;
    let runouts = 0;
    fieldingBalls.forEach(b => {
      if (b.wicket_type === 'caught' || b.wicket_type === 'stumped') catches++;
      if (b.wicket_type === 'run_out') runouts++;
    });

    const gullyScore = totalRuns + (20 * wickets) + (10 * catches) + (10 * runouts) - dotsFaced;

    const matchDetails: any[] = [];
    matchRunsMap.forEach((st, mId) => {
      const match = activeMatches.find(m => m.id === mId);
      if (match) {
        const dateStr = new Date(match.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (st.balls > 0) {
          labels.push(dateStr);
          runTrend.push(st.runs);
          srTrend.push(Math.round((st.runs / st.balls) * 100));
        }
        
        matchDetails.push({
          id: mId,
          date: dateStr,
          vs: match.teamA === (match.teamAPlayers.includes(selectedPlayer) ? match.teamA : match.teamB) ? match.teamB : match.teamA,
          bat: { runs: st.runs, balls: st.balls, fours: st.fours, sixes: st.sixes, dots: st.dots },
          bowl: { wickets: st.wickets, runs: st.runsGiven, overs: (st.bowledLegalBalls / 6).toFixed(1) }
        });
      }
    });
    
    matchDetails.sort((a, b) => b.id.localeCompare(a.id)); // simple sort or sort by timestamp if available

    return {
      totalRuns,
      totalBallsFaced,
      sr: totalBallsFaced > 0 ? Math.round((totalRuns / totalBallsFaced) * 100) : 0,
      dotPct: totalBallsFaced > 0 ? Math.round((dotsFaced / totalBallsFaced) * 100) : 0,
      fours,
      sixes,
      runsGiven,
      wickets,
      catches,
      runouts,
      gullyScore,
      oversBowled: bowledLegalBalls / 6,
      economy: bowledLegalBalls > 0 ? Number((runsGiven / (bowledLegalBalls / 6)).toFixed(1)) : 0,
      chartData: {
        labels,
        datasets: [
          {
            label: 'Runs',
            data: runTrend,
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f6',
            yAxisID: 'y',
            tension: 0.3
          },
          {
            label: 'Strike Rate',
            data: srTrend,
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            borderDash: [5, 5],
            yAxisID: 'y1',
            tension: 0.3,
            hidden: false
          }
        ]
      },
      matchDetails
    };
  }, [selectedPlayer, activeBalls, activeMatches, innings]);

  return (
    <div className="p-4 space-y-4 safe-area-bottom pb-20 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Player Analytics</h2>

      <select
        className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20"
        value={selectedPlayer}
        onChange={(e) => setSelectedPlayer(e.target.value)}
      >
        <option value="">Select a Player</option>
        {players.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {selectedPlayer && playerStats ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-to-br from-primary-600 to-primary-700 text-white flex items-center gap-3 border-0 shadow-lg shadow-primary-500/20">
              <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center">
                <Trophy size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-primary-100 uppercase">Gully Score</p>
                <p className="text-xl font-black">{playerStats.gullyScore}</p>
              </div>
            </Card>
            <Card className="p-4 bg-white dark:bg-gray-800 flex items-center gap-3 shadow-sm border-gray-100 dark:border-gray-700">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Activity size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Runs Scored</p>
                <p className="text-xl font-black text-gray-900 dark:text-gray-50">{playerStats.totalRuns}</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 bg-white dark:bg-gray-800 flex flex-col justify-center text-center shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Balls Faced</p>
              <p className="text-lg font-black text-gray-900 dark:text-gray-50">{playerStats.totalBallsFaced}</p>
            </Card>
            <Card className="p-3 bg-white dark:bg-gray-800 flex flex-col justify-center text-center shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Strike Rate</p>
              <p className="text-lg font-black text-gray-900 dark:text-gray-50">{playerStats.sr}</p>
            </Card>
            <Card className="p-3 bg-white dark:bg-gray-800 flex flex-col justify-center text-center shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Dot %</p>
              <p className="text-lg font-black text-gray-900 dark:text-gray-50">{playerStats.dotPct}%</p>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-white dark:bg-gray-800 flex flex-col justify-center shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Boundaries (4s/6s)</p>
              <p className="text-xl font-black text-gray-900 dark:text-gray-50">{playerStats.fours} / {playerStats.sixes}</p>
            </Card>
            <Card className="p-4 bg-white dark:bg-gray-800 flex flex-col justify-center shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Fielding (C/RO)</p>
              <p className="text-xl font-black text-gray-900 dark:text-gray-50">{playerStats.catches} / {playerStats.runouts}</p>
            </Card>
          </div>

          <h3 className="font-bold text-gray-900 dark:text-gray-50 mt-6 mb-2">Bowling Performance</h3>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 bg-white dark:bg-gray-800 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Wickets</p>
              <p className="text-xl font-black text-rose-500">{playerStats.wickets}</p>
            </Card>
            <Card className="p-3 bg-white dark:bg-gray-800 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Economy</p>
              <p className="text-xl font-black text-gray-900 dark:text-gray-50">{playerStats.economy}</p>
            </Card>
            <Card className="p-3 bg-white dark:bg-gray-800 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Runs Given</p>
              <p className="text-xl font-black text-gray-900 dark:text-gray-50">{playerStats.runsGiven}</p>
            </Card>
          </div>

          {playerStats.chartData.labels.length > 0 && (
            <Card className="p-4 bg-white dark:bg-gray-800 mt-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-4">Performance Trend</h3>
              <div className="h-56">
                <Line
                  data={playerStats.chartData}
                  options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                      y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Runs' } },
                      y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'SR' } },
                    }
                  }}
                />
              </div>
            </Card>
          )}
          
          {playerStats.matchDetails.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-2">Match History</h3>
              {playerStats.matchDetails.map(m => (
                <Card key={m.id} className="p-4 bg-white dark:bg-gray-800 flex flex-col gap-2">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="font-bold text-sm">vs {m.vs}</span>
                    <span className="text-xs text-gray-500">{m.date}</span>
                  </div>
                  <div className="flex bg-white dark:bg-gray-800 rounded-lg p-2 items-center justify-between border border-gray-100 dark:border-gray-700">
                    <div className="text-sm font-medium pr-3 border-r border-gray-100 dark:border-gray-700 w-16 opacity-80">Bat</div>
                    <div className="flex-1 flex justify-around pl-2">
                       <span className="text-sm font-black text-gray-900 dark:text-gray-100 min-w-[3rem]">{m.bat.runs} <span className="text-[10px] text-gray-500 font-normal">({m.bat.balls})</span></span>
                       <span className="text-[10px] sm:text-xs font-bold text-teal-600 dark:text-teal-400" title="Strike Rate">SR: {m.bat.balls > 0 ? Math.round((m.bat.runs / m.bat.balls)*100) : 0}</span>
                       <span className="text-xs font-bold text-gray-500 hidden sm:inline-block" title="Dots">• {m.bat.dots}</span>
                       <span className="text-xs font-bold text-blue-600" title="Fours">4s: {m.bat.fours}</span>
                       <span className="text-xs font-bold text-primary-600" title="Sixes">6s: {m.bat.sixes}</span>
                    </div>
                  </div>
                  {(parseInt(m.bowl.overs) > 0 || m.bowl.runs > 0) && (
                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-400 uppercase">Bowling</span>
                      <p className="text-sm font-semibold text-rose-500">{m.bowl.wickets}/{m.bowl.runs} <span className="text-xs font-normal text-gray-500 ml-1">({m.bowl.overs})</span></p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card className="p-8 text-center bg-gray-50 dark:bg-gray-900 border-dashed border-2 border-gray-200 dark:border-gray-700">
          <BarChart2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Select a player to view analytics</p>
        </Card>
      )}
    </div>
  );
};

export default PlayerAnalytics;
