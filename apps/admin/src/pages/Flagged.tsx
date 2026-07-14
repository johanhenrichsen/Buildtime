import { useLocation } from 'wouter';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { useFlagged } from '@/lib/queries';

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Flagged() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useFlagged();

  const events = data?.data ?? [];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Flagged Events</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {events.length} event{events.length !== 1 ? 's' : ''} requiring review
        </p>
      </div>

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : events.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h2 className="font-semibold text-foreground mb-1">All caught up</h2>
          <p className="text-sm text-muted-foreground">No flagged attendance events need review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="bg-card border border-border rounded-lg p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold">{ev.worker.name}</h2>
                    <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                      Needs Review
                    </Badge>
                    <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 capitalize">
                      {ev.eventType}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <span>{formatTs(ev.serverTs)}</span>
                    <span>Confidence: <strong className="text-foreground">{(ev.confidenceScore * 100).toFixed(0)}%</strong></span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => setLocation(`/flagged/${ev.id}`)}
                >
                  Review
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
