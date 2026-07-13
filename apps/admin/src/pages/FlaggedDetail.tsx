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

export default function FlaggedDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data } = useFlagged();
  const reviewFlagged = useReviewFlagged();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reason, setReason] = useState('');

  const event = data?.data.find((e) => e.id === id);

  if (!event) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Event not found or already reviewed.</p>
        <Button variant="link" onClick={() => setLocation('/flagged')}>Back to Flagged Events</Button>
      </div>
    );
  }

  async function handleApprove() {
    try {
      await reviewFlagged.mutateAsync({ id: event!.id, decision: 'approve', reason: 'Verified by admin' });
      toast({ title: 'Event approved', description: 'Attendance record has been approved.' });
      setLocation('/flagged');
    } catch {
      toast({ title: 'Error', description: 'Failed to approve event.', variant: 'destructive' });
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      toast({ title: 'Please enter a reason', variant: 'destructive' });
      return;
    }
    try {
      await reviewFlagged.mutateAsync({ id: event!.id, decision: 'reject', reason });
      toast({ title: 'Event rejected', description: 'Attendance record has been rejected.' });
      setShowRejectDialog(false);
      setLocation('/flagged');
    } catch {
      toast({ title: 'Error', description: 'Failed to reject event.', variant: 'destructive' });
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => setLocation('/flagged')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Flagged Events
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">{event.worker.name}</h1>
            <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Pending Review</Badge>
            <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 capitalize">{event.eventType}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{event.worker.employeeNo}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setShowRejectDialog(true)}
            disabled={reviewFlagged.isPending}
          >
            <X className="w-4 h-4 mr-1.5" />
            Reject
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleApprove}
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
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Event Type</p>
            <p className="font-medium capitalize">{event.eventType}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Confidence Score</p>
            <p className="font-medium">{(event.confidenceScore * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Match Method</p>
            <p className="font-medium capitalize">{event.matchMethod}</p>
          </div>
        </div>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Event</DialogTitle>
            <DialogDescription>Please provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Reason *</Label>
            <Textarea
              placeholder="e.g. Face not recognized — worker used manual sign-in"
              className="mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reviewFlagged.isPending}>
              {reviewFlagged.isPending ? 'Rejecting…' : 'Reject Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
