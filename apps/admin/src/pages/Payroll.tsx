import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Plus } from 'lucide-react';
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
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import { useCutoffs, useCreateCutoff } from '@/lib/queries';

const STATUS_META: Record<string, { label: string; description: string; className: string }> = {
  open:     { label: 'Open',     description: 'Attendance not yet computed',          className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
  computed: { label: 'Computed', description: 'DTR calculated — ready to review',     className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
  locked:   { label: 'Finalized', description: 'Payroll approved and locked',         className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
};

function statusBadge(status: string) {
  const s = STATUS_META[status] ?? { label: status, description: '', className: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100' };
  return <Badge className={`text-xs ${s.className}`} title={s.description}>{s.label}</Badge>;
}

function statusHint(status: string) {
  const hints: Record<string, string> = {
    open:     'Next step: open the period and click "Compute DTR" to generate time records from attendance scans.',
    computed: 'Next step: review the time records, make any corrections, then run payroll.',
    locked:   'This period is finalized. Export CSV for your payroll system.',
  };
  return hints[status] ?? null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Payroll() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data, isLoading } = useCutoffs();
  const createCutoff = useCreateCutoff();

  const [showDialog, setShowDialog] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const cutoffs = data?.data ?? [];

  async function handleCreate() {
    if (!periodStart || !periodEnd) {
      toast({ title: 'Missing fields', description: 'Please enter both period dates.', variant: 'destructive' });
      return;
    }
    try {
      await createCutoff.mutateAsync({ periodStart, periodEnd });
      setShowDialog(false);
      setPeriodStart('');
      setPeriodEnd('');
      toast({ title: 'Cutoff created', description: 'New payroll period has been created.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to create cutoff.', variant: 'destructive' });
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Payroll / DTR</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Each cutoff period covers one pay period. Workflow: Open → Compute DTR → Review → Finalize.</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Cutoff
        </Button>
      </div>

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : cutoffs.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No cutoff periods yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cutoffs.map((c) => (
            <div
              key={c.id}
              className="bg-card border border-border rounded-lg p-5 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold">
                    {formatDate(c.periodStart)} – {formatDate(c.periodEnd)}
                  </h2>
                  {statusBadge(c.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {formatDate(c.createdAt)}
                  {statusHint(c.status) && (
                    <span className="block mt-0.5 text-muted-foreground/70">{statusHint(c.status)}</span>
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-4 flex-shrink-0"
                onClick={() => setLocation(`/payroll/${c.id}`)}
              >
                View DTR
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Cutoff Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="start">Period Start *</Label>
              <Input id="start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="end">Period End *</Label>
              <Input id="end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createCutoff.isPending}>
              {createCutoff.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
