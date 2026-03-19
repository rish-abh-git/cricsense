import React, { useState } from 'react';
import { Coins, Trophy, Swords } from 'lucide-react';

interface TossModalProps {
  teamA: string;
  teamB: string;
  onTossComplete: (winner: string, decision: 'bat' | 'bowl') => void;
  onClose: () => void;
}

const TossModal: React.FC<TossModalProps> = ({ teamA, teamB, onTossComplete, onClose }) => {
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [tossWinner, setTossWinner] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'flipping' | 'result' | 'decision'>('pick');
  const [selectedCall, setSelectedCall] = useState<'heads' | 'tails' | null>(null);

  const handleFlip = () => {
    if (!selectedCall) return;
    setStep('flipping');
    
    // Animate for 2 seconds
    setTimeout(() => {
      const outcome = Math.random() > 0.5 ? 'heads' : 'tails';
      setResult(outcome);
      
      const winner = outcome === selectedCall ? teamB : teamA;
      setTossWinner(winner);
      setStep('result');
      
      setTimeout(() => setStep('decision'), 1500);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="bg-primary-600 p-6 text-white text-center relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            ✕
          </button>
          <Coins className="w-12 h-12 mx-auto mb-2 text-primary-200" />
          <h2 className="text-2xl font-bold">Match Toss</h2>
          <p className="text-primary-100 mt-1">{teamA} vs {teamB}</p>
        </div>

        <div className="p-8">
          {step === 'pick' && (
            <div className="space-y-6 text-center">
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{teamB} to call:</p>
                <div className="flex justify-center gap-4">
                  {(['heads', 'tails'] as const).map((call) => (
                    <button
                      key={call}
                      onClick={() => setSelectedCall(call)}
                      className={`px-8 py-4 rounded-2xl font-bold capitalize transition-all ${
                        selectedCall === call 
                          ? 'bg-primary-600 text-white scale-105 shadow-lg' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {call}
                    </button>
                  ))}
                </div>
              </div>
              <button
                disabled={!selectedCall}
                onClick={handleFlip}
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
              >
                Flip Coin
              </button>
            </div>
          )}

          {step === 'flipping' && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-24 h-24 rounded-full border-8 border-yellow-400 bg-yellow-500 flex items-center justify-center text-white text-4xl font-black shadow-xl animate-spin shadow-yellow-500/50">
                ?
              </div>
              <p className="mt-8 text-xl font-bold animate-pulse text-gray-700 dark:text-gray-200">
                Flipping...
              </p>
            </div>
          )}

          {step === 'result' && (
            <div className="text-center py-6 animate-in zoom-in duration-300">
              <div className="w-24 h-24 rounded-full border-8 border-yellow-400 bg-yellow-500 flex items-center justify-center text-white text-3xl font-black mx-auto mb-6 shadow-xl shadow-yellow-500/40">
                {result === 'heads' ? 'H' : 'T'}
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white capitalize mb-1">
                {result === 'heads' ? 'Heads' : 'Tails'}!
              </h3>
              <p className="text-primary-600 dark:text-primary-400 font-bold text-xl">
                {tossWinner} wins the toss!
              </p>
            </div>
          )}

          {step === 'decision' && tossWinner && (
            <div className="space-y-6 text-center animate-in slide-in-from-bottom duration-500">
              <Trophy className="w-16 h-16 mx-auto text-yellow-500 animate-bounce" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">{tossWinner}'s decision:</p>
                <div className="flex gap-4">
                  {(['bat', 'bowl'] as const).map((decision) => (
                    <button
                      key={decision}
                      onClick={() => onTossComplete(tossWinner, decision)}
                      className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-500/30 hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-2 capitalize"
                    >
                      {decision === 'bat' ? <Swords size={20} /> : <Coins size={20} />}
                      {decision}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TossModal;
