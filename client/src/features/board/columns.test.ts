import { describe, expect, it } from 'vitest';
import { findContainer, moveAcross, moveWithin, neighbours, type Columns } from './columns';

const cols = (): Columns => ({ backlog: [], todo: ['a', 'b', 'c'], in_progress: ['d'], in_review: [], done: [] });

describe('board column helpers', () => {
  it('finds the column for a card or a column id', () => {
    expect(findContainer(cols(), 'b')).toBe('todo');
    expect(findContainer(cols(), 'done')).toBe('done');
    expect(findContainer(cols(), 'zzz')).toBeNull();
  });

  it('moves a card across columns above or below the hovered card', () => {
    expect(moveAcross(cols(), 'd', 'b', false).todo).toEqual(['a', 'd', 'b', 'c']);
    expect(moveAcross(cols(), 'd', 'b', true).todo).toEqual(['a', 'b', 'd', 'c']);
    expect(moveAcross(cols(), 'd', 'b', true).in_progress).toEqual([]);
  });

  it('appends when dropped on an empty column', () => {
    expect(moveAcross(cols(), 'a', 'done', false).done).toEqual(['a']);
  });

  it('reorders within a column', () => {
    expect(moveWithin(cols(), 'a', 'c').todo).toEqual(['b', 'c', 'a']);
  });

  it('reports neighbours for the server move request', () => {
    expect(neighbours(['a', 'b', 'c'], 'b')).toEqual({ beforeId: 'a', afterId: 'c' });
    expect(neighbours(['a'], 'a')).toEqual({ beforeId: null, afterId: null });
  });
});
