import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import { useCutoffs, useDtr, useComputeDtr, useUpdateDtr } from '@/lib/queries';
import { exportDtr } from '@/lib/api';

function formatHrs(val: string | number) {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? '0h' : `${n}h`;
}

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

export default function PayrollDetail() {
  const { cutoffId } = useParams<{ cutoffId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: cutoffsData } = useCutoffs();
  const { data: dtrData, isLoading } = useDtr(cutoffId ?? '');
  const computeDtr = useComputeDtr();
  const updateDtr = useUpdateDtr();

  const [editRow, setEditRow] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [exportLoading, setExportLoading] = useState(false);

  const cutoff = cutoffsData?.data.find((c) => c.id === cutoffId);
  const records = dtrData?.data ?? [];

  async function handleCompute() {
    if (!cutoffId) return;
    try {
      await computeDtr.mutateAsync(cutoffId);
      toast({ title: 'DTR computed', description: 'Daily time records have been computed.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to compute DTR.', variant: 'destructive' });
    }
  }

  async function handleExport() {
    if (!cutoffId) return;
    setExportLoading(true);
    try {
      const rows = await exportDtr(cutoffId) as Record<string, unknown>[];
      if (!rows.length) {
        toast({ title: 'No data', description: 'No DTR records to export.', variant: 'destructive' });
        return;
      }
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dtr-${cutoffId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'Failed to export DTR.', variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!editRow) return;
    try {
      await updateDtr.mutateAsync({
        id: editRow,
        data: {
          regularHrs: editForm.regularHrs ? parseFloat(editForm.regularHrs) : undefined,
          otHrs: editForm.otHrs ? parseFloat(editForm.otHrs) : undefined,
          nightDiffHrs: editForm.nightDiffHrs ? parseFloat(editForm.nightDiffHrs) : undefined,
          lateMin: editForm.lateMin ? parseInt(editForm.lateMin) : undefined,
          undertimeMin: editForm.undertimeMin ? parseInt(editForm.undertimeMin) : undefined,
          reason: editForm.reason ?? '',
        },
      });
      setEditRow(null);
      setEditForm({});
      toast({ title: 'DTR updated', description: 'Record has been saved.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-4 w-32 bg-muted rounded animate-pulse mb-5" />
        <TableSkeleton rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <button
        onClick={() => setLocation('/payroll')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Payroll
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">
              {cutoff ? `${formatDate(cutoff.periodStart)} – ${formatDate(cutoff.periodEnd)}` : 'DTR Records'}
            </h1>
            {cutoff && statusBadge(cutoff.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{records.length} records</p>
        </div>
        <div className="flex items-center gap-2 sm:flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportLoading || records.length === 0}
            className="flex-1 sm:flex-none"
          >
            {exportLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={handleCompute}
            disabled={computeDtr.isPending}
            className="flex-1 sm:flex-none"
            title="Calculates regular hours, overtime, late deductions and night differential from attendance check-ins for this period"
          >
            {computeDtr.isPending ? 'Computing…' : 'Compute DTR'}
          </Button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No DTR records yet. Click "Compute DTR" to generate records.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Worker</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Regular</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">OT Hours</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Night Diff (hrs)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Late (min)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Undertime</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.worker.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 text-center">{formatHrs(r.regularHrs)}</td>
                  <td className="px-4 py-3 text-center">{formatHrs(r.otHrs)}</td>
                  <td className="px-4 py-3 text-center">{formatHrs(r.nightDiffHrs)}</td>
                  <td className="px-4 py-3 text-center">{r.lateMin}</td>
                  <td className="px-4 py-3 text-center">{r.undertimeMin}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${r.status === 'computed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                      {r.status === 'computed' ? 'Final' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        setEditRow(r.id);
                        setEditForm({
                          regularHrs: r.regularHrs,
                          otHrs: r.otHrs,
                          nightDiffHrs: r.nightDiffHrs,
                          lateMin: String(r.lateMin),
                          undertimeMin: String(r.undertimeMin),
                          reason: '',
                        });
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) setEditRow(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editRow ? (() => {
                const rec = records.find((r) => r.id === editRow);
                return rec ? `Edit DTR — ${rec.worker.name} · ${formatDate(rec.date)}` : 'Edit DTR Record';
              })() : 'Edit DTR Record'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Regular Hrs</Label>
                <Input type="number" value={editForm.regularHrs ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, regularHrs: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>OT Hrs</Label>
                <Input type="number" value={editForm.otHrs ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, otHrs: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Night Diff Hrs</Label>
                <Input type="number" value={editForm.nightDiffHrs ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, nightDiffHrs: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Late (min)</Label>
                <Input type="number" value={editForm.lateMin ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, lateMin: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Undertime (min)</Label>
                <Input type="number" value={editForm.undertimeMin ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, undertimeMin: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Reason for edit *</Label>
              <Input placeholder="e.g. Corrected timesheet" value={editForm.reason ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, reason: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateDtr.isPending || !editForm.reason?.trim()}>
              {updateDtr.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
