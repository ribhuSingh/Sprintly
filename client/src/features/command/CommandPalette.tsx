import { useState } from 'react';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Activity,
  CalendarDays,
  FolderKanban,
  Keyboard,
  LayoutDashboard,
  List,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  SquareKanban,
} from 'lucide-react';
import type { SearchResultsDTO } from '@sprintly/shared';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/misc';
import { useUI } from '@/components/layout/uiContext';
import { useProjects } from '@/features/projects/hooks';
import { useLogout } from '@/features/auth/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { StatusIcon } from '@/features/issues/IssueBits';

const itemClass =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground';
const groupClass =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground';

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const ui = useUI();
  const { toggle } = useTheme();
  const logout = useLogout();
  const { data: projects } = useProjects();
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 200);

  const { data: results, isFetching } = useQuery({
    queryKey: qk.search(q),
    queryFn: ({ signal }) => api.get<SearchResultsDTO>('/search', { q, limit: 8 }, signal),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });

  const run = (fn: () => void) => {
    onOpenChange(false);
    setSearch('');
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" hideClose>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search issues, jump to pages, or run actions</DialogDescription>
        {/* cmdk implements the ARIA combobox/listbox pattern + arrow-key navigation. */}
        <Command label="Command palette" className="flex flex-col" loop>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search issues…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {isFetching ? 'Searching…' : 'No results found.'}
            </Command.Empty>

            {results && results.issues.length > 0 && (
              <Command.Group heading="Issues" className={groupClass}>
                {results.issues.map((i) => (
                  <Command.Item
                    key={i.id}
                    value={`issue ${i.identifier} ${i.title}`}
                    // Server already matched it (maybe on description); don't let cmdk filter it out.
                    keywords={[search]}
                    onSelect={() => run(() => navigate(`/projects/${i.project}/board?issue=${i.id}`))}
                    className={itemClass}
                  >
                    <StatusIcon status={i.status} />
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">{i.identifier}</span>
                    <span className="truncate">{i.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Actions" className={groupClass}>
              <Command.Item className={itemClass} onSelect={() => run(() => ui.openCreateIssue())}>
                <Plus /> Create issue <Shortcut keys={['C']} />
              </Command.Item>
              <Command.Item className={itemClass} onSelect={() => run(ui.openCreateProject)}>
                <FolderKanban /> Create project
              </Command.Item>
              <Command.Item className={itemClass} onSelect={() => run(toggle)}>
                <Moon /> Toggle theme <Shortcut keys={['T']} />
              </Command.Item>
              <Command.Item className={itemClass} onSelect={() => run(ui.openShortcuts)}>
                <Keyboard /> Keyboard shortcuts <Shortcut keys={['?']} />
              </Command.Item>
            </Command.Group>

            {projectId && (
              <Command.Group heading="This project" className={groupClass}>
                <Command.Item className={itemClass} onSelect={() => run(() => navigate(`/projects/${projectId}/board`))}>
                  <SquareKanban /> Board <Shortcut keys={['G', 'B']} />
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => run(() => navigate(`/projects/${projectId}/list`))}>
                  <List /> Issue list <Shortcut keys={['G', 'L']} />
                </Command.Item>
              </Command.Group>
            )}

            <Command.Group heading="Navigation" className={groupClass}>
              {[
                { label: 'Dashboard', icon: LayoutDashboard, to: '/', keys: ['G', 'D'] },
                { label: 'Projects', icon: FolderKanban, to: '/projects', keys: ['G', 'P'] },
                { label: 'Search', icon: Search, to: '/search', keys: ['/'] },
                { label: 'Calendar', icon: CalendarDays, to: '/calendar', keys: ['G', 'C'] },
                { label: 'Activity', icon: Activity, to: '/activity', keys: ['G', 'A'] },
                { label: 'Settings', icon: Settings, to: '/settings', keys: ['G', 'S'] },
              ].map(({ label, icon: Icon, to, keys }) => (
                <Command.Item key={to} value={`go ${label}`} className={itemClass} onSelect={() => run(() => navigate(to))}>
                  <Icon /> Go to {label} <Shortcut keys={keys} />
                </Command.Item>
              ))}
            </Command.Group>

            {!!projects?.length && (
              <Command.Group heading="Projects" className={groupClass}>
                {projects.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`project ${p.name} ${p.key}`}
                    className={itemClass}
                    onSelect={() => run(() => navigate(`/projects/${p.id}/board`))}
                  >
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                    {p.name}
                    <span className="ml-auto text-xs text-muted-foreground">{p.key}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Account" className={groupClass}>
              <Command.Item
                className={itemClass}
                onSelect={() => run(() => logout.mutate(undefined, { onSettled: () => navigate('/login') }))}
              >
                <LogOut /> Log out
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="ml-auto flex gap-1" aria-hidden>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}
