import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { useSites, useWorkers } from '@/lib/queries';

export default function Sites() {
  const { data: sitesData, isLoading } = useSites();
  const { data: workersData } = useWorkers();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sites = sitesData?.data ?? [];
  const _workers = workersData?.data ?? [];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Sites</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {sites.filter((s) => s.status === 'active').length} active sites
        </p>
      </div>

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : sites.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No sites found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => {
            const siteWorkers: typeof _workers = [];
            const isExpanded = expandedId === site.id;
            return (
              <div key={site.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : site.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-semibold">{site.name}</h2>
                      <Badge
                        className={`text-xs ${site.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                      >
                        {site.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {site.address && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {site.address}
                      </div>
                    )}
                    {siteWorkers.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {siteWorkers.length} worker{siteWorkers.length !== 1 ? 's' : ''} assigned
                      </div>
                    )}
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </button>

                {isExpanded && siteWorkers.length > 0 && (
                  <div className="border-t border-border px-5 pb-5">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 mb-3">
                      Assigned Workers
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 font-medium text-muted-foreground text-xs">Name</th>
                          <th className="text-left py-2 font-medium text-muted-foreground text-xs">Employee No.</th>
                          <th className="text-left py-2 font-medium text-muted-foreground text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {siteWorkers.map((w) => (
                          <tr key={w.id} className="border-b border-border last:border-0">
                            <td className="py-2.5 font-medium">{w.name}</td>
                            <td className="py-2.5 text-muted-foreground font-mono text-xs">{w.employeeNo}</td>
                            <td className="py-2.5">
                              <Badge className={`text-xs ${w.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}`}
                              >
                                {w.status === 'active' ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
