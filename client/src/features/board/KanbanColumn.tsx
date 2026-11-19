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
        'flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 transition-colors',
        isOver && 'bg-primary/5 ring-1 ring-primary/30',
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <StatusIcon status={status} />
        <h2 id={headingId} className="text-sm font-medium">
          {STATUS_LABELS[status]}
        </h2>
        <span className="text-xs text-muted-foreground">{ids.length}</span>
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
        <div ref={setNodeRef} role="list" className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
          {ids.map((id) => {
            const issue = issuesById.get(id);
            return issue ? (
              <div role="listitem" key={id}>
                <KanbanCard issue={issue} labels={labels} onOpen={onOpen} disabled={readOnly} />
              </div>
            ) : null;
          })}
          {ids.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {readOnly ? 'No issues' : 'Drop issues here'}
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
});
