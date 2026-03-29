import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import Card from '../components/Card';
import { Users, Trophy, CalendarDays } from 'lucide-react';
import { useToast } from '../components/Toast';

const Attendance: React.FC = () => {
  const [viewMode, setViewMode] = useState<'recent' | 'month' | 'ytd'>('recent');
  const { showToast } = useToast();

  const players = useLiveQuery(async () => {
    const all = await db.players.toArray();
    return all.filter(p => !/\d/.test(p.name) && p.is_morya_warrior);
  }) || [];
  const matches = useLiveQuery(() => db.matches.toArray()) || [];

  const getPastSundays = (count: number) => {
    const sundays = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Go to recent Sunday
    for (let i = 0; i < count; i++) {
       sundays.push(new Date(d));
       d.setDate(d.getDate() - 7);
    }
    return sundays.reverse();
  };

  const pastSundays = getPastSundays(10); // Last 10 Sundays

  const getAttendanceStatus = (playerId: string, dateObj: Date) => {
    const dateString = dateObj.toDateString();
    const matchAttended = matches.some(m => {
      if (new Date(m.date).toDateString() !== dateString) return false;
      return m.teamAPlayers.includes(playerId) || m.teamBPlayers?.includes(playerId);
    });
    if (matchAttended) return { attended: true, type: 'match' as const };
    
    const manual = manualAttendance.find(a => new Date(a.date).toDateString() === dateString && a.player_id === playerId);
    if (manual) return { attended: true, type: 'manual' as const, id: manual.id };
    
    return { attended: false };
  };

  const handleToggleAttendance = async (playerId: string, dateObj: Date) => {
    try {
      const status = getAttendanceStatus(playerId, dateObj);
      if (status.attended) {
        if (status.type === 'match') {
          showToast("Match attendance cannot be manually removed", "info");
          return;
        }
        if (status.id) {
          await db.attendance.delete(status.id);
          showToast("Attendance removed", "success");
        }
      } else {
        await db.attendance.add({
          id: crypto.randomUUID(),
          date: dateObj.getTime(),
          player_id: playerId
        });
        showToast("Attendance marked", "success");
      }
    } catch (error) {
      console.error("Toggle attendance error:", error);
      showToast("Failed to update attendance", "error");
    }
  };

  const manualAttendance = useLiveQuery(() => db.attendance.toArray()) || [];

  const getPlayerWiseStats = (mode: 'recent' | 'month' | 'ytd') => {
    const stats: Record<string, Set<string>> = {}; // using Set for unique dates
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // From Matches
    matches.forEach(m => {
      const mDate = new Date(m.date);
      const dateString = mDate.toDateString();
      
      let inRange = false;
      if (mode === 'ytd') {
         if (mDate.getFullYear() === currentYear) inRange = true;
      } else if (mode === 'month') {
         if (mDate.getFullYear() === currentYear && mDate.getMonth() === currentMonth) inRange = true;
      } else {
         inRange = true;
      }

      if (inRange) {
         [...m.teamAPlayers, ...(m.teamBPlayers || [])].forEach(pid => {
           if (!stats[pid]) stats[pid] = new Set();
           stats[pid].add(dateString);
         });
      }
    });

    // From Manual Attendance
    manualAttendance.forEach(a => {
      const aDate = new Date(a.date);
      const dateString = aDate.toDateString();

      let inRange = false;
      if (mode === 'ytd') {
         if (aDate.getFullYear() === currentYear) inRange = true;
      } else if (mode === 'month') {
         if (aDate.getFullYear() === currentYear && aDate.getMonth() === currentMonth) inRange = true;
      } else {
         inRange = true;
      }

      if (inRange) {
        if (!stats[a.player_id]) stats[a.player_id] = new Set();
        stats[a.player_id].add(dateString);
      }
    });

    const finalStats: Record<string, number> = {};
    for (const [pid, dates] of Object.entries(stats)) {
       finalStats[pid] = dates.size;
    }
    return finalStats;
  };

  const playerStats = getPlayerWiseStats(viewMode);
  
  // Sort players by total attendance descending
  const sortedPlayers = [...players].sort((a, b) => (playerStats[b.id] || 0) - (playerStats[a.id] || 0));

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <Card className="p-5 text-center bg-gradient-to-br from-primary-600 to-primary-700 text-white border-0 shadow-lg shadow-primary-500/30">
        <h2 className="text-xl font-bold mb-1 tracking-tight">Attendance</h2>
        <p className="text-sm opacity-90 font-medium">Auto-tracked (Unique match days)</p>
        
        <div className="flex bg-white/20 p-1 rounded-xl mt-4">
           <button 
             onClick={() => setViewMode('recent')} 
             className={`flex-1 text-xs sm:text-sm font-bold py-2 rounded-lg transition-colors ${viewMode === 'recent' ? 'bg-white text-primary-700 shadow-sm' : 'text-white/80 hover:bg-white/10'}`}
           >
             Sundays
           </button>
           <button 
             onClick={() => setViewMode('month')} 
             className={`flex-1 text-xs sm:text-sm font-bold py-2 rounded-lg transition-colors ${viewMode === 'month' ? 'bg-white text-primary-700 shadow-sm' : 'text-white/80 hover:bg-white/10'}`}
           >
             Curr Month
           </button>
           <button 
             onClick={() => setViewMode('ytd')} 
             className={`flex-1 text-xs sm:text-sm font-bold py-2 rounded-lg transition-colors ${viewMode === 'ytd' ? 'bg-white text-primary-700 shadow-sm' : 'text-white/80 hover:bg-white/10'}`}
           >
             YTD
           </button>
        </div>
      </Card>

      <Card className="p-4 bg-white dark:bg-gray-900 border-0 shadow-sm">
        <div className="flex justify-between items-end mb-4 px-2">
           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Users size={14}/> Player</span>
           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest text-right flex items-center gap-1"><Trophy size={14}/> {viewMode === 'recent' ? 'Recents / Total' : 'Total Days'}</span>
        </div>

        <div className="space-y-3">
          {sortedPlayers.length > 0 ? (
            sortedPlayers.map(player => {
              const total = playerStats[player.id] || 0;
              return (
                <div key={player.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex justify-between w-full sm:w-auto items-center mb-2 sm:mb-0">
                    <span className="font-bold text-gray-900 dark:text-gray-100">{player.name}</span>
                    <span className="sm:hidden text-xs font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded-full">Total: {total}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 sm:ml-auto">
                    {viewMode === 'recent' ? (
                      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                        {pastSundays.map((dateObj, idx) => {
                          const status = getAttendanceStatus(player.id, dateObj);
                          return (
                            <div 
                              key={idx} 
                              title={dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              onClick={() => handleToggleAttendance(player.id, dateObj)}
                              className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 relative group cursor-pointer active:scale-90 transition-all ${status.attended ? 'bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800' : 'bg-gray-100 dark:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-500'}`}
                            >
                               {status.attended ? (
                                 <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${status.type === 'match' ? 'bg-green-600' : 'bg-green-500 animate-pulse-slow'}`}></div>
                               ) : null}
                               <span className="absolute -top-6 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-10">
                                  {dateObj.toLocaleDateString([], { day: '2-digit', month: 'short' })} {status.type === 'match' ? '(Match)' : '(Manual)'}
                               </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">
                        <CalendarDays size={14} className="opacity-80"/> Days
                      </div>
                    )}
                    <span className="hidden sm:inline-flex items-center justify-center text-sm font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-1 rounded-xl min-w-[2.5rem] border border-primary-200 dark:border-primary-800">
                       {total}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400 font-medium">
              No players found. Add players in the settings.
            </div>
          )}
        </div>
      </Card>
      
      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex flex-col gap-3 text-blue-800 dark:text-blue-300">
        <div className="flex gap-3">
          <Users className="flex-shrink-0" />
          <p className="text-sm font-medium leading-relaxed">
            Attendance is automatically tracked based on players participating in matches. <strong>Tap any square above</strong> to manually mark someone present.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
