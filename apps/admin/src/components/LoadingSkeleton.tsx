export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}px` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border last:border-0 px-4 py-3 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 bg-muted rounded animate-pulse"
              style={{ width: `${50 + ((i + j) % 4) * 25}px`, opacity: 0.6 + (j % 3) * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-5 bg-muted rounded animate-pulse w-48" />
            <div className="h-5 bg-muted rounded animate-pulse w-20" />
          </div>
          <div className="flex gap-4">
            <div className="h-4 bg-muted rounded animate-pulse w-32" />
            <div className="h-4 bg-muted rounded animate-pulse w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
