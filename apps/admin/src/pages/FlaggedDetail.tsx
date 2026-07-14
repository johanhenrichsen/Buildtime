import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useFlagged, useReviewFlagged } from '@/lib/queries';
import { useToast } from '@/hooks/use-toast';

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function matchMethodLabel(method: string) {
  const map: Record<string, string> = {
    face:               'Face scan (high confidence)',
    face_low_confidence:'Face scan (low confidence)',
    manual_exception:   'Employee ID entry',
  };
  return map[method] ?? method;
}

export default function FlaggedDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data } = useFlagged();
  const reviewFlagged = useReviewFlagged();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog]   = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const event = data?.data.find((e) => e.id === id);

  if (!event) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Event not found or already reviewed.</p>
        <Button variant="link" onClick={() => setLocation('/flagged')}>← Back to Flagged Events</Button>
      </div>
    );
  }

  async function handleApprove() {
    try {
      await reviewFlagged.mutateAsync({
        id: event!.id,
        decision: 'approve',
        reason: approveNote.trim() || 'Verified by reviewer',
      });
      toast({ title: 'Event approved', description: 'Attendance record has been approved.' });
      setShowApproveDialog(false);
      setLocation('/flagged');
    } catch {
      toast({ title: 'Error', description: 'Failed to approve event.', variant: 'destructive' });
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast({ title: 'Please enter a reason', variant: 'destructive' });
      return;
    }
    try {
      await reviewFlagged.mutateAsync({ id: event!.id, decision: 'reject', reason: rejectReason });
      toast({ title: 'Event rejected', description: 'Attendance record has been rejected.' });
      setShowRejectDialog(false);
      setLocation('/flagged');
    } catch {
      toast({ title: 'Error', description: 'Failed to reject event.', variant: 'destructive' });
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <button
        onClick={() => setLocation('/flagged')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Flagged Events
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">{event.worker.name}</h1>
            <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Pending Review</Badge>
            <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
              {event.eventType === 'in' ? 'Clock In' : 'Clock Out'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{event.worker.employeeNo}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verify that this worker was actually present at the recorded time before approving.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:flex-shrink-0">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => { setRejectReason(''); setShowRejectDialog(true); }}
            disabled={reviewFlagged.isPending}
          >
            <X className="w-4 h-4 mr-1.5" />
            Reject
          </Button>
          <Button
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
            onClick={() => { setApproveNote(''); setShowApproveDialog(true); }}
            disabled={reviewFlagged.isPending}
          >
            <Check className="w-4 h-4 mr-1.5" />
            Approve
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold">Event Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Timestamp</p>
            <p className="font-medium">{formatTs(event.serverTs)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Action</p>
            <p className="font-medium">{event.eventType === 'in' ? 'Clock In' : 'Clock Out'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Face Match Score</p>
            <p className="font-medium text-amber-600">{(event.confidenceScore * 100).toFixed(1)}% — below threshold</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">How They Checked In</p>
            <p className="font-medium">{matchMethodLabel(event.matchMethod)}</p>
          </div>
        </div>
      </div>

      {/* Approve dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve This Event</DialogTitle>
            <DialogDescription>
              Confirm that <strong>{event.worker.name}</strong> was present at {formatTs(event.serverTs)}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Note (optional)</Label>
            <Textarea
              placeholder="e.g. Confirmed present — badge photo matched"
              className="mt-1"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={reviewFlagged.isPending}>
              {reviewFlagged.isPending ? 'Approving…' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject This Event</DialogTitle>
            <DialogDescription>Please explain why this record is being rejected.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Reason *</Label>
            <Textarea
              placeholder="e.g. Worker was absent — someone else attempted to scan"
              className="mt-1"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reviewFlagged.isPending || !rejectReason.trim()}>
              {reviewFlagged.isPending ? 'Rejecting…' : 'Reject Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
