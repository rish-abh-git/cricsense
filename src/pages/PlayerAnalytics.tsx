import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import Card from '../components/Card';
import { TrendingUp, Activity, BarChart2 } from 'lucide-react';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PlayerAnalytics: React.FC = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');

  const players = useLiveQuery(() => db.players.toArray()) || [];
  const balls = useLiveQuery(() => db.balls.toArray()) || [];
  const matches = useLiveQuery(() => db.matches.toArray()) || [];
  const innings = useLiveQuery(() => db.innings.toArray()) || [];

  const playerStats = useMemo(() => {
    if (!selectedPlayer || !balls.length) return null;

    const pb = balls.filter(b => b.batsman_id === selectedPlayer);
    
    // Group by match
    const matchRunsMap = new Map<string, {runs: number, balls: number}>();
    
    pb.forEach(b => {
      const inn = innings.find(i => i.id === b.innings_id);
      if (!inn) return;
      const mId = inn.match_id;
      
      const st = matchRunsMap.get(mId) || { runs: 0, balls: 0};
      st.runs += b.runs;
      if (b.extra_type !== 'wide') st.balls += 1;
      matchRunsMap.set(mId, st);
    });

    const runTrend: number[] = [];
    const srTrend: number[] = [];
    const labels: string[] = [];
    
    let totalRuns = 0;
    let totalBalls = 0;
    let dots = 0;
    let fours = 0;
    let sixes = 0;

    pb.forEach(b => {
      totalRuns += b.runs;
      if (b.extra_type !== 'wide') totalBalls++;
      if (b.runs === 0 && !b.is_wicket && b.extra_type === 'none') dots++;
      if (b.runs === 4) fours++;
      if (b.runs === 6) sixes++;
    });

    // Bowling Stats
    const bowlingBalls = balls.filter(b => b.bowler_id === selectedPlayer);
    let runsGiven = 0;
    let wickets = 0;
    let bowledLegalBalls = 0;

    bowlingBalls.forEach(b => {
       runsGiven += (b.runs + b.extra_runs);
       if (b.is_wicket && b.wicket_type !== 'run_out') wickets++;
       if (b.extra_type !== 'wide' && b.extra_type !== 'no_ball') bowledLegalBalls++;
    });

    matchRunsMap.forEach((st, mId) => {
      const match = matches.find(m => m.id === mId);
      if (match) {
        labels.push(new Date(match.date).toLocaleDateString([], { month: 'short', day: 'numeric' }));
        runTrend.push(st.runs);
        srTrend.push(st.balls > 0 ? Math.round((st.runs / st.balls) * 100) : 0);
      }
    });

    return {
      totalRuns,
      totalBalls,
      sr: totalBalls > 0 ? Math.round((totalRuns / totalBalls) * 100) : 0,
      dotPct: totalBalls > 0 ? Math.round((dots / totalBalls) * 100) : 0,
      fours,
      sixes,
      runsGiven,
      wickets,
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
             borderDash: [5, 5],
             yAxisID: 'y1',
             tension: 0.3,
             hidden: true
          }
        ]
      }
    };
  }, [selectedPlayer, balls, matches, innings]);

  return (
    <div className="p-4 space-y-4 safe-area-bottom pb-20 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Player Analytics</h2>

      <select 
        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20"
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
             <Card className="p-4 bg-white flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                 <Activity size={20} />
               </div>
               <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Runs</p>
                  <p className="text-xl font-black text-gray-900">{playerStats.totalRuns}</p>
               </div>
             </Card>
             <Card className="p-4 bg-white flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                 <TrendingUp size={20} />
               </div>
               <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Strike Rate</p>
                  <p className="text-xl font-black text-gray-900">{playerStats.sr}</p>
               </div>
             </Card>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <Card className="p-4 bg-white flex flex-col justify-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Boundaries (4s/6s)</p>
                <p className="text-xl font-black text-gray-900">{playerStats.fours} / {playerStats.sixes}</p>
             </Card>
             <Card className="p-4 bg-white flex flex-col justify-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Dot Ball %</p>
                <p className="text-xl font-black text-gray-900">{playerStats.dotPct}%</p>
             </Card>
          </div>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">Bowling Performance</h3>
          <div className="grid grid-cols-3 gap-3">
             <Card className="p-3 bg-white text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Wickets</p>
                <p className="text-xl font-black text-rose-500">{playerStats.wickets}</p>
             </Card>
             <Card className="p-3 bg-white text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Economy</p>
                <p className="text-xl font-black text-gray-900">{playerStats.economy}</p>
             </Card>
             <Card className="p-3 bg-white text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Runs Given</p>
                <p className="text-xl font-black text-gray-900">{playerStats.runsGiven}</p>
             </Card>
          </div>

          {playerStats.chartData.labels.length > 0 && (
            <Card className="p-4 bg-white mt-4">
               <h3 className="font-bold text-gray-900 mb-4">Performance Trend</h3>
               <div className="h-56">
                 <Line 
                   data={playerStats.chartData} 
                   options={{ 
                     maintainAspectRatio: false, 
                     responsive: true,
                     interaction: { mode: 'index', intersect: false },
                     scales: {
                       y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'Runs'} },
                       y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: {display: true, text: 'SR'} },
                     }
                   }} 
                 />
               </div>
            </Card>
          )}
        </div>
      ) : (
        <Card className="p-8 text-center bg-gray-50 border-dashed border-2 border-gray-200">
           <BarChart2 size={40} className="mx-auto text-gray-300 mb-3" />
           <p className="text-gray-500 font-medium">Select a player to view analytics</p>
        </Card>
      )}
    </div>
  );
};

export default PlayerAnalytics;
