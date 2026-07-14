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
    <div className="p-4 sm:p-6">
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
        <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Entity ID</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{entry.actor?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{entry.action}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{entry.entity}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs truncate max-w-[140px] hidden md:table-cell">{entry.entityId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs whitespace-nowrap">{formatTs(entry.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
