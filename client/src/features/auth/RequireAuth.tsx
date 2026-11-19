import { Navigate, Outlet, useLocation } from 'react-router';
import { FullScreenLoader } from '@/components/layout/PageSkeleton';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useMe } from './hooks';

export function RequireAuth() {
  const { data: user, isPending, error, refetch } = useMe();
  const location = useLocation();
  if (isPending) return <FullScreenLoader />;
  if (error) return <ErrorFallback error={error} onReset={() => void refetch()} />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate replace to={`/login?next=${next}`} />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const { data: user, isPending } = useMe();
  if (isPending) return <FullScreenLoader />;
  if (user) return <Navigate replace to="/" />;
  return <Outlet />;
}
