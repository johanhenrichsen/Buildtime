import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { useSites } from '@/lib/queries';

export default function Sites() {
  const { data: sitesData, isLoading } = useSites();
  const sites = sitesData?.data ?? [];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Sites</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {sites.filter((s) => s.status === 'active').length} active site{sites.filter((s) => s.status === 'active').length !== 1 ? 's' : ''}
        </p>
      </div>

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : sites.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold text-foreground mb-1">No sites yet</h2>
          <p className="text-sm text-muted-foreground">Contact your system administrator to add construction sites.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <div key={site.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
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
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {site.address}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
