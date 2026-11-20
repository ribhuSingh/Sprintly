import { NavLink } from 'react-router';
import { Activity, CalendarDays, FolderKanban, LayoutDashboard, Plus, Search, Settings } from 'lucide-react';
import { useProjects, useTeams } from '@/features/projects/hooks';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/misc';
import { Tooltip } from '../ui/menu';
import { Logo } from './Logo';
import { useUI } from './uiContext';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/activity', label: 'Activity', icon: Activity },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
    isActive ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
  );

export function Sidebar() {
  const { data: projects, isPending } = useProjects();
  const { data: teams } = useTeams();
  const ui = useUI();
  const workspace = teams?.[0]?.name;

  return (
    <nav className="flex h-full flex-col overflow-y-auto px-2.5 py-3">
      <div className="flex items-center gap-2 px-1.5 pb-4">
        <Logo compact />
        <div className="min-w-0 leading-tight">
          <p className="text-[13px] font-semibold">Sprintly</p>
          <p className="truncate text-xs text-muted-foreground">{workspace ?? ' '}</p>
        </div>
      </div>

      <ul className="space-y-px">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={linkClass}>
              <Icon className="size-[15px]" strokeWidth={1.75} aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-px">
        <div className="flex h-7 items-center justify-between px-2">
          <h2 className="text-xs font-medium text-muted-foreground">Projects</h2>
          <Tooltip content="New project">
            <button
              onClick={ui.openCreateProject}
              className="-mr-1 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
              aria-label="New project"
            >
              <Plus className="size-3.5" />
            </button>
          </Tooltip>
        </div>
        {isPending ? (
          <div className="space-y-2 px-2 pt-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-4" />
            ))}
          </div>
        ) : projects?.length ? (
          <ul className="space-y-px">
            {projects.map((p) => (
              <li key={p.id}>
                <NavLink to={`/projects/${p.id}`} className={linkClass}>
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: p.color }} aria-hidden />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground/80">{p.issueCount}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 text-xs text-muted-foreground">No projects yet.</p>
        )}
      </div>

      <div className="mt-auto pt-4">
        <NavLink to="/settings" className={linkClass}>
          <Settings className="size-[15px]" strokeWidth={1.75} aria-hidden />
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
