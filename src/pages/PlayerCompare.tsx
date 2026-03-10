import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import Card from '../components/Card';
import { Users, Trash2, Plus, ArrowRightLeft } from 'lucide-react';

const PlayerCompare: React.FC = () => {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  const players = useLiveQuery(() => db.players.toArray()) || [];
  const balls = useLiveQuery(() => db.balls.toArray()) || [];

  const compareStats = useMemo(() => {
    return selectedPlayerIds.map(pid => {
      const player = players.find(p => p.id === pid);
      if (!player) return null;

      const pb = balls.filter(b => b.batsman_id === pid);
      const bowlingBalls = balls.filter(b => b.bowler_id === pid);
      const fieldingBalls = balls.filter(b => b.fielder_id === pid);

      let runs = 0;
      let ballsFaced = 0;
      let dotsFaced = 0;
      pb.forEach(b => {
        runs += b.runs;
        if (b.extra_type !== 'wide') ballsFaced++;
        if (b.runs === 0 && !b.is_wicket && b.extra_type === 'none') dotsFaced++;
      });

      let wickets = 0;
      let runsGiven = 0;
      let legalBalls = 0;
      bowlingBalls.forEach(b => {
        runsGiven += (b.runs + b.extra_runs);
        if (b.is_wicket && b.wicket_type !== 'run_out') wickets++;
        if (b.extra_type !== 'wide' && b.extra_type !== 'no_ball') legalBalls++;
      });

      let catches = 0;
      let runouts = 0;
      fieldingBalls.forEach(b => {
        if (b.wicket_type === 'caught' || b.wicket_type === 'stumped') catches++;
        if (b.wicket_type === 'run_out') runouts++;
      });

      const gullyScore = runs + (20 * wickets) + (10 * catches) + (10 * runouts) - dotsFaced;

      return {
        id: pid,
        name: player.name,
        runs,
        ballsFaced,
        sr: ballsFaced > 0 ? Math.round((runs / ballsFaced) * 100) : 0,
        wickets,
        economy: legalBalls > 0 ? (runsGiven / (legalBalls / 6)).toFixed(1) : '0.0',
        catches,
        runouts,
        gullyScore
      };
    }).filter(s => s !== null);
  }, [selectedPlayerIds, players, balls]);

  const togglePlayer = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter(pid => pid !== id));
    } else if (selectedPlayerIds.length < 3) {
      setSelectedPlayerIds([...selectedPlayerIds, id]);
    } else {
      alert('You can compare up to 3 players at a time.');
    }
  };

  return (
    <div className="p-4 space-y-6 safe-area-bottom pb-20 max-w-lg mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <ArrowRightLeft className="text-primary-500" />
            Player Compare
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Select 2-3 players to compare stats.</p>
        </div>
      </div>

      <Card className="p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Select Players</h3>
        <div className="flex flex-wrap gap-2">
          {players.map(p => {
             const isSelected = selectedPlayerIds.includes(p.id);
             return (
               <button
                 key={p.id}
                 onClick={() => togglePlayer(p.id)}
                 className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                   isSelected 
                     ? 'bg-primary-500 border-primary-500 text-white' 
                     : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                 }`}
               >
                 {p.name}
               </button>
             );
          })}
        </div>
      </Card>

      {compareStats.length > 1 ? (
        <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-4 min-w-max">
            {compareStats.map(stat => (
              <Card key={stat!.id} className="w-64 p-5 flex-shrink-0 border-t-4 border-t-primary-500 shadow-lg">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-black text-xl text-gray-900 dark:text-gray-50 truncate">{stat!.name}</h3>
                  <button onClick={() => togglePlayer(stat!.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-1">Gully Score</p>
                    <p className="text-3xl font-black text-primary-600 dark:text-primary-400">{stat!.gullyScore}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Runs</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100">{stat!.runs}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Strike Rate</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100">{stat!.sr}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Wickets</p>
                      <p className="text-lg font-black text-rose-500">{stat!.wickets}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Economy</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100">{stat!.economy}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Catches</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100">{stat!.catches}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Runouts</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100">{stat!.runouts}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-10 text-center border-dashed border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
          <Users size={48} className="mx-auto text-gray-300 mb-4 opacity-50" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Select multiple players to see comparison</p>
          <div className="mt-4 inline-flex items-center gap-2 text-primary-600 text-xs font-bold uppercase tracking-wider">
            <Plus size={16} />
            Pick 2 or More
          </div>
        </Card>
      )}
    </div>
  );
};

export default PlayerCompare;
