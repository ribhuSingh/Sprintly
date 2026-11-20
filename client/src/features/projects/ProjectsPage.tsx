import { Link } from 'react-router';
import { FolderKanban, Plus } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useUI } from '@/components/layout/uiContext';
import { fullDate } from '@/lib/utils';
import { useProjects, useTeams } from './hooks';

export default function ProjectsPage() {
  const { data: projects, isPending, error, refetch } = useProjects();
  const { data: teams } = useTeams();
  const ui = useUI();
  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? '';

  return (
    <>
      <PageHeader
        title="Projects"
        description={projects ? `${projects.length} active across your teams` : undefined}
        actions={<Button size="sm" onClick={ui.openCreateProject}><Plus /> New project</Button>}
      />
      <div className="p-4 sm:p-6">
        {error ? (
          <ErrorFallback error={error} onReset={() => void refetch()} />
        ) : isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Projects hold your team’s issues, board and schedule."
            action={<Button onClick={ui.openCreateProject}>Create your first project</Button>}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const daysLeft = p.targetDate ? differenceInCalendarDays(parseISO(p.targetDate), new Date()) : null;
              return (
                <li key={p.id}>
                  <Card className="h-full transition-colors focus-within:ring-2 focus-within:ring-ring hover:border-input">
                    <Link to={`/projects/${p.id}/board`} className="flex h-full flex-col gap-2.5 p-4 outline-none">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: p.color }} aria-hidden />
                        <h2 className="text-sm font-semibold">{p.name}</h2>
                        <span className="ml-auto font-mono text-xs text-muted-foreground">{p.key}</span>
                      </div>
                      <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description || 'No description'}</p>
                      <div className="flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
                        <span>{teamName(p.team)} · {p.issueCount} issues</span>
                        {p.targetDate && (
                          <span title={`Target ${fullDate(p.targetDate)}`} className={daysLeft !== null && daysLeft < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                            {daysLeft! >= 0 ? `${daysLeft}d left` : `${-daysLeft!}d overdue`}
                          </span>
                        )}
                      </div>
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
