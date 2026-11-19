import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router';
import { RequireAuth, RedirectIfAuthed } from './features/auth/RequireAuth';
import { AppLayout } from './components/layout/AppLayout';
import { RouteError } from './components/layout/RouteError';
import { PageSkeleton } from './components/layout/PageSkeleton';

// Route-level code splitting: each page (and its heavy deps: recharts, dnd-kit, tanstack table)
// is downloaded only when first visited.
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const ProjectLayout = lazy(() => import('./features/projects/ProjectLayout'));
const BoardPage = lazy(() => import('./features/board/BoardPage'));
const IssueListPage = lazy(() => import('./features/issues/IssueListPage'));
const ActivityPage = lazy(() => import('./features/activity/ActivityPage'));
const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage'));
const SearchPage = lazy(() => import('./features/search/SearchPage'));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));

const page = (el: React.ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

/** Deep links from notifications: /projects/:id/issues/:issueId → board with the issue sheet open. */
function IssueRedirect() {
  const { projectId, issueId } = useParams();
  return <Navigate replace to={`/projects/${projectId}/board?issue=${issueId}`} />;
}

const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { element: <RedirectIfAuthed />, children: [
        { path: '/login', element: page(<LoginPage />) },
        { path: '/register', element: page(<RegisterPage />) },
      ] },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            errorElement: <RouteError />,
            children: [
              { index: true, element: page(<DashboardPage />) },
              { path: 'projects', element: page(<ProjectsPage />) },
              { path: 'projects/:projectId/issues/:issueId', element: <IssueRedirect /> },
              {
                path: 'projects/:projectId',
                element: page(<ProjectLayout />),
                children: [
                  { index: true, element: <Navigate replace to="board" /> },
                  { path: 'board', element: page(<BoardPage />) },
                  { path: 'list', element: page(<IssueListPage />) },
                  { path: 'activity', element: page(<ActivityPage />) },
                ],
              },
              { path: 'activity', element: page(<ActivityPage />) },
              { path: 'search', element: page(<SearchPage />) },
              { path: 'calendar', element: page(<CalendarPage />) },
              { path: 'settings/*', element: page(<SettingsPage />) },
              { path: '*', element: <Navigate replace to="/" /> },
            ],
          },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
