import React, { useState } from 'react';
import { Coins, Trophy } from 'lucide-react';

interface TossModalProps {
  teamA?: string;
  teamB?: string;
  onTossComplete: (winner: string, decision: 'bat' | 'bowl') => void;
  onClose: () => void;
}

const TossModal: React.FC<TossModalProps> = ({ teamA, teamB, onTossComplete, onClose }) => {
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [step, setStep] = useState<'toss' | 'flipping' | 'result' | 'decision'>('toss');

  const isStandalone = !teamA || !teamB;

  const handleFlip = () => {
    setStep('flipping');
    
    // Animate for 1.5 seconds
    setTimeout(() => {
      const outcome = Math.random() > 0.5 ? 'heads' : 'tails';
      setResult(outcome);
      setStep('result');
      
      if (!isStandalone) {
        setTimeout(() => setStep('decision'), 1500);
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="bg-primary-600 p-6 text-white text-center relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
          <Coins className="w-12 h-12 mx-auto mb-2 text-primary-200" />
          <h2 className="text-2xl font-bold">Quick Toss</h2>
          {!isStandalone && <p className="text-primary-100 mt-1">{teamA} vs {teamB}</p>}
        </div>

        <div className="p-8">
          {step === 'toss' && (
            <div className="space-y-6 text-center">
              <div className="py-4">
                <div className="w-24 h-24 rounded-full border-8 border-primary-100 bg-primary-50 dark:bg-primary-900/10 flex items-center justify-center text-primary-600 dark:text-primary-400 text-4xl font-black mx-auto mb-4 shadow-inner">
                  <Coins size={40} />
                </div>
                <p className="text-gray-600 dark:text-gray-400">Ready for the toss?</p>
              </div>
              <button
                onClick={handleFlip}
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-500/30 active:scale-95 transition-all"
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
              {isStandalone && (
                <button
                  onClick={onClose}
                  className="mt-8 w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Close
                </button>
              )}
            </div>
          )}

          {step === 'decision' && !isStandalone && (
            <div className="space-y-6 text-center animate-in slide-in-from-bottom duration-500">
              <Trophy className="w-16 h-16 mx-auto text-yellow-500 animate-bounce" />
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4 font-bold uppercase tracking-wider text-xs">Who is batting first?</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => onTossComplete(teamA, 'bat')}
                    className="w-full py-4 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-2xl font-bold border-2 border-primary-200 dark:border-primary-800 hover:bg-primary-100 active:scale-95 transition-all text-lg"
                  >
                    {teamA}
                  </button>
                  <button
                    onClick={() => onTossComplete(teamB, 'bat')}
                    className="w-full py-4 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-2xl font-bold border-2 border-primary-200 dark:border-primary-800 hover:bg-primary-100 active:scale-95 transition-all text-lg"
                  >
                    {teamB}
                  </button>
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
