import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Activity } from 'lucide-react';
import type { ActivityDTO, CursorPage } from '@sprintly/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/utils';
import { Avatar, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { describe } from '@/features/issues/IssueComments';

/**
 * Infinite, virtualised activity feed. Only the rows in view (+ overscan) are in the DOM,
 * so scrolling through thousands of events stays smooth. Pages are fetched with a keyset cursor.
 */
export default function ActivityPage() {
  const { projectId } = useParams();
  const { data, error, refetch, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: qk.activity(projectId),
    queryFn: ({ pageParam, signal }) =>
      api.get<CursorPage<ActivityDTO>>('/activity', { cursor: pageParam, projectId, limit: 40 }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: hasNextPage ? items.length + 1 : items.length, // +1 row for the loader
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // Fetch the next page as the loader row scrolls into view.
  const lastIndex = virtualItems.at(-1)?.index ?? -1;
  useEffect(() => {
    if (lastIndex >= items.length - 1 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [lastIndex, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const body = error ? (
    <ErrorFallback error={error} onReset={() => void refetch()} />
  ) : isPending ? (
    <div className="space-y-3 p-6" role="status" aria-label="Loading activity">
      {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12" />)}
    </div>
  ) : items.length === 0 ? (
    <div className="p-6">
      <EmptyState icon={Activity} title="No activity yet" description="Changes to issues and projects will show up here in real time." />
    </div>
  ) : (
    <div ref={scrollRef} className="h-full overflow-y-auto" tabIndex={0} aria-label="Activity feed">
      <ol role="feed" aria-busy={isFetchingNextPage} className="relative mx-auto max-w-3xl" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((row) => {
          const a = items[row.index];
          return (
            <li
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              aria-posinset={row.index + 1}
              aria-setsize={hasNextPage ? -1 : items.length}
              className="absolute inset-x-0 px-4 sm:px-6"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              {a ? (
                <div className="flex gap-3 border-b py-3 text-sm">
                  <Avatar user={a.actor} size="md" />
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-medium">{a.actor.name}</span>{' '}
                      <span className="text-muted-foreground">{describe(a)}</span>
                      {a.issue && a.verb !== 'issue.deleted' && a.project && (
                        <>
                          {' '}
                          <Link className="font-medium hover:underline" to={`/projects/${a.project.id}/board?issue=${a.issue.id}`}>
                            {a.issue.identifier} {a.issue.title}
                          </Link>
                        </>
                      )}
                      {a.verb === 'issue.deleted' && a.issue && <span className="line-through"> {a.issue.identifier} {a.issue.title}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {!projectId && a.project && <>{a.project.name} · </>}
                      <time dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading more…</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );

  if (projectId) return body;
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Activity" description="Everything happening across your teams, live." />
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
}
