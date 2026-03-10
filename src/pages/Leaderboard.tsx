import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import Card from '../components/Card';
import { Medal, Trophy, Share2 } from 'lucide-react';

const Leaderboard: React.FC = () => {
  const [tab, setTab] = useState<'gully' | 'batsmen' | 'bowlers'>('gully');

  const players = useLiveQuery(async () => {
    const all = await db.players.toArray();
    return all.filter(p => p.is_morya_warrior);
  }) || [];
  const matches = useLiveQuery(() => db.matches.toArray()) || [];
  const archivedMatchIds = useMemo(() => new Set(matches.filter(m => m.is_archived).map(m => m.id)), [matches]);
  const innings = useLiveQuery(() => db.innings.toArray()) || [];
  const validInningsIds = useMemo(() => new Set(innings.filter(i => !archivedMatchIds.has(i.match_id)).map(i => i.id)), [innings, archivedMatchIds]);
  const balls = useLiveQuery(() => db.balls.toArray()) || [];
  const filteredBalls = useMemo(() => balls.filter(b => validInningsIds.has(b.innings_id)), [balls, validInningsIds]);

  const rankings = useMemo(() => {
    if (!players.length || !filteredBalls.length) return { topGully: [], topBatsmen: [], topBowlers: [] };

    const statsMap = new Map<string, {
      runs: number,
      wickets: number,
      ballsFaced: number,
      legalBallsBowled: number,
      runsGiven: number,
      catches: number,
      runouts: number,
      dotsFaced: number
    }>();

    players.forEach(p => {
      statsMap.set(p.id, { runs: 0, wickets: 0, ballsFaced: 0, legalBallsBowled: 0, runsGiven: 0, catches: 0, runouts: 0, dotsFaced: 0 });
    });

    filteredBalls.forEach(b => {
      // Batting stats
      const batStat = statsMap.get(b.batsman_id);
      if (batStat) {
        batStat.runs += b.runs;
        if (b.extra_type !== 'wide') batStat.ballsFaced += 1;
        if (b.runs === 0 && !b.is_wicket && b.extra_type === 'none') batStat.dotsFaced += 1;
      }

      // Bowling stats
      const bowlStat = statsMap.get(b.bowler_id);
      if (bowlStat) {
        bowlStat.runsGiven += (b.runs + b.extra_runs);
        if (b.is_wicket && b.wicket_type !== 'run_out') bowlStat.wickets += 1;
        if (b.extra_type !== 'wide' && b.extra_type !== 'no_ball') bowlStat.legalBallsBowled += 1;
      }

      // Fielding stats
      if (b.fielder_id) {
        const fieldStat = statsMap.get(b.fielder_id);
        if (fieldStat) {
          if (b.wicket_type === 'caught' || b.wicket_type === 'stumped') fieldStat.catches += 1;
          if (b.wicket_type === 'run_out') fieldStat.runouts += 1;
        }
      }
    });

    const topGully = players.map(p => {
      const s = statsMap.get(p.id)!;
      const score = s.runs + (20 * s.wickets) + (10 * s.catches) + (10 * s.runouts) - s.dotsFaced;
      return { id: p.id, name: p.name, score };
    }).sort((a, b) => b.score - a.score).slice(0, 10);

    const topBatsmen = players.map(p => {
      const s = statsMap.get(p.id)!;
      return {
        id: p.id,
        name: p.name,
        runs: s.runs,
        sr: s.ballsFaced > 0 ? Math.round((s.runs / s.ballsFaced) * 100) : 0
      };
    }).filter(p => p.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 10);

    const topBowlers = players.map(p => {
      const s = statsMap.get(p.id)!;
      const overs = s.legalBallsBowled / 6;
      return {
        id: p.id,
        name: p.name,
        wickets: s.wickets,
        eco: overs > 0 ? (s.runsGiven / overs).toFixed(1) : '0.0'
      };
    }).filter(p => p.wickets > 0 || parseFloat(p.eco) > 0).sort((a, b) => b.wickets - a.wickets).slice(0, 10);

    return { topGully, topBatsmen, topBowlers };
  }, [players, filteredBalls]);

  const handleShare = async () => {
    let text = `🏆 *CricSense Leaderboard* 🏆\n\n`;

    if (tab === 'batsmen') {
      text += `🏏 *Top Batsmen*\n`;
      rankings.topBatsmen.forEach((p, i) => {
        text += `${i + 1}. ${p.name} - ${p.runs} runs (SR: ${p.sr})\n`;
      });
    } else {
      text += `🎯 *Top Bowlers*\n`;
      rankings.topBowlers.forEach((p, i) => {
        text += `${i + 1}. ${p.name} - ${p.wickets}W (Eco: ${p.eco})\n`;
      });
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: 'CricSense Leaderboard', text });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto safe-area-bottom pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <Medal className="text-amber-500" />
            Leaderboard
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Top performers across all matches.</p>
        </div>
        <button
          onClick={handleShare}
          className="p-2 bg-primary-50 text-primary-600 rounded-full hover:bg-primary-100 active:bg-primary-200 transition-colors"
          title="Share Leaderboard"
        >
          <Share2 size={20} />
        </button>
      </div>

      <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-xl">
        <button
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'gully' ? 'bg-white dark:bg-gray-800 text-primary-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setTab('gully')}
        >
          Gully Score
        </button>
        <button
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'batsmen' ? 'bg-white dark:bg-gray-800 text-primary-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setTab('batsmen')}
        >
          Batsmen
        </button>
        <button
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'bowlers' ? 'bg-white dark:bg-gray-800 text-primary-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setTab('bowlers')}
        >
          Bowlers
        </button>
      </div>

      <div className="space-y-3">
        {tab === 'gully' ? (
          rankings.topGully.length > 0 ? (
            rankings.topGully.map((p, idx) => (
              <Card key={p.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold overflow-hidden ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                    {idx === 0 ? <Trophy size={16} /> : idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-50">{p.name}</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-0.5">Overall Rank</p>
                  </div>
                </div>
                <div className="text-xl font-black text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-lg">
                  {p.score}
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center p-8 text-gray-400">No scoring data available yet.</div>
          )
        ) : tab === 'batsmen' ? (
          rankings.topBatsmen.length > 0 ? (
            rankings.topBatsmen.map((p, idx) => (
              <Card key={p.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold overflow-hidden ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-50">{p.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide mt-0.5">SR: {p.sr}</p>
                  </div>
                </div>
                <div className="text-xl font-black text-primary-600">
                  {p.runs} <span className="text-xs font-bold text-gray-400">R</span>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center p-8 text-gray-400">No batting data available yet.</div>
          )
        ) : (
          rankings.topBowlers.length > 0 ? (
            rankings.topBowlers.map((p, idx) => (
              <Card key={p.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold overflow-hidden ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-50">{p.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide mt-0.5">ECO: {p.eco}</p>
                  </div>
                </div>
                <div className="text-xl font-black text-rose-500">
                  {p.wickets} <span className="text-xs font-bold text-gray-400">W</span>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center p-8 text-gray-400">No bowling data available yet.</div>
          )
        )}
      </div>

    </div>
  );
};

export default Leaderboard;
