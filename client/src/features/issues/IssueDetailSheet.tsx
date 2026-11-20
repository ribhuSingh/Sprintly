import { useEffect, useState } from 'react';
import { CalendarClock, Link2, Tag, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { PRIORITY_LABELS, STATUS_LABELS, hasRole, type IssueDTO } from '@sprintly/shared';
import { Dialog, DialogDescription, DialogTitle, SheetContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Avatar, AvatarStack, Skeleton } from '@/components/ui/misc';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useCurrentUser } from '@/features/auth/hooks';
import { useProject, useProjectMembers } from '@/features/projects/hooks';
import { fullDate, timeAgo } from '@/lib/utils';
import { useDeleteIssue, useIssue, useUpdateIssue } from './hooks';
import {
  AssigneePicker,
  DueDate,
  LabelPicker,
  LabelPill,
  PriorityIcon,
  PriorityPicker,
  StatusIcon,
  StatusPicker,
  propertyButton,
} from './IssueBits';
import { IssueComments } from './IssueComments';

export default function IssueDetailSheet({ issueId, projectId, onClose }: { issueId: string; projectId: string; onClose: () => void }) {
  const { data, isPending, error, refetch } = useIssue(issueId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {error ? (
          <>
            <DialogTitle className="sr-only">Issue unavailable</DialogTitle>
            <ErrorFallback error={error} onReset={() => void refetch()} />
          </>
        ) : isPending || !data ? (
          <div className="space-y-4 p-6" role="status" aria-label="Loading issue">
            <DialogTitle className="sr-only">Loading issue</DialogTitle>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <IssueDetail issue={data.issue} projectId={projectId} onClose={onClose} />
        )}
      </SheetContent>
    </Dialog>
  );
}

