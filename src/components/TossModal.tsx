import React, { useState } from 'react';
import { Coins, Trophy } from 'lucide-react';

interface TossModalProps {
  teamA?: string;
  teamB?: string;
  onTossComplete: (winner: string, decision: 'bat' | 'bowl') => void;
  onClose: () => void;
}

const CoinEdge = () => (
  <>
    {/* Generates thickness layers for the 3D coin edge */}
    {[...Array(6)].map((_, i) => (
      <div 
        key={i} 
        className="absolute inset-0 w-full h-full rounded-full border border-gray-400 bg-[linear-gradient(90deg,#9ca3af,#f3f4f6,#9ca3af)]"
        style={{ transform: `translateZ(${-3 + i}px)` }}
      />
    ))}
  </>
);

const CoinFace = ({ isHeads }: { isHeads: boolean }) => (
  <div 
    className={`absolute inset-0 w-full h-full rounded-full border-[4px] flex flex-col items-center justify-center backface-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.3)]
    bg-[linear-gradient(45deg,#d1d5db,#ffffff,#d1d5db)] border-[#9ca3af] text-gray-800`}
      style={{ transform: isHeads ? 'translateZ(4px)' : 'rotateX(180deg) translateZ(3px)' }}>
      
    {isHeads ? (
      <span className="text-3xl font-black font-sans tracking-tight text-gray-800">HEADS</span>
    ) : (
      <span className="text-3xl font-black font-sans tracking-tight text-gray-800">TAILS</span>
    )}
  </div>
);

const TossModal: React.FC<TossModalProps> = ({ teamA, teamB, onTossComplete, onClose }) => {
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [step, setStep] = useState<'toss' | 'flipping' | 'result' | 'decision'>('toss');

  const isStandalone = !teamA || !teamB;

  const handleFlip = () => {
    const outcome = Math.random() > 0.5 ? 'heads' : 'tails';
    setResult(outcome);
    setStep('flipping');
    
    // Animate for 2.8 seconds to allow full 3D flip animation
    setTimeout(() => {
      setStep('result');
      
      if (!isStandalone) {
        setTimeout(() => setStep('decision'), 1500);
      }
    }, 2800);
  };

  const handleReflip = () => {
    setResult(null);
    setStep('toss');
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

          {(step === 'flipping' || step === 'result') && (
            <div className="flex flex-col items-center justify-center py-6 overflow-visible">
              
              <div className="relative w-32 h-32 perspective-1000 mx-auto z-50">
                <div 
                  className={`w-full h-full preserve-3d transition-transform duration-300 ${
                    step === 'flipping' 
                      ? (result === 'heads' ? 'animate-flip-heads' : 'animate-flip-tails') 
                      : (result === 'tails' ? '[transform:rotateX(180deg)]' : '')
                  }`}
                >
                  <CoinEdge />
                  <CoinFace isHeads={true} />
                  <CoinFace isHeads={false} />
                </div>
              </div>

              {step === 'flipping' && (
                <p className="mt-12 text-xl font-bold animate-pulse text-gray-700 dark:text-gray-200">
                  Flipping...
                </p>
              )}

              {step === 'result' && (
                <div className="text-center mt-12 animate-in fade-in duration-300">
                  <h3 className="text-3xl font-black text-gray-900 dark:text-white capitalize mb-1">
                    {result === 'heads' ? 'Heads' : 'Tails'}!
                  </h3>
                  {isStandalone && (
                    <div className="mt-8 flex gap-3 w-full">
                      <button
                        onClick={handleReflip}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all shadow-sm"
                      >
                        Re-flip
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-sm"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
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
                <button
                  onClick={handleReflip}
                  className="mt-8 w-full py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm"
                >
                  It was a tie? Re-flip Coin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TossModal;
