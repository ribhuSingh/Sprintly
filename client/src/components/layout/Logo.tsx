import { cn } from '@/lib/utils';

/** Three stacked bars: a backlog getting shorter. The top bar carries the brand colour. */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect width="32" height="32" rx="6" className="fill-primary" />
        <rect x="8" y="9" width="10" height="3.2" rx="1" className="fill-brand" />
        <rect x="8" y="14.4" width="16" height="3.2" rx="1" className="fill-primary-foreground" />
        <rect x="8" y="19.8" width="7" height="3.2" rx="1" className="fill-primary-foreground" opacity=".55" />
      </svg>
      {!compact && <span className="text-[15px]">Sprintly</span>}
    </span>
  );
}
