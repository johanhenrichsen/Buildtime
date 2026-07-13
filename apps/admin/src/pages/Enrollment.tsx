import { useState } from 'react';
import { Camera } from 'lucide-react';
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
import { useWorkers } from '@/lib/queries';

export default function Enrollment() {
  const { data, isLoading } = useWorkers({ status: 'active', limit: 200 });
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<{ msg: string; success: boolean } | null>(null);

  const workers = data?.data ?? [];

  function handleResult(msg: string, success: boolean) {
    setResult({ msg, success });
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Face Enrollment</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Enroll workers for face-recognition check-in</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 mb-5">
        <Label className="mb-2 block">Select Worker</Label>
        {isLoading ? (
          <TableSkeleton rows={1} cols={3} />
        ) : (
          <Select value={selected} onValueChange={(v) => { setSelected(v); setResult(null); }}>
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
        <div className={`mb-5 p-4 rounded-lg text-sm border ${
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
