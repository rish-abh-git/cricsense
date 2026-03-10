import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, PlayCircle, History, Users } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { generateDaySummary, generateBallWiseSummary, shareText } from '../utils/shareUtils';
import { Share2, MessageSquareQuote } from 'lucide-react';
import { useToast } from '../components/Toast';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const allMatches = useLiveQuery(async () => {
    const matches = await db.matches.reverse().sortBy('date');
    return matches.filter(m => !m.is_archived);
  }) || [];
  const playersCount = useLiveQuery(async () => {
    const all = await db.players.toArray();
    return all.filter(p => p.is_morya_warrior).length;
  });
  const allInnings = useLiveQuery(() => db.innings.toArray()) || [];
  const allBalls = useLiveQuery(() => db.balls.toArray()) || [];

  const groupedMatches = React.useMemo(() => {
    if (!allMatches) return {};
    return allMatches.reduce((acc, m) => {
      const d = new Date(m.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      if (!acc[d]) acc[d] = [];
      acc[d].push(m);
      return acc;
    }, {} as Record<string, typeof allMatches>);
  }, [allMatches]);

  const handleShareDay = async (dateStr: string, matches: any[]) => {
    const text = await generateDaySummary(dateStr, matches.map(m => m.id));
    await shareText(text, `CricSense Summary - ${dateStr}`);
  };

  const handleAIShareDay = async (dateStr: string, matches: any[]) => {
    const text = await generateBallWiseSummary(matches.map(m => m.id));
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Detailed day data (${dateStr}) copied for AI Analysis!`, 'success');
    });
  };

  const isViewOnly = window.location.search.includes('view=true');

  return (
    <div className="p-4 space-y-6">
      <section className="text-center py-6">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 mt-2 shadow-inner">
          <Trophy size={40} className="text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Welcome to CricSense</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Offline-first tennis cricket scorer</p>
      </section>

      {!isViewOnly && (
        <div className="grid grid-cols-1 gap-4">
          <Button
            onClick={() => navigate('/setup')}
            size="xl"
            className="w-full flex items-center justify-center gap-2"
          >
            <PlayCircle size={24} />
            Start New Match
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer active:bg-gray-50 dark:bg-gray-900" onClick={() => navigate('/analytics')}>
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Players</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{playersCount ?? 0} registered</p>
          </div>
        </Card>

        <Card className="p-4 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <History size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Matches</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{allMatches?.length ?? 0} played</p>
          </div>
        </Card>
      </div>

      {Object.entries(groupedMatches).map(([dateStr, matches]) => (
        <section key={dateStr} className="mb-6">
          <div className="flex items-center justify-between mb-3 mt-4 px-1">
            <h3 className="font-bold text-gray-900 dark:text-gray-50 text-sm">{dateStr}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleAIShareDay(dateStr, matches)}
                className="text-primary-600 flex items-center gap-1.5 text-xs font-semibold bg-primary-50 px-3 py-1.5 rounded-full active:bg-primary-100"
                title="Copy Detail for AI"
              >
                <MessageSquareQuote size={14} /> AI Detail
              </button>
              <button
                onClick={() => handleShareDay(dateStr, matches)}
                className="text-primary-600 flex items-center gap-1.5 text-xs font-semibold bg-primary-50 px-3 py-1.5 rounded-full active:bg-primary-100"
              >
                <Share2 size={14} /> Share Day
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {matches.map(match => (
              <Card key={match.id} className="p-4 active:bg-gray-50 dark:bg-gray-900 cursor-pointer" onClick={() => navigate(`/summary/${match.id}`)}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${match.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {match.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>{match.teamA}</span>
                  <span className="text-gray-400 font-medium text-sm">vs</span>
                  <span>{match.teamB}</span>
                </div>
                {match.winner && (
                  <p className="text-sm text-primary-600 font-medium mt-2">{match.winner} won</p>
                )}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default Home;