function IssueDetail({ issue, projectId, onClose }: { issue: IssueDTO; projectId: string; onClose: () => void }) {
  const me = useCurrentUser();
  const { data: projectData } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const update = useUpdateIssue();
  const del = useDeleteIssue();
  const canEdit = !!projectData && hasRole(projectData.myRole, 'member');
  const canDelete = !!projectData && (hasRole(projectData.myRole, 'admin') || (canEdit && issue.reporter.id === me.id));
  const labels = projectData?.project.labels ?? [];
  const memberUsers = members.map((m) => m.user);

  // Local drafts for text fields; saved on blur. Re-sync when the server value changes
  // (e.g. another user edited it), unless the user is mid-edit.
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  const [editing, setEditing] = useState<'title' | 'description' | null>(null);
  useEffect(() => { if (editing !== 'title') setTitle(issue.title); }, [issue.title, editing]);
  useEffect(() => { if (editing !== 'description') setDescription(issue.description); }, [issue.description, editing]);

  const save = (patch: Parameters<typeof update.mutate>[0]['patch'], optimistic?: Partial<IssueDTO>) =>
    update.mutate({ issue, patch, optimistic });

  const saveTitle = () => {
    setEditing(null);
    const t = title.trim();
    if (!t) return setTitle(issue.title);
    if (t !== issue.title) save({ title: t });
  };
  const saveDescription = () => {
    setEditing(null);
    if (description !== issue.description) save({ description });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${location.origin}/projects/${projectId}/board?issue=${issue.id}`);
    toast.success('Link copied');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-6 py-3 pr-12 text-sm text-muted-foreground">
        <span className="font-mono text-xs font-medium">{issue.identifier}</span>
        <span>· Created {timeAgo(issue.createdAt)} by {issue.reporter.name}</span>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="icon" onClick={copyLink} aria-label="Copy link">
            <Link2 />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete issue"
              onClick={() => {
                if (!confirm(`Delete ${issue.identifier}? This cannot be undone.`)) return;
                del.mutate(issue, { onSuccess: () => toast.success(`Deleted ${issue.identifier}`) });
                onClose();
              }}
            >
              <Trash2 className="text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6 p-6">
          <DialogTitle className="sr-only">{`${issue.identifier}: ${issue.title}`}</DialogTitle>
          <div>
              <label htmlFor="issue-title" className="sr-only">Title</label>
              <Input
                id="issue-title"
                value={title}
                readOnly={!canEdit}
                onFocus={() => setEditing('title')}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setTitle(issue.title); setEditing(null); }
                }}
                className="h-auto border-transparent px-1 py-1 text-xl font-semibold shadow-none hover:border-border"
              />
          </div>
          <DialogDescription className="sr-only">Issue details, comments and history</DialogDescription>
          <div>
            <label htmlFor="issue-desc" className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              id="issue-desc"
              value={description}
              readOnly={!canEdit}
              placeholder={canEdit ? 'Add a description…' : 'No description'}
              onFocus={() => setEditing('description')}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              rows={6}
              className="border-transparent px-1 shadow-none hover:border-border"
            />
          </div>
          <IssueComments issue={issue} canComment={canEdit} />
        </div>

        <aside className="shrink-0 space-y-1 border-t p-4 lg:w-64 lg:border-l lg:border-t-0" aria-label="Issue properties">
          <Property label="Status">
            <StatusPicker value={issue.status} onChange={(status) => save({ status })}>
              <button className={propertyButton} disabled={!canEdit}>
                <StatusIcon status={issue.status} /> {STATUS_LABELS[issue.status]}
              </button>
            </StatusPicker>
          </Property>
          <Property label="Priority">
            <PriorityPicker value={issue.priority} onChange={(priority) => save({ priority })}>
              <button className={propertyButton} disabled={!canEdit}>
                <PriorityIcon priority={issue.priority} /> {PRIORITY_LABELS[issue.priority]}
              </button>
            </PriorityPicker>
          </Property>
          <Property label="Assignees">
            <AssigneePicker
              value={issue.assignees.map((a) => a.id)}
              members={memberUsers}
              onChange={(ids) => save({ assignees: ids }, { assignees: memberUsers.filter((m) => ids.includes(m.id)) })}
            >
              <button className={propertyButton} disabled={!canEdit}>
                {issue.assignees.length ? (
                  <>
                    <AvatarStack users={issue.assignees} size="xs" />
                    <span className="truncate">{issue.assignees.length === 1 ? issue.assignees[0]!.name : `${issue.assignees.length} people`}</span>
                  </>
                ) : (
                  <>
                    <UserRound className="size-4 text-muted-foreground" /> <span className="text-muted-foreground">Unassigned</span>
                  </>
                )}
              </button>
            </AssigneePicker>
          </Property>
          <Property label="Labels">
            <LabelPicker value={issue.labels} labels={labels} onChange={(ids) => save({ labels: ids })}>
              <button className={`${propertyButton} h-auto min-h-8 flex-wrap py-1`} disabled={!canEdit}>
                {issue.labels.length ? (
                  issue.labels.map((id) => {
                    const l = labels.find((x) => x.id === id);
                    return l ? <LabelPill key={id} label={l} /> : null;
                  })
                ) : (
                  <>
                    <Tag className="size-4 text-muted-foreground" /> <span className="text-muted-foreground">No labels</span>
                  </>
                )}
              </button>
            </LabelPicker>
          </Property>
          <Property label="Due date">
            <div className="flex items-center gap-2 px-2">
              {canEdit ? (
                <>
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                  <input
                    type="date"
                    aria-label="Due date"
                    value={issue.dueDate ? issue.dueDate.slice(0, 10) : ''}
                    onChange={(e) => save({ dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })}
                    className="h-8 rounded-md bg-transparent text-sm outline-none focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </>
              ) : issue.dueDate ? (
                <DueDate iso={issue.dueDate} done={issue.status === 'done'} />
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </div>
            {canEdit && issue.dueDate && <p className="px-2 pt-1"><DueDate iso={issue.dueDate} done={issue.status === 'done'} /></p>}
          </Property>
          <Property label="Estimate">
            <select
              aria-label="Estimate (points)"
              disabled={!canEdit}
              value={issue.estimate ?? ''}
              onChange={(e) => save({ estimate: e.target.value === '' ? null : Number(e.target.value) })}
              className="h-8 rounded-md bg-transparent px-2 text-sm hover:bg-accent/50 cursor-pointer"
            >
              <option value="">No estimate</option>
              {[1, 2, 3, 5, 8, 13].map((n) => (
                <option key={n} value={n}>{n} point{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </Property>
          <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              Reporter <Avatar user={issue.reporter} size="xs" /> {issue.reporter.name}
            </p>
            <p>Updated {timeAgo(issue.updatedAt)}</p>
            {issue.completedAt && <p>Completed {fullDate(issue.completedAt)}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 py-1">
      <span className="px-2 text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
