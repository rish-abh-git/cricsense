import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import Button from '../components/Button';
import Card from '../components/Card';
import { Share2, Home } from 'lucide-react';
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

  const match = useLiveQuery(() => db.matches.get(matchId || ''));
  const innings = useLiveQuery(() => db.innings.where('match_id').equals(matchId || '').toArray());
  const balls = useLiveQuery(() => db.balls.toArray());
  const players = useLiveQuery(() => db.players.toArray());

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
    const batsmanStats = new Map<string, { runs: number, balls: number }>();
    const bowlerStats = new Map<string, { wickets: number, runs: number }>();
    let totalDots = 0;
    let totalBoundaries = 0;
    let totalLegalBalls = 0;
    
    const mBalls = balls.filter(b => innings.some(i => i.id === b.innings_id));
    
    mBalls.forEach(b => {
      // Batter stats
      const bStat = batsmanStats.get(b.batsman_id) || { runs: 0, balls: 0 };
      bStat.runs += b.runs;
      if (b.extra_type !== 'wide') bStat.balls += 1;
      batsmanStats.set(b.batsman_id, bStat);
      
      // Bowler stats
      const blStat = bowlerStats.get(b.bowler_id) || { wickets: 0, runs: 0 };
      blStat.runs += b.runs + b.extra_runs;
      if (b.is_wicket && b.wicket_type !== 'run_out') blStat.wickets += 1;
      bowlerStats.set(b.bowler_id, blStat);

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
    const overLabels = Array.from({length: match.overs}, (_, i) => `Over ${i+1}`);
    const team1Data = new Array(match.overs).fill(0);
    const team2Data = new Array(match.overs).fill(0);

    if (i1) {
      mBalls.filter(b => b.innings_id === i1.id && b.over_number <= match.overs).forEach(b => {
        team1Data[b.over_number - 1] += (b.runs + b.extra_runs);
      });
    }
    if (i2) {
      mBalls.filter(b => b.innings_id === i2.id && b.over_number <= match.overs).forEach(b => {
        team2Data[b.over_number - 1] += (b.runs + b.extra_runs);
      });
    }

    const cdata = {
      labels: overLabels,
      datasets: [
        { label: i1?.batting_team || 'Team 1', data: team1Data, backgroundColor: '#3b82f6' },
        ...(i2 ? [{ label: i2.batting_team, data: team2Data, backgroundColor: '#10b981' }] : [])
      ]
    };

    const sText = `🏆 Match Result\n\n` +
      `${i1?.batting_team}: ${i1?.runs}/${i1?.wickets} (${i1?.overs.toFixed(1)} ov)\n` +
      `${i2 ? `${i2.batting_team}: ${i2.runs}/${i2.wickets} (${i2.overs.toFixed(1)} ov)\n` : ''}\n` +
      `${winner}\n\n` +
      `⭐ Top Scorer: ${tsPlayer?.name || '-'} ${topSm.runs} (${topSm.balls})\n` +
      `🎯 Best Bowler: ${bbPlayer?.name || '-'} ${bestBm.wickets}/${bestBm.runs}\n\n` +
      `📊 Team Analytics:\n` +
      `Dot Balls: ${Math.round((totalDots/Math.max(1, totalLegalBalls))*100)}%\n` +
      `Boundaries: ${Math.round((totalBoundaries/Math.max(1, totalLegalBalls))*100)}%`;

    return { 
      chartData: cdata, 
      topScorer: tsPlayer ? `${tsPlayer.name} ${topSm.runs} (${topSm.balls})` : '-',
      bestBowler: bbPlayer ? `${bbPlayer.name} ${bestBm.wickets}/${bestBm.runs}` : '-',
      stats: { dotPct: Math.round((totalDots/(totalLegalBalls||1))*100), bndPct: Math.round((totalBoundaries/(totalLegalBalls||1))*100), winner },
      summaryText: sText
    };
  }, [match, innings, balls, players]);

  if (!match || !innings) return <div className="p-4 flex justify-center mt-10">Loading summary...</div>;

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
        <Card className="p-4 bg-white shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">⭐ Top Scorer</p>
          <p className="font-semibold text-gray-900">{topScorer}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">🎯 Best Bowler</p>
          <p className="font-semibold text-gray-900">{bestBowler}</p>
        </Card>
      </div>

      <Card className="p-4 bg-white shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4">Runs per Over</h3>
        <div className="h-48">
          {chartData && (
            <Bar 
              data={chartData} 
              options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { position: 'bottom'} } }} 
            />
          )}
        </div>
      </Card>

      <Card className="p-4 bg-white shadow-sm grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded-xl">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Dot Balls</p>
          <p className="text-2xl font-black text-gray-800">{stats?.dotPct}%</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-xl">
           <p className="text-xs font-bold text-gray-500 uppercase mb-1">Boundaries</p>
           <p className="text-2xl font-black text-primary-600">{stats?.bndPct}%</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-8">
        <Button variant="secondary" onClick={() => navigate('/')} className="flex gap-2.5">
          <Home size={18} /> Home
        </Button>
        <Button variant="primary" onClick={handleShare} className="flex gap-2.5 shadow-md shadow-primary-500/20">
          <Share2 size={18} /> Share
        </Button>
      </div>
    </div>
  );
};

export default MatchSummary;
