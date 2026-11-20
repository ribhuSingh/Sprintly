import { Skeleton } from '../ui/misc';

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-6" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex h-dvh items-center justify-center" role="status" aria-label="Loading Sprintly">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-brand" />
        Loading…
      </div>
    </div>
  );
}
