import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { PlayerRepo, MatchRepo, InningsRepo } from '../database/repository';
import { supabase } from '../database/supabaseClient';
import { mapMatchPayload } from '../database/syncUtils';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import { PlusCircle, Search, X } from 'lucide-react';
import { useToast } from '../components/Toast';
import type { Player } from '../database/schema';
import TossModal from '../components/TossModal';

type SetupStep = 'teams' | 'toss' | 'batting_first';

const MatchSetup: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const allPlayers = useLiveQuery(() => db.players.toArray()) || [];

  const [teamAName, setTeamAName] = useState('Morya Warriors');
  const [teamBName, setTeamBName] = useState('Team B');
  const [overs, setOvers] = useState<number>(4);

  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);
  const [activeTeamSelection, setActiveTeamSelection] = useState<'A' | 'B'>('A');

  // Feature 2.5 — Batting first
  const [battingFirst, setBattingFirst] = useState<string>('');

  // Feature 2.3 — Mock target
  const [mockTarget, setMockTarget] = useState<string>('');

  // Setup flow step
  const [step, setStep] = useState<SetupStep>('teams');
  const [tossWinner, setTossWinner] = useState<string>('');
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat');

  const filteredPlayers = allPlayers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !teamAPlayers.some(tp => tp.id === p.id) &&
    !teamBPlayers.some(tp => tp.id === p.id)
  );

  const handleAddPlayer = async () => {
    if (!searchQuery.trim()) return;
    const searchLower = searchQuery.trim().toLowerCase();

    const alreadySelected = teamAPlayers.some(p => p.name.toLowerCase() === searchLower) || 
                            teamBPlayers.some(p => p.name.toLowerCase() === searchLower);
                            
    if (alreadySelected) {
      showToast("Player is already in a team.", "error");
      return;
    }

    const existing = allPlayers.find(p => p.name.toLowerCase() === searchLower);

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

  const handleProceedToNext = () => {
    if (!teamAName.trim() || !teamBName.trim()) {
      showToast("Please enter names for both teams.", "error");
      return;
    }
    setStep('toss');
  };

  const handleTossComplete = (winner: string, decision: 'bat' | 'bowl') => {
    setTossWinner(winner);
    setTossDecision(decision);
    
    // Determine batting first based on toss
    const btFirst = decision === 'bat' ? winner : (winner === teamAName ? teamBName : teamAName);
    setBattingFirst(btFirst);
    
    // Start match immediately after toss (removed attendance step)
    handleStartMatch(btFirst);
  };

  const handleSelectBattingFirst = (team: string) => {
    setBattingFirst(team);
    handleStartMatch(team);
  };

  const handleStartMatch = async (battingTeam?: string) => {
    const bt = battingTeam || battingFirst;

    // Create match
    const matchId = await MatchRepo.create(
      teamAName,
      teamBName,
      teamAPlayers.map(p => p.id),
      teamBPlayers.map(p => p.id),
      overs,
      bt,
      undefined, // attendance removed
      tossWinner,
      tossDecision
    );

    // Mock target (feature 2.3)
    const mockRuns = parseInt(mockTarget);

    if (mockRuns > 0) {
      // Create completed 1st innings with mock total
      const battingTeamName = bt || teamAName;
      const bowlingTeamName = battingTeamName === teamAName ? teamBName : teamAName;
      const inningsId = await InningsRepo.create(matchId, battingTeamName, bowlingTeamName, 1);
      
      // Set the innings as completed with the mock runs (Syncing via Repo)
      await InningsRepo.updateScore(inningsId, mockRuns, false, true); // This will sync to Supabase
      
      // Update match with first_innings_total
      await db.matches.update(matchId, { firstInningsTotal: mockRuns });
      const fullMatch = await db.matches.get(matchId);
      if (fullMatch) await supabase.from('matches').upsert(mapMatchPayload(fullMatch));

      // Create second innings
      await InningsRepo.create(matchId, bowlingTeamName, battingTeamName, 2);
    } else {
      // Normal flow: create first innings
      const battingTeamName = bt || teamAName;
      const bowlingTeamName = battingTeamName === teamAName ? teamBName : teamAName;
      await InningsRepo.create(matchId, battingTeamName, bowlingTeamName, 1);
    }

    navigate(`/scoring/${matchId}`);
  };

  // moryaWarriorPlayers is defined above (from DB is_morya_warrior flag)

  if (step === 'toss') {
    return (
      <TossModal 
        teamA={teamAName} 
        teamB={teamBName} 
        onTossComplete={handleTossComplete} 
        onClose={() => setStep('teams')} 
      />
    );
  }

  if (step === 'batting_first') {
    return (
      <div className="p-4 safe-area-bottom pb-20 fade-in animate-in slide-in-from-bottom-2 duration-300">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Who's Batting First?</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Select the team that will bat first.</p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleSelectBattingFirst(teamAName)}
            className="w-full p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-left active:border-primary-500 active:bg-primary-50 transition-all"
          >
            <div className="font-bold text-lg text-gray-900 dark:text-gray-50">{teamAName}</div>
            <div className="text-sm text-gray-500">{teamAPlayers.length} players</div>
          </button>
          <button
            onClick={() => handleSelectBattingFirst(teamBName)}
            className="w-full p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-left active:border-primary-500 active:bg-primary-50 transition-all"
          >
            <div className="font-bold text-lg text-gray-900 dark:text-gray-50">{teamBName}</div>
            <div className="text-sm text-gray-500">{teamBPlayers.length} players</div>
          </button>
        </div>

        <Button variant="ghost" fullWidth onClick={() => setStep('teams')}>← Back to Setup</Button>
      </div>
    );
  }

  // Attendance step removed


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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Overs per Innings"
            type="number"
            value={overs}
            onChange={e => setOvers(Number(e.target.value))}
            min={1}
          />
          {/* Feature 2.3 — Mock target */}
          <Input
            label="1st Innings Total (optional)"
            type="number"
            value={mockTarget}
            onChange={e => setMockTarget(e.target.value)}
            placeholder="e.g. 120"
          />
        </div>
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

        {filteredPlayers.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
            {filteredPlayers.map(p => (
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
        <Button onClick={handleProceedToNext} fullWidth size="xl" className="shadow-lg shadow-primary-500/30">
          Continue →
        </Button>
      </div>
    </div>
  );
};

export default MatchSetup;
