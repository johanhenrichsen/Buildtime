import { useState } from 'react';
import { Camera, AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EnrollmentCamera } from '@/components/EnrollmentCamera';
import { useWorkers, useReEnrollSuggestions } from '@/lib/queries';

function relativeTime(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
  return d === 0 ? 'today' : `${d}d ago`;
}

export default function Enrollment() {
  const { data, isLoading } = useWorkers({ status: 'active', limit: 200 });
  const { data: suggestions = [] } = useReEnrollSuggestions();
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<{ msg: string; success: boolean } | null>(null);

  const workers = data?.data ?? [];

  function selectWorker(id: string) {
    setSelected(id);
    setResult(null);
  }

  function handleResult(msg: string, success: boolean) {
    setResult({ msg, success });
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Face Enrollment</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Enroll workers for face-recognition check-in</p>
      </div>

      {/* Re-enrollment suggestions */}
      {suggestions.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800">Needs Re-enrollment</span>
            <span className="text-xs text-amber-600 ml-auto">Based on last 30 days</span>
          </div>
          <div className="space-y-1">
            {suggestions.map(s => (
              <button
                key={s.workerId}
                onClick={() => selectWorker(s.workerId)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-sm transition-colors ${
                  selected === s.workerId
                    ? 'bg-amber-200 text-amber-900'
                    : 'hover:bg-amber-100 text-amber-800'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-amber-600 ml-1.5 text-xs">({s.employeeNo})</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-semibold text-amber-700">{s.lowConfidenceCount} low-confidence</span>
                  <span className="text-xs text-amber-500 ml-1">· {relativeTime(s.lastEventAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Worker selector */}
      <div className="bg-card border border-border rounded-lg p-5">
        <Label className="mb-2 block">Select Worker</Label>
        {isLoading ? (
          <TableSkeleton rows={1} cols={3} />
        ) : (
          <Select value={selected} onValueChange={selectWorker}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="— choose a worker —" />
            </SelectTrigger>
            <SelectContent>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name} ({w.employeeNo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {result && (
        <div className={`p-4 rounded-lg text-sm border ${
          result.success
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {result.msg}
        </div>
      )}

      {selected ? (
        <EnrollmentCamera workerId={selected} onResult={handleResult} />
      ) : (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Select a worker above to begin enrollment.</p>
        </div>
      )}
    </div>
  );
}
