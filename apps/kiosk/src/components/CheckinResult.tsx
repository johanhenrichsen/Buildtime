import type { CheckinResult } from '../types';

interface Props {
  result: CheckinResult;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const CONFIG = {
  success:      { bg: 'bg-emerald-600', label: 'Recorded',         icon: '✓' },
  flagged:      { bg: 'bg-amber-500',   label: 'Flagged for review', icon: '!' },
  no_match:     { bg: 'bg-red-600',     label: 'Not recognized',    icon: '✗' },
  rate_limited: { bg: 'bg-neutral-600', label: 'Already scanned',   icon: '—' },
};

export function CheckinResult({ result }: Props) {
  const { bg, label, icon } = CONFIG[result.kind];

  return (
    <div className={`flex flex-col items-center justify-center w-full h-full ${bg} text-white px-8`}>
      {/* Status icon */}
      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold mb-6">
        {icon}
      </div>

      {/* Worker name */}
      {result.workerName && (
        <>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold mb-3">
            {initials(result.workerName)}
          </div>
          <div className="text-3xl font-bold text-center mb-2">{result.workerName}</div>
        </>
      )}

      {/* Clock in / out pill */}
      {result.eventType && (
        <div className="mt-1 mb-4 px-6 py-2 rounded-lg bg-white/20 text-2xl font-bold">
          {result.eventType === 'in' ? 'Clocked In' : 'Clocked Out'}
        </div>
      )}

      {/* Status label */}
      <div className="text-sm font-semibold uppercase opacity-80 tracking-wide mb-1">{label}</div>

      {/* Message */}
      <div className="text-sm opacity-70 text-center max-w-xs">{result.message}</div>
    </div>
  );
}
