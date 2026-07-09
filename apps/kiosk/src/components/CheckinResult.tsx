import type { CheckinResult } from '../types';

interface Props {
  result: CheckinResult;
}

const CONFIG: Record<CheckinResult['kind'], { bg: string; icon: string }> = {
  success:      { bg: 'bg-green-600',  icon: '✓' },
  flagged:      { bg: 'bg-yellow-500', icon: '⚠' },
  no_match:     { bg: 'bg-red-600',    icon: '✗' },
  rate_limited: { bg: 'bg-slate-600',  icon: '⏱' },
};

export function CheckinResult({ result }: Props) {
  const { bg, icon } = CONFIG[result.kind];

  return (
    <div className={`flex flex-col items-center justify-center w-full h-full ${bg} text-white`}>
      <div className="text-8xl font-bold mb-4">{icon}</div>
      {result.workerName && (
        <div className="text-3xl font-semibold mb-2">{result.workerName}</div>
      )}
      {result.eventType && (
        <div className="text-6xl font-black tracking-widest mb-4">
          {result.eventType.toUpperCase()}
        </div>
      )}
      <div className="text-lg opacity-90">{result.message}</div>
      {result.confidence !== undefined && (
        <div className="mt-3 text-sm opacity-70">
          Confidence: {(result.confidence * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}
