import { useState } from 'react';
import { BarChart2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import { useCutoffs } from '@/lib/queries';
import { exportDtr } from '@/lib/api';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    open: { label: 'Open', className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
    computed: { label: 'Computed', className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
    locked: { label: 'Locked', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  };
  const s = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100' };
  return <Badge className={`text-xs ${s.className}`}>{s.label}</Badge>;
}

export default function Reports() {
  const { toast } = useToast();
  const { data, isLoading } = useCutoffs();
  const [selectedCutoff, setSelectedCutoff] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  const cutoffs = data?.data ?? [];

  async function handleExport() {
    if (!selectedCutoff) {
      toast({ title: 'Select a cutoff', description: 'Choose a payroll period to export.', variant: 'destructive' });
      return;
    }
    setExportLoading(true);
    try {
      const rows = await exportDtr(selectedCutoff) as Record<string, unknown>[];
      if (!rows.length) {
        toast({ title: 'No data', description: 'No DTR records to export for this period.', variant: 'destructive' });
        return;
      }
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dtr-export-${selectedCutoff}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export complete', description: 'DTR data has been downloaded.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to export data.', variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Export DTR data by payroll period</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Export DTR to CSV</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Label className="mb-1.5 block">Select Cutoff Period</Label>
            <Select value={selectedCutoff} onValueChange={setSelectedCutoff}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a period…" />
              </SelectTrigger>
              <SelectContent>
                {cutoffs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {formatDate(c.periodStart)} – {formatDate(c.periodEnd)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={exportLoading || !selectedCutoff} variant="outline">
            {exportLoading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting…</>
              : <><Download className="w-4 h-4 mr-2" />Export CSV</>}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">All Cutoff Periods</h2>
        </div>

        {isLoading ? (
          <div className="p-4">
            <CardSkeleton count={3} />
          </div>
        ) : cutoffs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No cutoff periods created yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {cutoffs.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {formatDate(c.periodStart)} – {formatDate(c.periodEnd)}
                  </td>
                  <td className="px-4 py-3 text-center">{statusBadge(c.status)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
