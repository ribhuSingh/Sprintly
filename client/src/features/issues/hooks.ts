import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  orderBetween,
  type BulkUpdateIssuesInput,
  type CreateIssueInput,
  type IssueDTO,
  type IssueListQuery,
  type IssueStatus,
  type Paginated,
  type UpdateIssueInput,
} from '@sprintly/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { mutationId } from '@/lib/utils';
import { trackMutation } from '@/lib/socket';
import {
  invalidateIssueAggregates,
  patchIssue,
  removeIssue,
  restoreIssueCaches,
  snapshotIssueCaches,
  upsertIssue,
} from '@/lib/issueCache';

type Board = { issues: IssueDTO[] };

export function useBoard(projectId: string) {
  return useQuery({
    queryKey: qk.board(projectId),
    queryFn: ({ signal }) => api.get<Board>(`/projects/${projectId}/board`, undefined, signal),
  });
}

export function useIssueList(projectId: string, params: IssueListQuery) {
  return useQuery({
    queryKey: qk.issueList(projectId, params),
    queryFn: ({ signal }) =>
      api.get<Paginated<IssueDTO>>(`/projects/${projectId}/issues`, params as Record<string, string>, signal),
    // Keep showing the previous page while the next one loads: no table flash on paging/sorting.
    placeholderData: keepPreviousData,
  });
}

export function useIssue(id: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.issue(id ?? ''),
    enabled: !!id,
    queryFn: ({ signal }) => api.get<{ issue: IssueDTO }>(`/issues/${id}`, undefined, signal),
    // Seed from any board already in cache so the detail sheet opens instantly.
    initialData: () => {
      for (const [, board] of qc.getQueriesData<Board>({ queryKey: ['projects'] })) {
        const hit = board?.issues?.find?.((i) => i.id === id);
        if (hit) return { issue: hit };
      }
      return undefined;
    },
    initialDataUpdatedAt: () => 0, // treat seeded data as stale so it refetches in the background
  });
}

export function useCreateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateIssueInput) =>
      api
        .post<{ issue: IssueDTO }>(`/projects/${projectId}/issues`, { ...body, clientMutationId: trackMutation(mutationId()) })
        .then((r) => r.issue),
    onSuccess: (issue) => {
      upsertIssue(qc, issue);
      invalidateIssueAggregates(qc, projectId);
    },
    meta: { silent: true },
  });
}

interface UpdateVars {
  issue: IssueDTO;
  patch: Omit<UpdateIssueInput, 'clientMutationId'>;
  /** Display-ready values for the optimistic update (e.g. full assignee objects for ids in `patch`). */
  optimistic?: Partial<IssueDTO>;
}

/** Inline edits from the detail view / table. Optimistic, with rollback on failure. */
export function useUpdateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issue, patch }: UpdateVars) =>
      api
        .patch<{ issue: IssueDTO }>(`/issues/${issue.id}`, { ...patch, clientMutationId: trackMutation(mutationId()) })
        .then((r) => r.issue),
    onMutate: async ({ issue, patch, optimistic }) => {
      await qc.cancelQueries({ queryKey: qk.board(issue.project) });
      await qc.cancelQueries({ queryKey: qk.issue(issue.id) });
      const snap = snapshotIssueCaches(qc, issue.project, issue.id);
      const { assignees: _a, dueDate, ...rest } = patch;
      patchIssue(qc, issue.project, issue.id, {
        ...(rest as Partial<IssueDTO>),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate).toISOString() : null } : {}),
        ...optimistic,
        updatedAt: new Date().toISOString(),
      });
      return { snap };
    },
    onError: (_err, { issue }, ctx) => ctx && restoreIssueCaches(qc, issue.project, issue.id, ctx.snap),
    onSuccess: (issue) => upsertIssue(qc, issue),
    onSettled: (_d, _e, { issue }) => invalidateIssueAggregates(qc, issue.project),
  });
}

interface MoveVars {
  issue: IssueDTO;
  status: IssueStatus;
  beforeId: string | null;
  afterId: string | null;
}

/**
 * Kanban move. The optimistic `order` is computed with the same `orderBetween` the server uses,
 * so the card lands exactly where the server will put it and nothing jumps on settle.
 */
export function useMoveIssue(projectId: string) {
  const qc = useQueryClient();
  const mutationKey = ['moveIssue', projectId];
  return useMutation({
    mutationKey,
    mutationFn: ({ issue, status, beforeId, afterId }: MoveVars) =>
      api
        .post<{ issue: IssueDTO }>(`/issues/${issue.id}/move`, {
          status,
          beforeId,
          afterId,
          clientMutationId: trackMutation(mutationId()),
        })
        .then((r) => r.issue),
    onMutate: async ({ issue, status, beforeId, afterId }) => {
      await qc.cancelQueries({ queryKey: qk.board(projectId) });
      const snap = snapshotIssueCaches(qc, projectId, issue.id);
      const issues = qc.getQueryData<Board>(qk.board(projectId))?.issues ?? [];
      const orderOf = (id: string | null) => (id ? issues.find((i) => i.id === id)?.order : null);
      patchIssue(qc, projectId, issue.id, {
        status,
        order: orderBetween(orderOf(beforeId), orderOf(afterId)),
        completedAt: status === 'done' ? (issue.completedAt ?? new Date().toISOString()) : null,
      });
      return { snap };
    },
    onError: (_err, { issue }, ctx) => ctx && restoreIssueCaches(qc, projectId, issue.id, ctx.snap),
    onSuccess: (issue) => upsertIssue(qc, issue),
    onSettled: () => {
      // Only re-sync once the *last* in-flight move settles; refetching between rapid drags
      // would briefly snap cards back to stale server positions.
      if (qc.isMutating({ mutationKey }) === 1) {
        void qc.invalidateQueries({ queryKey: qk.board(projectId) });
        invalidateIssueAggregates(qc, projectId);
      }
    },
  });
}

export function useDeleteIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issue: IssueDTO) =>
      api.delete(`/issues/${issue.id}`, { clientMutationId: trackMutation(mutationId()) }),
    onMutate: async (issue) => {
      await qc.cancelQueries({ queryKey: qk.board(issue.project) });
      const snap = snapshotIssueCaches(qc, issue.project, issue.id);
      removeIssue(qc, issue.project, issue.id);
      return { snap };
    },
    onError: (_e, issue, ctx) => ctx && restoreIssueCaches(qc, issue.project, issue.id, ctx.snap),
    onSettled: (_d, _e, issue) => invalidateIssueAggregates(qc, issue.project),
  });
}

export function useBulkUpdateIssues(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkUpdateIssuesInput) =>
      api.post<{ issues: IssueDTO[] }>('/issues/bulk', body).then((r) => r.issues),
    onMutate: async ({ ids, patch }) => {
      await qc.cancelQueries({ queryKey: qk.projectIssues(projectId) });
      const lists = qc.getQueriesData({ queryKey: qk.projectIssues(projectId) });
      const board = qc.getQueryData(qk.board(projectId));
      for (const id of ids) patchIssue(qc, projectId, id, patch);
      return { lists, board };
    },
    onError: (_e, _v, ctx) => {
      ctx?.lists.forEach(([key, data]) => qc.setQueryData(key, data));
      qc.setQueryData(qk.board(projectId), ctx?.board);
    },
    onSuccess: (issues) => issues.forEach((i) => upsertIssue(qc, i)),
    onSettled: () => invalidateIssueAggregates(qc, projectId),
  });
}
