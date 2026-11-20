import { memo, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare } from 'lucide-react';
import type { IssueDTO, LabelDTO } from '@sprintly/shared';
import { AvatarStack } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { DueDate, LabelPill, PriorityIcon } from '@/features/issues/IssueBits';

interface CardProps {
  issue: IssueDTO;
  labels: Map<string, LabelDTO>;
  onOpen?: (id: string) => void;
  overlay?: boolean;
}

/** Pure presentational card, also rendered inside the DragOverlay. */
export const CardBody = memo(function CardBody({ issue, labels, overlay }: Omit<CardProps, 'onOpen'>) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-md border bg-card px-3 py-2.5 text-[13px] transition-colors hover:border-input',
        overlay && 'rotate-1 cursor-grabbing border-input shadow-lg',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <PriorityIcon priority={issue.priority} className="size-3.5" />
        <span className="font-mono text-[11px]">{issue.identifier}</span>
        <span className="ml-auto">
          <AvatarStack users={issue.assignees} size="xs" max={2} />
        </span>
      </div>
      <p className="line-clamp-3 font-medium leading-snug">{issue.title}</p>
      {(issue.labels.length > 0 || issue.dueDate || issue.commentCount > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {issue.labels.map((id) => {
            const l = labels.get(id);
            return l ? <LabelPill key={id} label={l} /> : null;
          })}
          <DueDate iso={issue.dueDate} done={issue.status === 'done'} />
          {issue.commentCount > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground" aria-label={`${issue.commentCount} comments`}>
              <MessageSquare className="size-3.5" aria-hidden /> {issue.commentCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export const KanbanCard = memo(function KanbanCard({ issue, labels, onOpen, disabled }: CardProps & { disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { type: 'card', status: issue.status },
    disabled,
  });

  // Enter opens the card; Space is reserved for keyboard drag (see board sensors).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !isDragging) {
      e.preventDefault();
      onOpen?.(issue.id);
      return;
    }
    listeners?.onKeyDown?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => onOpen?.(issue.id)}
      aria-roledescription="Draggable issue card"
      aria-label={`${issue.identifier}: ${issue.title}`}
      className={cn(
        'touch-manipulation rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled ? 'cursor-pointer' : 'cursor-grab',
        isDragging && 'opacity-40',
      )}
    >
      <CardBody issue={issue} labels={labels} />
    </div>
  );
});
