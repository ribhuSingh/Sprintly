import type { ReactNode } from 'react';
import type { IssuePriority, IssueStatus } from '@sprintly/shared';
import { Logo } from '@/components/layout/Logo';
import { PriorityIcon, StatusIcon } from '@/features/issues/IssueBits';

const PREVIEW: { id: string; title: string; status: IssueStatus; priority: IssuePriority; who: string }[] = [
  { id: 'PAY-142', title: 'UPI collect request times out on Jio network', status: 'in_progress', priority: 'urgent', who: 'KM' },
  { id: 'PAY-139', title: 'GST invoice PDF missing HSN code column', status: 'in_review', priority: 'high', who: 'AS' },
  { id: 'WEB-311', title: 'Tamil and Kannada strings overflow on checkout', status: 'todo', priority: 'medium', who: 'PN' },
  { id: 'WEB-308', title: 'Pincode lookup should autofill city and state', status: 'todo', priority: 'low', who: 'RV' },
  { id: 'API-87', title: 'Retry settlement webhook with exponential backoff', status: 'done', priority: 'high', who: 'SR' },
];

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(420px,1fr)_1.15fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto my-auto w-full max-w-sm space-y-7 py-12">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <p className="text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>

      <div className="hidden flex-col justify-center gap-8 border-l bg-sidebar px-14 lg:flex" aria-hidden>
        <div className="max-w-md space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-brand">Issue tracking</p>
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            A board your whole team actually keeps up to date.
          </p>
          <p className="text-sm text-muted-foreground">
            Issues, a Kanban board and a shared calendar, synced live across everyone on the project.
          </p>
        </div>

        <div className="max-w-xl overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-[2px] bg-[#c2410c]" />
            <span className="font-medium text-foreground">Payments</span>
            <span>/ Current cycle</span>
            <span className="ml-auto font-mono">5 of 38</span>
          </div>
          <ul className="divide-y text-[13px]">
            {PREVIEW.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                <PriorityIcon priority={i.priority} className="size-3.5" />
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{i.id}</span>
                <StatusIcon status={i.status} className="size-3.5" />
                <span className={i.status === 'done' ? 'flex-1 truncate text-muted-foreground line-through decoration-border' : 'flex-1 truncate'}>
                  {i.title}
                </span>
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
                  {i.who}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
