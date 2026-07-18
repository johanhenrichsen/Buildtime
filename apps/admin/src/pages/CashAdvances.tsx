import { useCallback, useState } from 'react';
import { Check, X, Plus, Wallet, AlertCircle, CheckCircle2, ScanFace, Hash } from 'lucide-react';
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
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import { FaceVerifyCamera } from '@/components/FaceVerifyCamera';
import {
  useCashAdvances,
  useCreateCashAdvance,
  useMatchFace,
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

const STATUS_META: Record<CashAdvance['status'], { label: string; className: string }> = {
  pending:  { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
  approved: { label: 'Approved',         className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  rejected: { label: 'Rejected',         className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100' },
  deducted: { label: 'Deducted from Pay', className: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100' },
};

function statusBadge(status: CashAdvance['status']) {
  const s = STATUS_META[status];
  return <Badge className={`text-xs ${s.className}`}>{s.label}</Badge>;
}

type IdentifyMode = 'face' | 'employee_no';
type VerifiedWorker = { id: string; name: string; employeeNo: string };

export default function CashAdvances() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // New request dialog
  const [showRequest, setShowRequest]         = useState(false);
  const [identifyMode, setIdentifyMode]       = useState<IdentifyMode>('face');
  const [verifiedWorker, setVerifiedWorker]   = useState<VerifiedWorker | null>(null);
  const [scanning, setScanning]               = useState(false);
  const [scanError, setScanError]             = useState<string | null>(null);
  const [empNoInput, setEmpNoInput]           = useState('');
  const [empNoError, setEmpNoError]           = useState<string | null>(null);
  const [reqAmount, setReqAmount]             = useState('');
  const [reqReason, setReqReason]             = useState('');

  // Approve dialog
  const [approving, setApproving]     = useState<CashAdvance | null>(null);
  const [approveNote, setApproveNote] = useState('');

  // Reject dialog
  const [rejecting, setRejecting]     = useState<CashAdvance | null>(null);
  const [rejectNote, setRejectNote]   = useState('');

  const { data: workersData } = useWorkers({ status: 'active', limit: 200 });
  const workers = workersData?.data ?? [];

  const statusParam = filterStatus === 'all' ? undefined : filterStatus;
  const { data, isLoading } = useCashAdvances({ status: statusParam, limit: 100 });
  const { data: pendingData } = useCashAdvances({ status: 'pending', limit: 1 });
  const advances = data?.data ?? [];
  const pendingTotal = pendingData?.meta?.total ?? 0;

  const createAdvance = useCreateCashAdvance();
  const reviewAdvance = useReviewCashAdvance();
  const matchFace     = useMatchFace();

  function openRequest() {
    setIdentifyMode('face');
    setVerifiedWorker(null);
    setScanning(false);
    setScanError(null);
    setEmpNoInput('');
    setEmpNoError(null);
    setReqAmount('');
    setReqReason('');
    setShowRequest(true);
  }

  function closeRequest() {
    setShowRequest(false);
  }

  const handleFaceCapture = useCallback(async (descriptor: number[]) => {
    setScanning(true);
    setScanError(null);
    try {
      const result = await matchFace.mutateAsync(descriptor);
      if (result.matched && result.worker) {
        setVerifiedWorker({ id: result.worker.id, name: result.worker.name, employeeNo: result.worker.employeeNo });
      } else {
        setScanError('Face not recognized. Try again or use employee no.');
      }
    } catch {
      setScanError('Verification failed. Try again or use employee no.');
    } finally {
      setScanning(false);
    }
  }, [matchFace]);

  function handleEmpNoLookup() {
    const trimmed = empNoInput.trim().toUpperCase();
    const found = workers.find(w => w.employeeNo.toUpperCase() === trimmed);
    if (found) {
      setVerifiedWorker({ id: found.id, name: found.name, employeeNo: found.employeeNo });
      setEmpNoError(null);
    } else {
      setEmpNoError(`No active worker found with employee no. "${trimmed}"`);
    }
  }

  async function handleRequest() {
    if (!verifiedWorker || !reqAmount || !reqReason.trim()) {
      toast({ title: 'Missing fields', description: 'Verify the worker and enter amount and reason.', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(reqAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Amount must be greater than zero.', variant: 'destructive' });
      return;
    }
    try {
      await createAdvance.mutateAsync({ workerId: verifiedWorker.id, amount, reason: reqReason.trim() });
      closeRequest();
      toast({ title: 'Request submitted', description: 'Cash advance request has been created.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to submit request.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  async function handleApprove() {
    if (!approving) return;
    try {
      await reviewAdvance.mutateAsync({ id: approving.id, decision: 'approved', note: approveNote.trim() || undefined });
      toast({ title: 'Advance approved', description: `${formatPeso(approving.amount)} approved for ${approving.worker.name}.` });
      setApproving(null);
      setApproveNote('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to approve.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    try {
      await reviewAdvance.mutateAsync({ id: rejecting.id, decision: 'rejected', note: rejectNote.trim() || undefined });
      toast({ title: 'Advance rejected', description: `Request rejected for ${rejecting.worker.name}.` });
      setRejecting(null);
      setRejectNote('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to reject.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cash Advances</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Salary advance requests for workers</p>
        </div>
        <Button onClick={openRequest} className="sm:flex-shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Pending alert — shown when viewing other tabs */}
      {pendingTotal > 0 && filterStatus !== 'pending' && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span>
            {pendingTotal} request{pendingTotal !== 1 ? 's' : ''} waiting for approval.{' '}
            <button onClick={() => setFilterStatus('pending')} className="underline font-medium">View pending</button>
          </span>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted w-fit mb-4 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected', 'deducted'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize flex items-center gap-1.5 ${
              filterStatus === s ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'pending' && pendingTotal > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingTotal > 9 ? '9+' : pendingTotal}
              </span>
            )}
            {s === 'all' ? 'All' : s === 'deducted' ? 'Deducted' : s.charAt(0).toUpperCase() + s.slice(1)}
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
            {filterStatus === 'all'
              ? 'No cash advance requests yet.'
              : filterStatus === 'deducted'
              ? 'No advances have been deducted from payroll yet.'
              : `No ${filterStatus} requests.`}
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
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => { setRejecting(adv); setRejectNote(''); }}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => { setApproving(adv); setApproveNote(''); }}
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
      <Dialog open={showRequest} onOpenChange={(open) => { if (!open) closeRequest(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Cash Advance Request</DialogTitle>
            <DialogDescription>
              {verifiedWorker
                ? 'Enter the advance amount and reason.'
                : 'Verify the worker\'s identity to continue.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Identity step ── */}
            {!verifiedWorker ? (
              <div className="space-y-3">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted w-fit">
                  <button
                    onClick={() => { setIdentifyMode('face'); setScanError(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      identifyMode === 'face' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ScanFace className="w-3.5 h-3.5" />
                    Face ID
                  </button>
                  <button
                    onClick={() => { setIdentifyMode('employee_no'); setScanError(null); setEmpNoError(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      identifyMode === 'employee_no' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    Employee No.
                  </button>
                </div>

                {identifyMode === 'face' ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <FaceVerifyCamera
                        active={showRequest && identifyMode === 'face' && !verifiedWorker && !scanning}
                        onCapture={handleFaceCapture}
                      />
                      {scanning && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                          <p className="text-sm font-medium">Verifying…</p>
                        </div>
                      )}
                    </div>
                    {scanError && (
                      <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p>{scanError}</p>
                          <button
                            className="text-xs underline mt-0.5"
                            onClick={() => { setScanError(null); }}
                          >
                            Try again
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="empNo">Employee No. *</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="empNo"
                        placeholder="e.g. EMP-001"
                        value={empNoInput}
                        onChange={(e) => { setEmpNoInput(e.target.value); setEmpNoError(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEmpNoLookup(); }}
                        className="flex-1"
                      />
                      <Button variant="outline" onClick={handleEmpNoLookup} disabled={!empNoInput.trim()}>
                        Find
                      </Button>
                    </div>
                    {empNoError && (
                      <p className="text-xs text-red-600">{empNoError}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ── Verified banner ── */
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800 truncate">{verifiedWorker.name}</p>
                  <p className="text-xs text-emerald-600">{verifiedWorker.employeeNo}</p>
                </div>
                <button
                  className="text-xs text-emerald-700 underline flex-shrink-0"
                  onClick={() => { setVerifiedWorker(null); setScanError(null); setEmpNoError(null); setEmpNoInput(''); }}
                >
                  Change
                </button>
              </div>
            )}

            {/* ── Details (shown once worker is verified) ── */}
            {verifiedWorker && (
              <>
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
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRequest}>Cancel</Button>
            {verifiedWorker && (
              <Button onClick={handleRequest} disabled={createAdvance.isPending}>
                {createAdvance.isPending ? 'Submitting…' : 'Submit Request'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approving} onOpenChange={(open) => { if (!open) setApproving(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve Cash Advance</DialogTitle>
            <DialogDescription>
              {approving && (
                <><strong>{approving.worker.name}</strong> — {formatPeso(approving.amount)}<br /><span className="italic">"{approving.reason}"</span></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Note (optional)</Label>
            <Textarea placeholder="e.g. Verified with HR — approved for medical" value={approveNote} onChange={(e) => setApproveNote(e.target.value)} rows={2} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={reviewAdvance.isPending}>
              <Check className="w-4 h-4 mr-1.5" />
              {reviewAdvance.isPending ? 'Approving…' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Cash Advance</DialogTitle>
            <DialogDescription>
              {rejecting && (
                <><strong>{rejecting.worker.name}</strong> — {formatPeso(rejecting.amount)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Reason for rejection *</Label>
            <Textarea placeholder="e.g. Insufficient balance in advance fund this period" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reviewAdvance.isPending || !rejectNote.trim()}>
              <X className="w-4 h-4 mr-1.5" />
              {reviewAdvance.isPending ? 'Rejecting…' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
