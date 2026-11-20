import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { STATUS_LABELS, type IssueDTO, type IssueStatus, type LabelDTO } from '@sprintly/shared';
import { cn } from '@/lib/utils';
import { StatusIcon } from '@/features/issues/IssueBits';
import { KanbanCard } from './KanbanCard';

interface Props {
  status: IssueStatus;
  ids: string[];
  issuesById: Map<string, IssueDTO>;
  labels: Map<string, LabelDTO>;
  onOpen: (id: string) => void;
  onCreate?: (status: IssueStatus) => void;
  readOnly: boolean;
}

export const KanbanColumn = memo(function KanbanColumn({ status, ids, issuesById, labels, onOpen, onCreate, readOnly }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column' } });
  const headingId = `col-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex w-[17.5rem] shrink-0 flex-col rounded-lg bg-sidebar transition-colors',
        isOver && 'bg-accent ring-1 ring-border',
      )}
    >
      <header className="flex h-10 items-center gap-2 px-3">
        <StatusIcon status={status} />
        <h2 id={headingId} className="text-[13px] font-medium">
          {STATUS_LABELS[status]}
        </h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{ids.length}</span>
        {onCreate && !readOnly && (
          <button
            onClick={() => onCreate(status)}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
            aria-label={`New issue in ${STATUS_LABELS[status]}`}
          >
            <Plus className="size-4" />
          </button>
        )}
      </header>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} role="list" className="flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-2">
          {ids.map((id) => {
            const issue = issuesById.get(id);
            return issue ? (
              <div role="listitem" key={id}>
                <KanbanCard issue={issue} labels={labels} onOpen={onOpen} disabled={readOnly} />
              </div>
            ) : null;
          })}
          {ids.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              {readOnly ? 'No issues' : 'Drop issues here'}
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
});
