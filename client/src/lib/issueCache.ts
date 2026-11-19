import type { QueryClient } from '@tanstack/react-query';
import type { IssueDTO, Paginated } from '@sprintly/shared';
import { qk } from './queryKeys';

/**
 * One place that knows every cache an issue lives in. Mutations (optimistic + settled)
 * and socket events all go through these, so the board, table and detail view never disagree.
 */

type Board = { issues: IssueDTO[] };

export function upsertIssue(qc: QueryClient, issue: IssueDTO) {
  qc.setQueryData<Board>(qk.board(issue.project), (board) => {
    if (!board) return board;
    const exists = board.issues.some((i) => i.id === issue.id);
    const issues = exists ? board.issues.map((i) => (i.id === issue.id ? issue : i)) : [...board.issues, issue];
    return { issues: issues.sort((a, b) => a.order - b.order) };
  });
  qc.setQueryData<{ issue: IssueDTO }>(qk.issue(issue.id), (old) => (old ? { issue } : old));
  qc.setQueriesData<Paginated<IssueDTO>>({ queryKey: qk.projectIssues(issue.project) }, (page) =>
    page ? { ...page, items: page.items.map((i) => (i.id === issue.id ? issue : i)) } : page,
  );
}

export function patchIssue(qc: QueryClient, projectId: string, id: string, patch: Partial<IssueDTO>) {
  const apply = (i: IssueDTO) => (i.id === id ? { ...i, ...patch } : i);
  qc.setQueryData<Board>(qk.board(projectId), (board) =>
    board ? { issues: board.issues.map(apply).sort((a, b) => a.order - b.order) } : board,
  );
  qc.setQueryData<{ issue: IssueDTO }>(qk.issue(id), (old) => (old ? { issue: apply(old.issue) } : old));
  qc.setQueriesData<Paginated<IssueDTO>>({ queryKey: qk.projectIssues(projectId) }, (page) =>
    page ? { ...page, items: page.items.map(apply) } : page,
  );
}

export function removeIssue(qc: QueryClient, projectId: string, id: string) {
  qc.setQueryData<Board>(qk.board(projectId), (board) =>
    board ? { issues: board.issues.filter((i) => i.id !== id) } : board,
  );
  qc.removeQueries({ queryKey: qk.issue(id) });
  qc.setQueriesData<Paginated<IssueDTO>>({ queryKey: qk.projectIssues(projectId) }, (page) =>
    page ? { ...page, items: page.items.filter((i) => i.id !== id), total: Math.max(0, page.total - 1) } : page,
  );
}

/** Snapshot everything an optimistic update may touch, for rollback. */
export function snapshotIssueCaches(qc: QueryClient, projectId: string, id: string) {
  return {
    board: qc.getQueryData(qk.board(projectId)),
    issue: qc.getQueryData(qk.issue(id)),
    lists: qc.getQueriesData({ queryKey: qk.projectIssues(projectId) }),
  };
}

export function restoreIssueCaches(
  qc: QueryClient,
  projectId: string,
  id: string,
  snap: ReturnType<typeof snapshotIssueCaches>,
) {
  qc.setQueryData(qk.board(projectId), snap.board);
  qc.setQueryData(qk.issue(id), snap.issue);
  for (const [key, data] of snap.lists) qc.setQueryData(key, data);
}

/** Derived/aggregate views that are cheaper to refetch than to patch. */
export function invalidateIssueAggregates(qc: QueryClient, projectId: string) {
  void qc.invalidateQueries({ queryKey: ['analytics'] });
  void qc.invalidateQueries({ queryKey: ['calendar'] });
  void qc.invalidateQueries({ queryKey: qk.projects, exact: true });
  void qc.invalidateQueries({ queryKey: qk.projectIssues(projectId) });
}
