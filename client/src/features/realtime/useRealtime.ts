import { useEffect, useState } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ActivityDTO, CommentDTO, CursorPage, NotificationDTO, UserDTO } from '@sprintly/shared';
import { getSocket, isOwnMutation } from '@/lib/socket';
import { qk } from '@/lib/queryKeys';
import { invalidateIssueAggregates, patchIssue, removeIssue, upsertIssue } from '@/lib/issueCache';

/**
 * Bridges Socket.IO events into the TanStack Query cache. Events we caused ourselves
 * (matched by clientMutationId) are skipped: our optimistic update already applied them.
 */
export function useRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onIssue = ({ issue, clientMutationId }: { issue: Parameters<typeof upsertIssue>[1]; clientMutationId?: string }) => {
      if (isOwnMutation(clientMutationId)) return;
      upsertIssue(qc, issue);
      invalidateIssueAggregates(qc, issue.project);
    };

    const onDeleted = ({ id, project, clientMutationId }: { id: string; project: string; clientMutationId?: string }) => {
      if (isOwnMutation(clientMutationId)) return;
      removeIssue(qc, project, id);
      invalidateIssueAggregates(qc, project);
    };

    const onComment = ({ comment, clientMutationId }: { comment: CommentDTO; clientMutationId?: string }) => {
      if (isOwnMutation(clientMutationId)) return;
      qc.setQueryData<{ comments: CommentDTO[] }>(qk.comments(comment.issue), (old) =>
        old && !old.comments.some((c) => c.id === comment.id) ? { comments: [...old.comments, comment] } : old,
      );
      const issue = qc.getQueryData<{ issue: { project: string; commentCount: number } }>(qk.issue(comment.issue))?.issue;
      if (issue) patchIssue(qc, issue.project, comment.issue, { commentCount: issue.commentCount + 1 });
      else void qc.invalidateQueries({ queryKey: ['projects'], predicate: (q) => q.queryKey[2] === 'board' });
    };

    const onActivity = ({ activity }: { activity: ActivityDTO }) => {
      const prepend = (old: InfiniteData<CursorPage<ActivityDTO>> | undefined) => {
        if (!old || old.pages[0]?.items.some((a) => a.id === activity.id)) return old;
        const [first, ...rest] = old.pages;
        return { ...old, pages: [{ ...first!, items: [activity, ...first!.items] }, ...rest] };
      };
      qc.setQueryData(qk.activity(), prepend);
      if (activity.project) qc.setQueryData(qk.activity(activity.project.id), prepend);
      if (activity.issue) void qc.invalidateQueries({ queryKey: qk.issueActivity(activity.issue.id) });
    };

    const onNotification = ({ notification }: { notification: NotificationDTO }) => {
      qc.setQueryData<{ notifications: NotificationDTO[]; unread: number }>(qk.notifications, (old) =>
        old ? { notifications: [notification, ...old.notifications], unread: old.unread + 1 } : old,
      );
      toast(`${notification.actor.name} ${notification.message}`);
    };

    // After a reconnect we may have missed events: refetch whatever is on screen.
    const onReconnect = () => void qc.invalidateQueries();

    socket.on('issue:created', onIssue);
    socket.on('issue:updated', onIssue);
    socket.on('issue:deleted', onDeleted);
    socket.on('comment:created', onComment);
    socket.on('activity:new', onActivity);
    socket.on('notification:new', onNotification);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('issue:created', onIssue);
      socket.off('issue:updated', onIssue);
      socket.off('issue:deleted', onDeleted);
      socket.off('comment:created', onComment);
      socket.off('activity:new', onActivity);
      socket.off('notification:new', onNotification);
      socket.io.off('reconnect', onReconnect);
    };
  }, [qc]);
}

/** Joins the project's room while mounted and returns who else is viewing it. */
export function useProjectRoom(projectId: string) {
  const [viewers, setViewers] = useState<UserDTO[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const join = () => socket.emit('project:join', projectId);
    const onPresence = (p: { projectId: string; users: UserDTO[] }) => {
      if (p.projectId === projectId) setViewers(p.users);
    };
    join();
    socket.on('connect', join); // re-join after reconnects
    socket.on('presence:update', onPresence);
    return () => {
      socket.emit('project:leave', projectId);
      socket.off('connect', join);
      socket.off('presence:update', onPresence);
      setViewers([]);
    };
  }, [projectId]);

  return viewers;
}

export function useSocketStatus() {
  const [connected, setConnected] = useState(() => getSocket().connected);
  useEffect(() => {
    const s = getSocket();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on('connect', on);
    s.on('disconnect', off);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);
  return connected;
}
