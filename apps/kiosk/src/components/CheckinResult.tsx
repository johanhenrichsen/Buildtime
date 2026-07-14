import type { CheckinResult } from '../types';

interface Props {
  result: CheckinResult;
}

const LABEL: Record<CheckinResult['kind'], string> = {
  success:      'RECORDED',
  flagged:      'FLAGGED FOR REVIEW',
  no_match:     'NOT RECOGNIZED',
  rate_limited: 'ALREADY SCANNED',
};

const BG: Record<CheckinResult['kind'], string> = {
  success:      'bg-green-600',
  flagged:      'bg-yellow-500',
  no_match:     'bg-red-600',
  rate_limited: 'bg-slate-600',
};

const ICON: Record<CheckinResult['kind'], string> = {
  success:      '✓',
  flagged:      '⚠',
  no_match:     '✗',
  rate_limited: '⏱',
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function CheckinResult({ result }: Props) {
  const bg   = BG[result.kind];
  const icon = ICON[result.kind];

  return (
    <div className={`flex flex-col items-center justify-center w-full h-full ${bg} text-white`}>
      <div className="text-7xl font-black mb-4">{icon}</div>

      {result.workerName && (
        <>
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-3">
            {initials(result.workerName)}
          </div>
          <div className="text-3xl font-bold mb-2 text-center px-6">{result.workerName}</div>
        </>
      )}

      {result.eventType && (
        <div className="mt-1 mb-3 px-8 py-2 rounded-full bg-white/20 text-4xl font-black tracking-widest">
          CLOCK {result.eventType === 'in' ? 'IN' : 'OUT'}
        </div>
      )}

      <div className="text-sm font-semibold tracking-widest opacity-80 mt-1">
        {LABEL[result.kind]}
      </div>

      <div className="text-sm opacity-70 mt-2 px-6 text-center">{result.message}</div>

      {result.confidence !== undefined && (
        <div className="mt-2 text-xs opacity-50">
          {(result.confidence * 100).toFixed(0)}% confidence
        </div>
      )}
    </div>
  );
}
