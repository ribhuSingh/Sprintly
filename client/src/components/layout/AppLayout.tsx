import { lazy, Suspense, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { Dialog, SheetContent, DialogTitle } from '../ui/dialog';
import { ErrorBoundary } from '../ErrorBoundary';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useTheme } from '@/hooks/useTheme';
import { useRealtime } from '@/features/realtime/useRealtime';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { UIContext, type CreateIssueOptions, type UIContextValue } from './uiContext';

// Dialogs are only fetched when first opened.
const CommandPalette = lazy(() => import('@/features/command/CommandPalette'));
const ShortcutsDialog = lazy(() => import('@/features/command/ShortcutsDialog'));
const CreateIssueDialog = lazy(() => import('@/features/issues/CreateIssueDialog'));
const CreateProjectDialog = lazy(() => import('@/features/projects/CreateProjectDialog'));

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const { toggle: toggleTheme } = useTheme();

  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [createIssue, setCreateIssue] = useState<CreateIssueOptions | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useRealtime();

  const ui = useMemo<UIContextValue>(
    () => ({
      openCommandPalette: () => setCommandOpen(true),
      openShortcuts: () => setShortcutsOpen(true),
      openCreateIssue: (opts) => setCreateIssue({ projectId, ...opts }),
      openCreateProject: () => setCreateProjectOpen(true),
    }),
    [projectId],
  );

  useHotkeys({
    'mod+k': () => setCommandOpen((o) => !o),
    c: () => ui.openCreateIssue(),
    '/': () => navigate('/search'),
    '?': () => setShortcutsOpen(true),
    'g d': () => navigate('/'),
    'g p': () => navigate('/projects'),
    'g c': () => navigate('/calendar'),
    'g a': () => navigate('/activity'),
    'g s': () => navigate('/settings'),
    'g b': () => projectId && navigate(`/projects/${projectId}/board`),
    'g l': () => projectId && navigate(`/projects/${projectId}/list`),
    't': () => toggleTheme(),
  });

  return (
    <UIContext.Provider value={ui}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="flex h-dvh overflow-hidden">
        <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:block" aria-label="Primary">
          <Sidebar />
        </aside>
        <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" aria-describedby={undefined} onClick={(e) => (e.target as HTMLElement).closest('a') && setMobileNavOpen(false)}>
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <Sidebar />
          </SheetContent>
        </Dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-auto outline-none">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <Suspense fallback={null}>
        {commandOpen && <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />}
        {shortcutsOpen && <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />}
        {createIssue && (
          <CreateIssueDialog
            open
            defaults={createIssue}
            onOpenChange={(o) => !o && setCreateIssue(null)}
          />
        )}
        {createProjectOpen && <CreateProjectDialog open onOpenChange={setCreateProjectOpen} />}
      </Suspense>
    </UIContext.Provider>
  );
}
