import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { IssueDTO } from '@sprintly/shared';
import { qk } from '@/lib/queryKeys';
import { useMoveIssue } from './hooks';

const user = { id: 'u1', name: 'Ada', email: 'a@x.dev', avatarColor: '#000' };
const issue = (id: string, status: IssueDTO['status'], order: number): IssueDTO => ({
  id, project: 'p1', number: 1, identifier: `P-${id}`, title: id, description: '', status, priority: 'none', order,
  labels: [], assignees: [], reporter: user, dueDate: null, estimate: null, completedAt: null, commentCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  qc.setQueryData(qk.board('p1'), { issues: [issue('a', 'todo', 1024), issue('b', 'todo', 2048), issue('c', 'done', 1024)] });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

const board = (qc: QueryClient) => qc.getQueryData<{ issues: IssueDTO[] }>(qk.board('p1'))!.issues;

afterEach(() => vi.restoreAllMocks());

describe('useMoveIssue (optimistic Kanban move)', () => {
  it('moves the card immediately, before the server responds', async () => {
    const { qc, wrapper } = setup();
    let resolve!: (r: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((r) => (resolve = r)));

    const { result } = renderHook(() => useMoveIssue('p1'), { wrapper });
    act(() => result.current.mutate({ issue: board(qc).find((i) => i.id === 'c')!, status: 'todo', beforeId: 'a', afterId: 'b' }));

    await waitFor(() => expect(board(qc).find((i) => i.id === 'c')!.status).toBe('todo'));
    // Same fractional ordering as the server: halfway between neighbours.
    expect(board(qc).find((i) => i.id === 'c')!.order).toBe(1536);
    expect(board(qc).filter((i) => i.status === 'todo').map((i) => i.id)).toEqual(['a', 'c', 'b']);

    resolve(new Response(JSON.stringify({ issue: { ...issue('c', 'todo', 1536) } }), { status: 200 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back when the server rejects the move', async () => {
    const { qc, wrapper } = setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Board is out of date', code: 'bad_request' } }), { status: 400 }),
    );

    const { result } = renderHook(() => useMoveIssue('p1'), { wrapper });
    act(() => result.current.mutate({ issue: board(qc).find((i) => i.id === 'c')!, status: 'todo', beforeId: null, afterId: 'a' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    const c = board(qc).find((i) => i.id === 'c')!;
    expect(c.status).toBe('done');
    expect(c.order).toBe(1024);
    expect(result.current.error?.message).toBe('Board is out of date');
  });
});
