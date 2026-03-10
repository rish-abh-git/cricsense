import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { PlayerRepo, MatchRepo, InningsRepo } from '../database/repository';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import { PlusCircle, Search, X } from 'lucide-react';
import type { Player } from '../database/schema';

const MatchSetup: React.FC = () => {
  const navigate = useNavigate();
  const allPlayers = useLiveQuery(() => db.players.toArray()) || [];

  const [teamAName, setTeamAName] = useState('Morya Warriors');
  const [teamBName, setTeamBName] = useState('Team B');
  const [overs, setOvers] = useState<number>(4);

  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);
  const [activeTeamSelection, setActiveTeamSelection] = useState<'A' | 'B'>('A');

  const filteredPlayers = allPlayers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !teamAPlayers.some(tp => tp.id === p.id) &&
    !teamBPlayers.some(tp => tp.id === p.id)
  );

  const handleAddPlayer = async () => {
    if (!searchQuery.trim()) return;
    const existing = allPlayers.find(p => p.name.toLowerCase() === searchQuery.trim().toLowerCase());

    let playerToAdd = existing;
    if (!existing) {
      const pid = await PlayerRepo.add(searchQuery.trim());
      playerToAdd = { id: pid, name: searchQuery.trim() };
    }

    if (playerToAdd) {
      if (activeTeamSelection === 'A') setTeamAPlayers([...teamAPlayers, playerToAdd]);
      else setTeamBPlayers([...teamBPlayers, playerToAdd]);
    }
    setSearchQuery('');
  };

  const handleSelectExisting = (player: Player) => {
    if (activeTeamSelection === 'A') setTeamAPlayers([...teamAPlayers, player]);
    else setTeamBPlayers([...teamBPlayers, player]);
    setSearchQuery('');
  };

  const handleRemovePlayer = (team: 'A' | 'B', playerId: string) => {
    if (team === 'A') setTeamAPlayers(teamAPlayers.filter(p => p.id !== playerId));
    else setTeamBPlayers(teamBPlayers.filter(p => p.id !== playerId));
  };

  const handleStartMatch = async () => {
    if (!teamAName.trim() || !teamBName.trim()) {
      alert("Please enter names for both teams.");
      return;
    }

    // Create match
    const matchId = await MatchRepo.create(
      teamAName,
      teamBName,
      teamAPlayers.map(p => p.id),
      teamBPlayers.map(p => p.id),
      overs
    );

    // Create first innings (Team A batting first by default for simplicity, can be changed later)
    await InningsRepo.create(matchId, teamAName, teamBName, 1);

    navigate(`/scoring/${matchId}`);
  };

  return (
    <div className="p-4 safe-area-bottom pb-20">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">Match Setup</h2>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Team A Name"
            value={teamAName}
            onChange={e => setTeamAName(e.target.value)}
            placeholder="Team A Name"
          />
          <Input
            label="Team B Name"
            value={teamBName}
            onChange={e => setTeamBName(e.target.value)}
            placeholder="Team B Name"
          />
        </div>

        <Input
          label="Overs per Innings"
          type="number"
          value={overs}
          onChange={e => setOvers(Number(e.target.value))}
          min={1}
        />
      </div>

      <div className="flex gap-2 mb-4 bg-gray-200 dark:bg-gray-700 p-1 rounded-xl">
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTeamSelection === 'A' ? 'bg-white dark:bg-gray-800 shadow-sm text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setActiveTeamSelection('A')}
        >
          {teamAName} ({teamAPlayers.length})
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTeamSelection === 'B' ? 'bg-white dark:bg-gray-800 shadow-sm text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setActiveTeamSelection('B')}
        >
          {teamBName} ({teamBPlayers.length})
        </button>
      </div>

      <Card className="p-3 mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 block">Add Players to {activeTeamSelection === 'A' ? teamAName : teamBName}</label>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search or create player"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-primary-500"
              onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
            />
          </div>
          <Button onClick={handleAddPlayer} variant="primary" size="sm" className="whitespace-nowrap flex gap-1">
            <PlusCircle size={16} /> Add
          </Button>
        </div>

        {searchQuery.trim() && filteredPlayers.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
            {filteredPlayers.slice(0, 5).map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectExisting(p)}
                className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full text-sm hover:border-primary-500 hover:text-primary-600 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-[100px]">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Selected Players</h4>
          <div className="flex flex-wrap gap-2">
            {(activeTeamSelection === 'A' ? teamAPlayers : teamBPlayers).map(p => (
              <div key={p.id} className="flex items-center gap-1 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full text-sm font-medium border border-primary-100">
                {p.name}
                <button onClick={() => handleRemovePlayer(activeTeamSelection, p.id)} className="text-primary-400 hover:text-primary-600 ml-1">
                  <X size={14} />
                </button>
              </div>
            ))}
            {(activeTeamSelection === 'A' ? teamAPlayers : teamBPlayers).length === 0 && (
              <p className="text-sm text-gray-400 italic">No players added yet</p>
            )}
          </div>
        </div>
      </Card>

      <div className="fixed bottom-[80px] left-4 right-4 z-30">
        <Button onClick={handleStartMatch} fullWidth size="xl" className="shadow-lg shadow-primary-500/30">
          Start Match
        </Button>
      </div>
    </div>
  );
};

export default MatchSetup;
