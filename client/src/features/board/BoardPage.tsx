import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Filter, SquareKanban, X } from 'lucide-react';
import { ISSUE_STATUSES, PRIORITY_LABELS, STATUS_LABELS, hasRole, type IssuePriority, type IssueStatus } from '@sprintly/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useUI } from '@/components/layout/uiContext';
import { useCurrentUser } from '@/features/auth/hooks';
import { useProject, useProjectMembers } from '@/features/projects/hooks';
import { useBoard, useMoveIssue } from '@/features/issues/hooks';
import { CardBody } from './KanbanCard';
import { KanbanColumn } from './KanbanColumn';
import { findContainer, groupByStatus, moveAcross, moveWithin, neighbours, type Columns } from './columns';

export default function BoardPage() {
  const { projectId = '' } = useParams();
  const [, setParams] = useSearchParams();
  const ui = useUI();
  const me = useCurrentUser();
  const { data: board, isPending, error, refetch } = useBoard(projectId);
  const { data: projectData } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const move = useMoveIssue(projectId);
  const readOnly = !projectData || !hasRole(projectData.myRole, 'member');

  // ---- Client-side quick filters ----
  const [text, setText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority[]>([]);
  const filtersActive = !!text || assigneeFilter.length > 0 || priorityFilter.length > 0;

  const visibleIssues = useMemo(() => {
    const q = text.trim().toLowerCase();
    return (board?.issues ?? []).filter(
      (i) =>
        (!q || i.title.toLowerCase().includes(q) || i.identifier.toLowerCase().includes(q)) &&
        (!assigneeFilter.length || i.assignees.some((a) => assigneeFilter.includes(a.id))) &&
        (!priorityFilter.length || priorityFilter.includes(i.priority)),
    );
  }, [board, text, assigneeFilter, priorityFilter]);

  const issuesById = useMemo(() => new Map((board?.issues ?? []).map((i) => [i.id, i])), [board]);
  const labels = useMemo(() => new Map((projectData?.project.labels ?? []).map((l) => [l.id, l])), [projectData]);
  const serverColumns = useMemo(() => groupByStatus(visibleIssues), [visibleIssues]);

  // ---- Drag state ----
  // While dragging we render from a local copy of the columns; afterwards from the query cache.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const awaitingCache = useRef(false);
  const columns = dragColumns ?? serverColumns;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // Hand back to the cache only once the optimistic update has landed, so the card never flickers back.
  useEffect(() => {
    if (awaitingCache.current) {
      awaitingCache.current = false;
      setDragColumns(null);
    }
  }, [board]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDragColumns(serverColumns);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const translated = active.rect.current.translated;
    const below = !!translated && translated.top > over.rect.top + over.rect.height / 2;
    setDragColumns((cols) => (cols ? moveAcross(cols, String(active.id), String(over.id), below) : cols));
  };

  const cancelDrag = () => {
    setActiveId(null);
    setDragColumns(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    const issue = issuesById.get(id);
    setActiveId(null);
    if (!over || !issue || !dragColumns) return cancelDrag();

    const cols = moveWithin(dragColumns, id, String(over.id));
    const status = findContainer(cols, id);
    if (!status) return cancelDrag();

    const target = neighbours(cols[status], id);
    const original = neighbours(serverColumns[issue.status], id);
    if (status === issue.status && target.beforeId === original.beforeId && target.afterId === original.afterId) {
      return cancelDrag(); // dropped where it started
    }

    setDragColumns(cols);
    awaitingCache.current = true;
    move.mutate({ issue, status, ...target });
  };

  const openIssue = useCallback(
    (id: string) =>
      setParams((p) => {
        p.set('issue', id);
        return p;
      }),
    [setParams],
  );
  const createIn = useCallback((status: IssueStatus) => ui.openCreateIssue({ projectId, status }), [ui, projectId]);

  // Screen-reader narration for keyboard drag and drop.
  const announcements = useMemo<Announcements>(() => {
    const name = (id: string | number) => issuesById.get(String(id))?.identifier ?? 'issue';
    const where = (id: string | number) => {
      const cols = columnsRef.current;
      const s = findContainer(cols, String(id));
      if (!s) return '';
      const pos = cols[s].indexOf(String(id));
      return `${STATUS_LABELS[s]}${pos >= 0 ? `, position ${pos + 1} of ${cols[s].length}` : ''}`;
    };
    return {
      onDragStart: ({ active }) => `Picked up ${name(active.id)} in ${where(active.id)}.`,
      onDragOver: ({ active, over }) => (over ? `${name(active.id)} is over ${where(over.id)}.` : `${name(active.id)} is no longer over a column.`),
      onDragEnd: ({ active, over }) => (over ? `Dropped ${name(active.id)} in ${where(active.id)}.` : `Dropped ${name(active.id)}.`),
      onDragCancel: ({ active }) => `Cancelled. ${name(active.id)} returned to its original position.`,
    };
  }, [issuesById]);

  if (error) return <ErrorFallback error={error} onReset={() => void refetch()} />;

  if (isPending) {
    return (
      <div className="flex gap-4 p-4 sm:p-6" role="status" aria-label="Loading board">
        {ISSUE_STATUSES.map((s) => (
          <div key={s} className="w-72 shrink-0 space-y-2 rounded-xl bg-muted/50 p-2">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 bg-background" />)}
          </div>
        ))}
      </div>
    );
  }

  if (board.issues.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={SquareKanban}
          title="No issues yet"
          description="Create the first issue for this project. Press C anywhere to create one."
          action={!readOnly && <Button onClick={() => ui.openCreateIssue({ projectId })}>Create issue</Button>}
        />
      </div>
    );
  }

  const activeIssue = activeId ? issuesById.get(activeId) : null;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter cards…"
          aria-label="Filter cards by title or id"
          className="h-8 w-48"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter /> Filters{filtersActive && assigneeFilter.length + priorityFilter.length > 0 ? ` (${assigneeFilter.length + priorityFilter.length})` : ''}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Assignee</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={assigneeFilter.includes(me.id)} onCheckedChange={() => setAssigneeFilter((f) => toggle(f, me.id))} onSelect={(e) => e.preventDefault()}>
              Assigned to me
            </DropdownMenuCheckboxItem>
            {members.filter((m) => m.user.id !== me.id).map((m) => (
              <DropdownMenuCheckboxItem key={m.user.id} checked={assigneeFilter.includes(m.user.id)} onCheckedChange={() => setAssigneeFilter((f) => toggle(f, m.user.id))} onSelect={(e) => e.preventDefault()}>
                {m.user.name}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            {(['urgent', 'high', 'medium', 'low', 'none'] as const).map((p) => (
              <DropdownMenuCheckboxItem key={p} checked={priorityFilter.includes(p)} onCheckedChange={() => setPriorityFilter((f) => toggle(f, p))} onSelect={(e) => e.preventDefault()}>
                {PRIORITY_LABELS[p]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => { setText(''); setAssigneeFilter([]); setPriorityFilter([]); }}>
            <X /> Clear
          </Button>
        )}
        <p className="ml-auto hidden text-xs text-muted-foreground lg:block">
          Tip: focus a card, press <kbd className="font-mono">Space</kbd> to pick it up, arrows to move.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={cancelDrag}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: 'To pick up an issue, press Space. Use arrow keys to move it between and within columns. Press Space again to drop, or Escape to cancel. Press Enter to open it.',
          },
        }}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4 sm:px-6">
          {ISSUE_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              ids={columns[status]}
              issuesById={issuesById}
              labels={labels}
              onOpen={openIssue}
              onCreate={createIn}
              readOnly={readOnly}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {activeIssue ? <CardBody issue={activeIssue} labels={labels} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
