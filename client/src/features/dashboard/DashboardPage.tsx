import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, Layers } from 'lucide-react';
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${me.name.split(' ')[0]}`}
        description="Here’s how work is moving across your projects."
        actions={
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Scope</span>
            <NativeSelect className="h-8 w-48" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </NativeSelect>
          </label>
        }
      />
      <div className="space-y-6 p-4 sm:p-6">
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
            <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4" /> Due in the next 14 days</CardTitle>
            <Link to="/calendar" className="text-xs text-primary hover:underline">Open calendar</Link>
          </CardHeader>
          <CardContent>
            {upcoming.isPending ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
            ) : !upcoming.data?.issues.filter((i) => i.status !== 'done').length ? (
              <p className="text-sm text-muted-foreground">Nothing due soon. 🎉</p>
            ) : (
              <ul className="divide-y">
                {upcoming.data.issues.filter((i) => i.status !== 'done').slice(0, 8).map((i) => (
                  <li key={i.id}>
                    <Link to={`/projects/${i.project}/board?issue=${i.id}`} className="flex items-center gap-3 py-2 text-sm hover:bg-muted/40">
                      <StatusIcon status={i.status} />
                      <PriorityIcon priority={i.priority} />
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">{i.identifier}</span>
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
  const tiles = [
    { label: 'Open issues', value: t?.open, icon: CircleDot, sub: t ? `of ${t.total} total` : '' },
    { label: 'Completed this week', value: t?.completedThisWeek, icon: CheckCircle2, sub: t ? `${t.completed} completed overall` : '' },
    {
      label: 'Overdue',
      value: t?.overdue,
      icon: AlertTriangle,
      sub: t?.overdue ? 'Past due and not done' : 'Nothing overdue',
      critical: !!t?.overdue,
    },
    {
      label: 'Completion rate',
      value: t ? `${t.total ? Math.round((t.completed / t.total) * 100) : 0}%` : undefined,
      icon: Layers,
      sub: 'Done ÷ all issues',
    },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map(({ label, value, icon: Icon, sub, critical }) => (
        <li key={label}>
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" style={critical ? { color: 'var(--status-critical)' } : undefined} aria-hidden />
              {label}
            </p>
            {value === undefined ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
            )}
            <p className={cn('mt-1 text-xs text-muted-foreground')}>{sub}</p>
          </Card>
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
