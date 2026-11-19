import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { ErrorFallback } from '../ErrorBoundary';
import { Button } from '../ui/button';

/** Router-level error boundary: catches render/loader errors and failed lazy chunk loads. */
export function RouteError() {
  const error = useRouteError();
  const err =
    error instanceof Error
      ? error
      : new Error(isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : 'Unknown error');
  const isChunkError = /dynamically imported module|Loading chunk/i.test(err.message);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <ErrorFallback
        error={isChunkError ? new Error('A new version of Sprintly is available.') : err}
        onReset={() => window.location.reload()}
      />
      <Button asChild variant="link">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
