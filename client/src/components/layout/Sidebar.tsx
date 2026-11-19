import { NavLink } from 'react-router';
import { Activity, CalendarDays, FolderKanban, LayoutDashboard, Plus, Search, Settings } from 'lucide-react';
import { useProjects } from '@/features/projects/hooks';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/misc';
import { Tooltip } from '../ui/menu';
import { Logo } from './Logo';
import { useUI } from './uiContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, keys: 'G D' },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: true, keys: 'G P' },
  { to: '/search', label: 'Search', icon: Search, keys: '/' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, keys: 'G C' },
  { to: '/activity', label: 'Activity', icon: Activity, keys: 'G A' },
  { to: '/settings', label: 'Settings', icon: Settings, keys: 'G S' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
    isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
  );

export function Sidebar() {
  const { data: projects, isPending } = useProjects();
  const ui = useUI();

  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto p-3">
      <div className="px-1 pt-1">
        <Logo />
      </div>
      <ul className="space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end, keys }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={linkClass}>
              <Icon className="size-4" aria-hidden />
              <span className="flex-1">{label}</span>
              <span className="text-[10px] tracking-widest text-muted-foreground/60" aria-hidden>
                {keys}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="space-y-1">
        <div className="flex items-center justify-between px-2.5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projects</h2>
          <Tooltip content="New project">
            <button
              onClick={ui.openCreateProject}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
              aria-label="New project"
            >
              <Plus className="size-4" />
            </button>
          </Tooltip>
        </div>
        {isPending ? (
          <div className="space-y-2 px-2.5 pt-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-5" />
            ))}
          </div>
        ) : projects?.length ? (
          <ul className="space-y-0.5">
            {projects.map((p) => (
              <li key={p.id}>
                <NavLink to={`/projects/${p.id}`} className={linkClass}>
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: p.color }} aria-hidden />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.issueCount}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2.5 text-xs text-muted-foreground">No projects yet.</p>
        )}
      </div>
    </nav>
  );
}
