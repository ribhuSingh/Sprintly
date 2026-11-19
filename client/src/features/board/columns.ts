import { arrayMove } from '@dnd-kit/sortable';
import { ISSUE_STATUSES, type IssueDTO, type IssueStatus } from '@sprintly/shared';

/** Board drag state: ordered card ids per column. Pure helpers, unit-tested in columns.test.ts. */
export type Columns = Record<IssueStatus, string[]>;

export function groupByStatus(issues: IssueDTO[]): Columns {
  const cols = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, [] as string[]])) as Columns;
  for (const i of [...issues].sort((a, b) => a.order - b.order)) cols[i.status].push(i.id);
  return cols;
}

export const isColumnId = (id: string): id is IssueStatus => (ISSUE_STATUSES as readonly string[]).includes(id);

export function findContainer(cols: Columns, id: string): IssueStatus | null {
  if (isColumnId(id)) return id;
  return ISSUE_STATUSES.find((s) => cols[s].includes(id)) ?? null;
}

/** Move `activeId` into another column, inserted at `overId`'s position (or the end if dropped on the column). */
export function moveAcross(cols: Columns, activeId: string, overId: string, placeBelow: boolean): Columns {
  const from = findContainer(cols, activeId);
  const to = findContainer(cols, overId);
  if (!from || !to || from === to) return cols;
  const target = cols[to];
  const overIndex = target.indexOf(overId);
  const index = isColumnId(overId) || overIndex < 0 ? target.length : overIndex + (placeBelow ? 1 : 0);
  return {
    ...cols,
    [from]: cols[from].filter((id) => id !== activeId),
    [to]: [...target.slice(0, index), activeId, ...target.slice(index)],
  };
}

/** Reorder within a single column. */
export function moveWithin(cols: Columns, activeId: string, overId: string): Columns {
  const c = findContainer(cols, activeId);
  if (!c || isColumnId(overId)) return cols;
  const from = cols[c].indexOf(activeId);
  const to = cols[c].indexOf(overId);
  if (from < 0 || to < 0 || from === to) return cols;
  return { ...cols, [c]: arrayMove(cols[c], from, to) };
}

export function neighbours(list: string[], id: string) {
  const i = list.indexOf(id);
  return { beforeId: list[i - 1] ?? null, afterId: list[i + 1] ?? null };
}
