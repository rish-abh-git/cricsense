import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { AttendanceRepo } from '../database/repository';
import Card from '../components/Card';
import { Calendar, Users, CheckCircle2, Circle } from 'lucide-react';

const Attendance: React.FC = () => {
  const [selectedDate] = useState<number>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  const players = useLiveQuery(() => db.players.toArray()) || [];
  const attendance = useLiveQuery(() => db.attendance.where('date').equals(selectedDate).toArray()) || [];

  const handleToggle = async (playerId: string) => {
    await AttendanceRepo.toggle(selectedDate, playerId);
  };

  const isPresent = (playerId: string) => attendance.some(a => a.player_id === playerId);

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto safe-area-bottom pb-20 fade-in animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <Users className="text-primary-500" />
            Attendance
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track who is playing today.</p>
        </div>
        <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-primary-100 dark:border-primary-800">
          <Calendar size={14} />
          {formattedDate}
        </div>
      </div>

      <Card className="p-4">
        <div className="space-y-2">
          {players.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No players found. Add players in Home or Settings.</div>
          ) : (
            players.map(player => {
              const present = isPresent(player.id);
              return (
                <button
                  key={player.id}
                  onClick={() => handleToggle(player.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                    present 
                      ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400' 
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <span className="font-bold">{player.name}</span>
                  {present ? (
                    <CheckCircle2 size={24} className="text-primary-500" />
                  ) : (
                    <Circle size={24} className="text-gray-300 dark:text-gray-600" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </Card>

      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex gap-3 text-blue-800 dark:text-blue-300">
        <Users className="flex-shrink-0" />
        <p className="text-sm font-medium leading-relaxed">
          Marking attendance helps in quickly selecting teams when starting a new match.
        </p>
      </div>
    </div>
  );
};

export default Attendance;
