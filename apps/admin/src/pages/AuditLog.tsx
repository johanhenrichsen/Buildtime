import { TableSkeleton } from '@/components/LoadingSkeleton';
import { useAuditLog } from '@/lib/queries';

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditLog() {
  const { data, isLoading } = useAuditLog({ limit: 100 });
  const entries = data?.data ?? [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All admin actions and manual edits</p>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : entries.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No audit entries yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity ID</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{entry.actor?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{entry.action}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{entry.entity}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs truncate max-w-[160px]">{entry.entityId}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatTs(entry.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
