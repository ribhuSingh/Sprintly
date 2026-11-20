import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import type { IssueDTO, ProjectDTO } from '@sprintly/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { cn, dueState } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useProjects } from '@/features/projects/hooks';
import { useUpdateIssue } from '@/features/issues/hooks';
import { StatusIcon } from '@/features/issues/IssueBits';

type CalendarData = { issues: IssueDTO[]; projects: ProjectDTO[] };
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [projectId, setProjectId] = useState('');
  const { data: projects } = useProjects();
  const navigate = useNavigate();
  const update = useUpdateIssue();
  const qc = useQueryClient();

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }),
    [month],
  );
  const from = days[0]!.toISOString();
  const to = new Date(days.at(-1)!.getTime() + 864e5 - 1).toISOString();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: qk.calendar(from, to, projectId || undefined),
    queryFn: ({ signal }) => api.get<CalendarData>('/calendar', { from, to, projectId: projectId || undefined }, signal),
    placeholderData: (prev) => prev,
  });

  const byDay = useMemo(() => {
    const m = new Map<string, IssueDTO[]>();
    for (const i of data?.issues ?? []) {
      if (!i.dueDate) continue;
      const k = dayKey(parseISO(i.dueDate));
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return m;
  }, [data]);

  const milestones = useMemo(() => {
    const m = new Map<string, ProjectDTO[]>();
    for (const p of data?.projects ?? []) {
      if (!p.targetDate) continue;
      const k = dayKey(parseISO(p.targetDate));
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [data]);

  const projectColor = (id: string) => projects?.find((p) => p.id === id)?.color ?? '#94a3b8';

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  // Drag an issue onto another day to reschedule it (optimistic, via the shared update mutation).
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const issue = active.data.current?.issue as IssueDTO | undefined;
    const target = String(over.id);
    if (!issue || (issue.dueDate && dayKey(parseISO(issue.dueDate)) === target)) return;
    const dueDate = new Date(`${target}T12:00:00`);
    // The calendar is its own cache entry: patch it so the chip moves immediately, roll back on error.
    // useUpdateIssue handles board/list/detail caches and invalidates ['calendar'] on settle.
    const key = qk.calendar(from, to, projectId || undefined);
    const prev = qc.getQueryData<CalendarData>(key);
    qc.setQueryData<CalendarData>(key, (old) =>
      old ? { ...old, issues: old.issues.map((i) => (i.id === issue.id ? { ...i, dueDate: dueDate.toISOString() } : i)) } : old,
    );
    update.mutate(
      { issue, patch: { dueDate }, optimistic: { dueDate: dueDate.toISOString() } },
      { onError: () => qc.setQueryData(key, prev) },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Calendar"
        description="Issue due dates and project milestones. Drag an issue to reschedule it."
        actions={
          <NativeSelect aria-label="Project" className="h-8 w-44" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All projects</option>
            {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
        }
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight /></Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
          <h2 className="ml-2 text-lg font-semibold" aria-live="polite">{format(month, 'MMMM yyyy')}</h2>
        </div>
      </PageHeader>

      {error ? (
        <ErrorFallback error={error} onReset={() => void refetch()} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b pb-2 text-xs font-medium text-muted-foreground" aria-hidden>
              {days.slice(0, 7).map((d) => <div key={d.toISOString()} className="px-2">{format(d, 'EEE')}</div>)}
            </div>
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <ol className="grid grid-cols-7 border-l" aria-label={`Calendar for ${format(month, 'MMMM yyyy')}`}>
                {days.map((d) => (
                  <DayCell
                    key={d.toISOString()}
                    day={d}
                    inMonth={isSameMonth(d, month)}
                    issues={byDay.get(dayKey(d)) ?? []}
                    milestones={milestones.get(dayKey(d)) ?? []}
                    loading={isPending}
                    colorOf={projectColor}
                    onOpen={(i) => navigate(`/projects/${i.project}/board?issue=${i.id}`)}
                  />
                ))}
              </ol>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  );
}

function DayCell({
  day,
  inMonth,
  issues,
  milestones,
  loading,
  colorOf,
  onOpen,
}: {
  day: Date;
  inMonth: boolean;
  issues: IssueDTO[];
  milestones: ProjectDTO[];
  loading: boolean;
  colorOf: (id: string) => string;
  onOpen: (i: IssueDTO) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day) });
  const MAX = 3;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? issues : issues.slice(0, MAX);
  return (
    <li
      ref={setNodeRef}
      aria-label={`${format(day, 'EEEE, MMMM d')}: ${issues.length} issue${issues.length === 1 ? '' : 's'} due`}
      className={cn(
        'min-h-28 space-y-1 border-b border-r p-1.5 transition-colors',
        !inMonth && 'bg-muted/30 text-muted-foreground',
        isOver && 'bg-primary/10',
      )}
    >
      <div className="flex items-center justify-between px-1">
        <span className={cn('flex size-6 items-center justify-center rounded-full text-xs', isToday(day) && 'bg-brand font-semibold text-white')}>
          {format(day, 'd')}
        </span>
      </div>
      {milestones.map((p) => (
        <div key={p.id} className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${p.color}22` }} title={`${p.name} target date`}>
          <Flag className="size-3 shrink-0" style={{ color: p.color }} /> {p.name}
        </div>
      ))}
      {loading && inMonth && day.getDate() % 5 === 0 && <Skeleton className="h-5" />}
      {shown.map((i) => <IssueChip key={i.id} issue={i} color={colorOf(i.project)} onOpen={onOpen} />)}
      {issues.length > MAX && (
        <button onClick={() => setExpanded((e) => !e)} className="w-full rounded px-1.5 text-left text-[11px] text-muted-foreground hover:bg-accent cursor-pointer">
          {expanded ? 'Show less' : `+${issues.length - MAX} more`}
        </button>
      )}
    </li>
  );
}

function IssueChip({ issue, color, onOpen }: { issue: IssueDTO; color: string; onOpen: (i: IssueDTO) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id, data: { issue } });
  const overdue = dueState(issue.dueDate, issue.status === 'done') === 'overdue';
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(issue)}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, borderLeftColor: color }}
      className={cn(
        'flex w-full items-center gap-1 truncate rounded border border-l-[3px] bg-card px-1.5 py-0.5 text-left text-[11px] shadow-xs cursor-grab',
        isDragging && 'relative z-10 shadow-lg',
        issue.status === 'done' && 'text-muted-foreground line-through',
        overdue && 'border-red-300 dark:border-red-900',
      )}
      aria-label={`${issue.identifier} ${issue.title}. Press space to pick up and reschedule.`}
    >
      <StatusIcon status={issue.status} className="size-3" />
      <span className="truncate">{issue.title}</span>
    </button>
  );
}
