import { useState } from 'react';
import { Check, X, Plus, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useCashAdvances,
  useCreateCashAdvance,
  useReviewCashAdvance,
  useWorkers,
} from '@/lib/queries';
import type { CashAdvance } from '@/lib/api';

function formatPeso(val: string | number) {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusBadge(status: CashAdvance['status']) {
  const map = {
    pending:  'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    rejected: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
    deducted: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100',
  };
  return (
    <Badge className={`text-xs capitalize ${map[status]}`}>{status}</Badge>
  );
}

export default function CashAdvances() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Request dialog
  const [showRequest, setShowRequest] = useState(false);
  const [reqWorker, setReqWorker]     = useState('');
  const [reqAmount, setReqAmount]     = useState('');
  const [reqReason, setReqReason]     = useState('');

  // Review dialog
  const [reviewing, setReviewing] = useState<CashAdvance | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const { data: workersData } = useWorkers({ status: 'active', limit: 200 });
  const workers = workersData?.data ?? [];

  const statusParam = filterStatus === 'all' ? undefined : filterStatus;
  const { data, isLoading } = useCashAdvances({ status: statusParam, limit: 100 });
  const advances = data?.data ?? [];

  const createAdvance = useCreateCashAdvance();
  const reviewAdvance = useReviewCashAdvance();

  async function handleRequest() {
    if (!reqWorker || !reqAmount || !reqReason.trim()) {
      toast({ title: 'Missing fields', description: 'Select a worker, enter an amount and reason.', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(reqAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    try {
      await createAdvance.mutateAsync({ workerId: reqWorker, amount, reason: reqReason.trim() });
      setShowRequest(false);
      setReqWorker(''); setReqAmount(''); setReqReason('');
      toast({ title: 'Request submitted', description: 'Cash advance request has been created.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to submit request.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  async function handleReview(decision: 'approved' | 'rejected') {
    if (!reviewing) return;
    try {
      await reviewAdvance.mutateAsync({ id: reviewing.id, decision, note: reviewNote.trim() || undefined });
      setReviewing(null);
      setReviewNote('');
      toast({
        title: decision === 'approved' ? 'Advance approved' : 'Advance rejected',
        description: decision === 'approved'
          ? `${formatPeso(reviewing.amount)} approved for ${reviewing.worker.name}.`
          : `Request rejected for ${reviewing.worker.name}.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to review.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  const pendingCount = advances.filter((a) => a.status === 'pending').length;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cash Advances</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} pending review`
              : 'Salary advance requests'}
          </p>
        </div>
        <Button onClick={() => setShowRequest(true)} className="sm:flex-shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted w-fit mb-4">
        {(['all', 'pending', 'approved', 'rejected', 'deducted'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
              filterStatus === s ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardSkeleton count={4} />
      ) : advances.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold text-foreground mb-1">No advances found</h2>
          <p className="text-sm text-muted-foreground">
            {filterStatus === 'all' ? 'No cash advance requests yet.' : `No ${filterStatus} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {advances.map((adv) => (
            <div key={adv.id} className="bg-card border border-border rounded-lg p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{adv.worker.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{adv.worker.employeeNo}</span>
                    {statusBadge(adv.status)}
                  </div>
                  <p className="text-lg font-bold text-foreground mt-1">{formatPeso(adv.amount)}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{adv.reason}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                    <span>Requested {formatTs(adv.requestedAt)}</span>
                    {adv.reviewer && (
                      <span>Reviewed by <strong className="text-foreground">{adv.reviewer.name}</strong></span>
                    )}
                    {adv.reviewNote && (
                      <span className="w-full italic">"{adv.reviewNote}"</span>
                    )}
                  </div>
                </div>

                {adv.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => { setReviewing(adv); setReviewNote(''); }}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => { setReviewing(adv); setReviewNote(''); }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New request dialog */}
      <Dialog open={showRequest} onOpenChange={setShowRequest}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Cash Advance Request</DialogTitle>
            <DialogDescription>Submit a salary advance request on behalf of a worker.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Worker *</Label>
              <Select value={reqWorker} onValueChange={setReqWorker}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="— select worker —" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} <span className="text-muted-foreground ml-1">({w.employeeNo})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Amount (PHP) *</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                placeholder="e.g. 2500"
                value={reqAmount}
                onChange={(e) => setReqAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="e.g. Medical emergency, school fees…"
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequest(false)}>Cancel</Button>
            <Button onClick={handleRequest} disabled={createAdvance.isPending}>
              {createAdvance.isPending ? 'Submitting…' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(open) => { if (!open) setReviewing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Review Cash Advance</DialogTitle>
            <DialogDescription>
              {reviewing && (
                <>
                  <strong>{reviewing.worker.name}</strong> — {formatPeso(reviewing.amount)}
                  <br />
                  <span className="italic">"{reviewing.reason}"</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Note (optional)</Label>
            <Textarea
              placeholder="Add a note for the worker or record…"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => handleReview('rejected')}
              disabled={reviewAdvance.isPending}
            >
              <X className="w-4 h-4 mr-1.5" />
              Reject
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleReview('approved')}
              disabled={reviewAdvance.isPending}
            >
              <Check className="w-4 h-4 mr-1.5" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
