import { useEffect, useState } from 'react';
import type { EventType, MatchedWorker } from '../types';

const TIMEOUT_SEC = 30;

interface Props {
  worker: MatchedWorker;
  onChoose: (eventType: EventType) => void;
  onCancel: () => void;
  rateLimitError: string | null;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function ChooseAction({ worker, onChoose, onCancel, rateLimitError: _ }: Props) {
  const [countdown, setCountdown] = useState(TIMEOUT_SEC);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) { clearInterval(tick); onCancel(); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [onCancel]);

  const suggestIn  = worker.defaultEventType === 'in';
  const suggestOut = worker.defaultEventType === 'out';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-neutral-900 text-white px-8">
      {/* Worker */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-neutral-700 border-2 border-neutral-600 flex items-center justify-center text-3xl font-bold mb-3">
          {initials(worker.name)}
        </div>
        <div className="text-2xl font-bold text-center">{worker.name}</div>
        {worker.flagged && (
          <div className="mt-2 text-xs text-amber-400 bg-amber-400/10 px-3 py-1 rounded">
            Low confidence — please verify your identity
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => onChoose('in')}
          className={`w-full py-6 rounded-xl text-xl font-bold transition-opacity active:opacity-80 ${
            suggestIn
              ? 'bg-emerald-600 text-white'
              : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
          }`}
        >
          {suggestIn && <span className="block text-xs font-normal text-emerald-200 mb-1">Suggested</span>}
          Clock In
        </button>

        <button
          onClick={() => onChoose('out')}
          className={`w-full py-6 rounded-xl text-xl font-bold transition-opacity active:opacity-80 ${
            suggestOut
              ? 'bg-orange-600 text-white'
              : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
          }`}
        >
          {suggestOut && <span className="block text-xs font-normal text-orange-200 mb-1">Suggested</span>}
          Clock Out
        </button>
      </div>

      <button
        onClick={onCancel}
        className="mt-6 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        Not you? Cancel ({countdown}s)
      </button>
    </div>
  );
}
