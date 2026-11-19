import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { createCommentSchema, STATUS_LABELS, type ActivityDTO, type CommentDTO, type IssueDTO, type IssueStatus } from '@sprintly/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { cn, mutationId, timeAgo } from '@/lib/utils';
import { trackMutation } from '@/lib/socket';
import { patchIssue } from '@/lib/issueCache';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { useCurrentUser } from '@/features/auth/hooks';
import { z } from 'zod';

type Comments = { comments: CommentDTO[] };
const form = createCommentSchema.pick({ body: true });

/** Comments merged with the issue's history into one chronological timeline. */
export function IssueComments({ issue, canComment }: { issue: IssueDTO; canComment: boolean }) {
  const qc = useQueryClient();
  const me = useCurrentUser();
  const [tab, setTab] = useState<'all' | 'comments'>('all');

  const comments = useQuery({
    queryKey: qk.comments(issue.id),
    queryFn: ({ signal }) => api.get<Comments>(`/issues/${issue.id}/comments`, undefined, signal),
  });
  const history = useQuery({
    queryKey: qk.issueActivity(issue.id),
    queryFn: ({ signal }) => api.get<{ activity: ActivityDTO[] }>(`/issues/${issue.id}/activity`, undefined, signal),
  });

  const addComment = useMutation({
    mutationFn: (body: string) =>
      api.post<{ comment: CommentDTO }>(`/issues/${issue.id}/comments`, { body, clientMutationId: trackMutation(mutationId()) }),
    // Optimistic: show the comment immediately with a "sending" state.
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: qk.comments(issue.id) });
      const prev = qc.getQueryData<Comments>(qk.comments(issue.id));
      const temp: CommentDTO = { id: `temp-${Date.now()}`, issue: issue.id, author: me, body, createdAt: new Date().toISOString(), pending: true };
      qc.setQueryData<Comments>(qk.comments(issue.id), (old) => ({ comments: [...(old?.comments ?? []), temp] }));
      patchIssue(qc, issue.project, issue.id, { commentCount: issue.commentCount + 1 });
      return { prev, tempId: temp.id };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(qk.comments(issue.id), ctx?.prev);
      patchIssue(qc, issue.project, issue.id, { commentCount: issue.commentCount });
    },
    onSuccess: ({ comment }, _v, ctx) =>
      qc.setQueryData<Comments>(qk.comments(issue.id), (old) => ({
        comments: (old?.comments ?? []).map((c) => (c.id === ctx?.tempId ? comment : c)),
      })),
  });

  const f = useForm<z.infer<typeof form>>({ resolver: zodResolver(form), defaultValues: { body: '' } });
  const submit = f.handleSubmit(({ body }) => {
    addComment.mutate(body);
    f.reset();
  });

  type Entry = { kind: 'comment'; at: string; c: CommentDTO } | { kind: 'activity'; at: string; a: ActivityDTO };
  const entries: Entry[] = [
    ...(comments.data?.comments ?? []).map((c) => ({ kind: 'comment' as const, at: c.createdAt, c })),
    ...(tab === 'all' ? (history.data?.activity ?? []).filter((a) => a.verb !== 'comment.created').map((a) => ({ kind: 'activity' as const, at: a.createdAt, a })) : []),
  ].sort((x, y) => x.at.localeCompare(y.at));

  return (
    <section aria-labelledby="activity-heading" className="space-y-4">
      <div className="flex items-center gap-3 border-b pb-2">
        <h2 id="activity-heading" className="text-sm font-semibold">Activity</h2>
        <div role="tablist" aria-label="Timeline filter" className="ml-auto flex gap-1 text-xs">
          {(['all', 'comments'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('rounded px-2 py-1 capitalize cursor-pointer', tab === t ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {comments.isPending ? (
        <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : entries.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><MessageSquare className="size-4" /> No comments yet.</p>
      ) : (
        <ol className="space-y-4">
          {entries.map((e) =>
            e.kind === 'comment' ? (
              <li key={e.c.id} className={cn('flex gap-3', e.c.pending && 'opacity-60')}>
                <Avatar user={e.c.author} size="md" />
                <div className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{e.c.author.name}</span> · {e.c.pending ? 'Sending…' : timeAgo(e.c.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{e.c.body}</p>
                </div>
              </li>
            ) : (
              <li key={e.a.id} className="flex items-center gap-3 pl-1.5 text-xs text-muted-foreground">
                <Avatar user={e.a.actor} size="xs" />
                <span>
                  <span className="font-medium text-foreground">{e.a.actor.name}</span> {describe(e.a)} · {timeAgo(e.a.createdAt)}
                </span>
              </li>
            ),
          )}
        </ol>
      )}

      {canComment && (
        <form onSubmit={submit} className="space-y-2" noValidate>
          <label htmlFor="new-comment" className="sr-only">Add a comment</label>
          <Textarea
            id="new-comment"
            placeholder="Leave a comment… (Ctrl/⌘ + Enter to send)"
            rows={3}
            aria-invalid={!!f.formState.errors.body}
            {...f.register('body')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!f.watch('body')?.trim()}>
              Comment
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function describe(a: ActivityDTO) {
  switch (a.verb) {
    case 'issue.created':
      return 'created the issue';
    case 'issue.deleted':
      return 'deleted the issue';
    case 'comment.created':
      return 'commented';
    case 'project.created':
      return 'created the project';
    case 'member.added':
      return 'added a member';
    default: {
      const parts = a.changes.map((c) => {
        if (c.field === 'status')
          return (
            <span key="s" className="inline-flex items-center gap-1">
              moved from {STATUS_LABELS[c.from as IssueStatus] ?? '—'} <ArrowRight className="inline size-3" /> {STATUS_LABELS[c.to as IssueStatus] ?? '—'}
            </span>
          );
        if (c.field === 'priority') return <span key="p">set priority to {String(c.to)}</span>;
        if (c.field === 'assignees') return <span key="a">changed assignees</span>;
        if (c.field === 'dueDate') return <span key="d">{c.to ? 'changed the due date' : 'removed the due date'}</span>;
        return <span key={c.field}>updated {c.field}</span>;
      });
      return parts.length ? <>{parts.reduce<React.ReactNode[]>((acc, p, i) => (i ? [...acc, ', ', p] : [p]), [])}</> : 'reordered the issue';
    }
  }
}
