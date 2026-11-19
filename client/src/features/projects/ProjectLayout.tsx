import { lazy, Suspense } from 'react';
import { NavLink, Outlet, useParams, useSearchParams } from 'react-router';
import { Activity, List, Plus, SquareKanban } from 'lucide-react';
import { hasRole } from '@sprintly/shared';
import { Button } from '@/components/ui/button';
import { AvatarStack, Skeleton } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/menu';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useUI } from '@/components/layout/uiContext';
import { useProjectRoom, useSocketStatus } from '@/features/realtime/useRealtime';
import { cn } from '@/lib/utils';
import { useProject } from './hooks';

const IssueDetailSheet = lazy(() => import('@/features/issues/IssueDetailSheet'));

const TABS = [
  { to: 'board', label: 'Board', icon: SquareKanban },
  { to: 'list', label: 'List', icon: List },
  { to: 'activity', label: 'Activity', icon: Activity },
];

export default function ProjectLayout() {
  const { projectId = '' } = useParams();
  const { data, isPending, error, refetch } = useProject(projectId);
  const viewers = useProjectRoom(projectId);
  const connected = useSocketStatus();
  const ui = useUI();
  const [params, setParams] = useSearchParams();
  const openIssueId = params.get('issue');

  if (error) return <ErrorFallback error={error} onReset={() => void refetch()} />;

  const project = data?.project;
  const canEdit = data ? hasRole(data.myRole, 'member') : false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {isPending || !project ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <>
                <span className="size-3 shrink-0 rounded" style={{ backgroundColor: project.color }} aria-hidden />
                <h1 className="truncate text-xl font-semibold tracking-tight">{project.name}</h1>
                <span className="rounded border px-1.5 text-xs text-muted-foreground">{project.key}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Tooltip content={connected ? `Live: ${viewers.map((v) => v.name).join(', ') || 'just you'}` : 'Reconnecting…'}>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('size-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')} aria-hidden />
                <AvatarStack users={viewers} max={4} size="xs" />
                <span className="sr-only">{connected ? `${viewers.length} people viewing` : 'Reconnecting'}</span>
              </span>
            </Tooltip>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => ui.openCreateIssue({ projectId })}>
                <Plus /> Issue
              </Button>
            )}
          </div>
        </div>
        <nav aria-label="Project views" className="-mb-px flex gap-4">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 border-b-2 px-1 pb-2.5 text-sm transition-colors',
                  isActive ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>

      {openIssueId && (
        <Suspense fallback={null}>
          <IssueDetailSheet
            issueId={openIssueId}
            projectId={projectId}
            onClose={() =>
              setParams((p) => {
                p.delete('issue');
                return p;
              })
            }
          />
        </Suspense>
      )}
    </div>
  );
}
