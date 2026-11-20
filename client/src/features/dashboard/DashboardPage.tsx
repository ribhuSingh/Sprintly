import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { Layers } from 'lucide-react';
import type { AnalyticsDTO, IssueDTO } from '@sprintly/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { NativeSelect } from '@/components/ui/input';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useCurrentUser } from '@/features/auth/hooks';
import { useProjects } from '@/features/projects/hooks';
import { DueDate, PriorityIcon, StatusIcon } from '@/features/issues/IssueBits';

// Recharts is the heaviest dependency; keep it out of the dashboard's initial chunk.
const Charts = lazy(() => import('./Charts'));

export default function DashboardPage() {
  const me = useCurrentUser();
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState('');

  const analytics = useQuery({
    queryKey: qk.analytics(projectId || undefined),
    queryFn: ({ signal }) => api.get<AnalyticsDTO>('/analytics', { projectId: projectId || undefined }, signal),
  });

  const range = useMemo(() => {
    const from = startOfDay(new Date());
    return { from: from.toISOString(), to: addDays(from, 14).toISOString() };
  }, []);
  const upcoming = useQuery({
    queryKey: qk.calendar(range.from, range.to, projectId || undefined),
    queryFn: ({ signal }) =>
      api.get<{ issues: IssueDTO[] }>('/calendar', { ...range, projectId: projectId || undefined }, signal),
  });


  return (
    <>
      <PageHeader
        title="Overview"
        description={`${format(new Date(), 'EEEE, d MMMM')} · Signed in as ${me.name}`}
        actions={
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only">Scope</span>
            <NativeSelect className="h-8 w-44 text-[13px]" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </NativeSelect>
          </label>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        {analytics.error ? (
          <ErrorFallback error={analytics.error} onReset={() => void analytics.refetch()} />
        ) : (
          <>
            <StatTiles data={analytics.data} />
            {analytics.data && analytics.data.totals.total === 0 ? (
              <EmptyState icon={Layers} title="No issues to chart yet" description="Create some issues and your analytics will appear here." />
            ) : (
              <Suspense fallback={<ChartsSkeleton />}>
                {analytics.data ? <Charts data={analytics.data} /> : <ChartsSkeleton />}
              </Suspense>
            )}
          </>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Due in the next 14 days</CardTitle>
            <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground">Calendar →</Link>
          </CardHeader>
          <CardContent>
            {upcoming.isPending ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
            ) : !upcoming.data?.issues.filter((i) => i.status !== 'done').length ? (
              <p className="text-sm text-muted-foreground">Nothing open is due in the next two weeks.</p>
            ) : (
              <ul className="divide-y">
                {upcoming.data.issues.filter((i) => i.status !== 'done').slice(0, 8).map((i) => (
                  <li key={i.id}>
                    <Link to={`/projects/${i.project}/board?issue=${i.id}`} className="-mx-2 flex items-center gap-3 rounded px-2 py-2 text-[13px] hover:bg-accent/60">
                      <StatusIcon status={i.status} />
                      <PriorityIcon priority={i.priority} />
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{i.identifier}</span>
                      <span className="flex-1 truncate">{i.title}</span>
                      <DueDate iso={i.dueDate} />
                      <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{i.dueDate && format(parseISO(i.dueDate), 'EEE')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatTiles({ data }: { data?: AnalyticsDTO }) {
  const t = data?.totals;
  const rate = t ? (t.total ? Math.round((t.completed / t.total) * 100) : 0) : undefined;
  const tiles = [
    { label: 'Open', value: t?.open, sub: t ? `of ${t.total} issues` : '' },
    { label: 'Closed this week', value: t?.completedThisWeek, sub: t ? `${t.completed} closed overall` : '' },
    { label: 'Overdue', value: t?.overdue, sub: t?.overdue ? 'Past due, still open' : 'Nothing overdue', critical: !!t?.overdue },
    { label: 'Completion', value: rate === undefined ? undefined : `${rate}%`, sub: 'Closed / all issues' },
  ];
  return (
    <ul className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map(({ label, value, sub, critical }, i) => (
        <li
          key={label}
          className={cn('px-4 py-3.5', i > 0 && 'border-t sm:border-t-0', i % 2 === 1 && 'sm:border-l', i === 2 && 'sm:border-t lg:border-t-0 lg:border-l', i === 3 && 'sm:border-t lg:border-t-0')}
        >
          <p className="text-xs text-muted-foreground">{label}</p>
          {value === undefined ? (
            <Skeleton className="mt-1.5 h-7 w-14" />
          ) : (
            <p className="mt-0.5 font-mono text-2xl font-medium tabular-nums tracking-tight" style={critical ? { color: 'var(--status-critical)' } : undefined}>
              {value}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{sub}</p>
        </li>
      ))}
    </ul>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Loading charts">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}
    </div>
  );
}
