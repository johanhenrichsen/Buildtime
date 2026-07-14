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

export function ChooseAction({ worker, onChoose, onCancel, rateLimitError }: Props) {
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

  const isIn  = worker.defaultEventType === 'in';
  const isOut = worker.defaultEventType === 'out';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900 text-white px-8">
      {/* Worker avatar + name */}
      <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-4xl font-black mb-4">
        {initials(worker.name)}
      </div>
      <p className="text-3xl font-bold text-center mb-1">{worker.name}</p>
      <p className="text-base text-slate-400 mb-8 tracking-wide">
        {worker.flagged ? 'Low confidence — verify identity' : 'Face recognized'}
      </p>

      {/* Clock In */}
      <button
        onClick={() => onChoose('in')}
        className={`w-full max-w-sm py-7 rounded-2xl text-2xl font-black tracking-wide mb-4 transition-transform active:scale-95 ${
          isIn
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
            : 'bg-slate-700 text-slate-200 border border-slate-600'
        }`}
      >
        {isIn && <span className="block text-xs font-semibold tracking-widest opacity-80 mb-0.5">SUGGESTED</span>}
        Clock In
      </button>

      {/* Clock Out */}
      <button
        onClick={() => onChoose('out')}
        className={`w-full max-w-sm py-7 rounded-2xl text-2xl font-black tracking-wide mb-8 transition-transform active:scale-95 ${
          isOut
            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40'
            : 'bg-slate-700 text-slate-200 border border-slate-600'
        }`}
      >
        {isOut && <span className="block text-xs font-semibold tracking-widest opacity-80 mb-0.5">SUGGESTED</span>}
        Clock Out
      </button>

      <button
        onClick={onCancel}
        className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
      >
        Cancel ({countdown}s)
      </button>
    </div>
  );
}
