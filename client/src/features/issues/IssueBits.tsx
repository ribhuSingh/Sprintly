import { useState, type ReactNode } from 'react';
import { CalendarClock, Check, Circle, CircleDashed, CircleDot, CircleCheck, CircleEllipsis, Minus, SignalHigh, SignalLow, SignalMedium, AlertOctagon, UserRound } from 'lucide-react';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type IssuePriority,
  type IssueStatus,
  type LabelDTO,
  type UserDTO,
} from '@sprintly/shared';
import { Command } from 'cmdk';
import { cn, dueState, shortDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';

// ---------- Icons ----------
const STATUS_ICON: Record<IssueStatus, { icon: typeof Circle; className: string }> = {
  backlog: { icon: CircleDashed, className: 'text-muted-foreground' },
  todo: { icon: Circle, className: 'text-muted-foreground' },
  in_progress: { icon: CircleDot, className: 'text-amber-600 dark:text-amber-400' },
  in_review: { icon: CircleEllipsis, className: 'text-sky-600 dark:text-sky-400' },
  done: { icon: CircleCheck, className: 'text-emerald-600 dark:text-emerald-500' },
};

export function StatusIcon({ status, className }: { status: IssueStatus; className?: string }) {
  const { icon: Icon, className: color } = STATUS_ICON[status];
  return <Icon className={cn('size-4 shrink-0', color, className)} aria-label={STATUS_LABELS[status]} />;
}

const PRIORITY_ICON: Record<IssuePriority, { icon: typeof Circle; className: string }> = {
  none: { icon: Minus, className: 'text-muted-foreground' },
  low: { icon: SignalLow, className: 'text-muted-foreground' },
  medium: { icon: SignalMedium, className: 'text-foreground' },
  high: { icon: SignalHigh, className: 'text-foreground' },
  urgent: { icon: AlertOctagon, className: 'text-red-600 dark:text-red-400' },
};

export function PriorityIcon({ priority, className }: { priority: IssuePriority; className?: string }) {
  const { icon: Icon, className: color } = PRIORITY_ICON[priority];
  return <Icon className={cn('size-4 shrink-0', color, className)} aria-label={`Priority: ${PRIORITY_LABELS[priority]}`} />;
}

export function LabelPill({ label }: { label: LabelDTO }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border px-1.5 py-px text-[11px] text-muted-foreground">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: label.color }} aria-hidden />
      {label.name}
    </span>
  );
}

export function DueDate({ iso, done, className }: { iso: string | null; done?: boolean; className?: string }) {
  if (!iso) return null;
  const state = dueState(iso, done);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        state === 'overdue' ? 'text-red-600 dark:text-red-400' : state === 'today' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        className,
      )}
      title={state === 'overdue' ? 'Overdue' : 'Due date'}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {shortDate(iso)}
    </span>
  );
}

// ---------- Pickers ----------
/** Searchable, keyboard-navigable popover list built on cmdk. */
function PickerPopover({
  trigger,
  label,
  children,
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  label: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-60" onClick={(e) => e.stopPropagation()}>
        <Command label={label} loop>
          <Command.Input
            placeholder={`${label}…`}
            className="h-9 w-full border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="p-3 text-center text-xs text-muted-foreground">No matches</Command.Empty>
            {children}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const optionClass =
  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent';

export function StatusPicker({ value, onChange, children }: { value: IssueStatus; onChange: (s: IssueStatus) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label="Change status" trigger={children}>
      {ISSUE_STATUSES.map((s) => (
        <Command.Item key={s} value={STATUS_LABELS[s]} className={optionClass} onSelect={() => { onChange(s); setOpen(false); }}>
          <StatusIcon status={s} /> {STATUS_LABELS[s]}
          {s === value && <Check className="ml-auto size-4" />}
        </Command.Item>
      ))}
    </PickerPopover>
  );
}

export function PriorityPicker({ value, onChange, children }: { value: IssuePriority; onChange: (p: IssuePriority) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label="Set priority" trigger={children}>
      {[...ISSUE_PRIORITIES].reverse().map((p) => (
        <Command.Item key={p} value={PRIORITY_LABELS[p]} className={optionClass} onSelect={() => { onChange(p); setOpen(false); }}>
          <PriorityIcon priority={p} /> {PRIORITY_LABELS[p]}
          {p === value && <Check className="ml-auto size-4" />}
        </Command.Item>
      ))}
    </PickerPopover>
  );
}

export function AssigneePicker({
  value,
  members,
  onChange,
  children,
}: {
  value: string[];
  members: UserDTO[];
  onChange: (ids: string[]) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label="Assign to" trigger={children}>
      <Command.Item value="unassigned none" className={optionClass} onSelect={() => { onChange([]); setOpen(false); }}>
        <UserRound className="size-4 text-muted-foreground" /> No assignee
        {value.length === 0 && <Check className="ml-auto size-4" />}
      </Command.Item>
      {members.map((m) => (
        <Command.Item key={m.id} value={`${m.name} ${m.email}`} className={optionClass} onSelect={() => toggle(m.id)}>
          <Avatar user={m} size="xs" /> <span className="truncate">{m.name}</span>
          {value.includes(m.id) && <Check className="ml-auto size-4" />}
        </Command.Item>
      ))}
    </PickerPopover>
  );
}

export function LabelPicker({
  value,
  labels,
  onChange,
  children,
}: {
  value: string[];
  labels: LabelDTO[];
  onChange: (ids: string[]) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label="Add labels" trigger={children}>
      {labels.map((l) => (
        <Command.Item key={l.id} value={l.name} className={optionClass} onSelect={() => toggle(l.id)}>
          <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} /> {l.name}
          {value.includes(l.id) && <Check className="ml-auto size-4" />}
        </Command.Item>
      ))}
    </PickerPopover>
  );
}

export const propertyButton =
  'inline-flex h-8 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:border-border hover:bg-accent/50 cursor-pointer focus-visible:outline-2 focus-visible:outline-ring';
