/**
 * Fractional ordering for Kanban cards. Moving a card only rewrites that one card's
 * `order`, instead of renumbering the whole column. Used by both the server (authoritative)
 * and the client (optimistic update), so both compute the same value.
 */
export const ORDER_STEP = 1024;

export function orderBetween(before: number | null | undefined, after: number | null | undefined) {
  const hasBefore = typeof before === 'number';
  const hasAfter = typeof after === 'number';
  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + ORDER_STEP;
  if (hasAfter) return after - ORDER_STEP;
  return ORDER_STEP;
}

/** When two neighbours get too close we rebalance the column (precision safety). */
export const needsRebalance = (before: number | null | undefined, after: number | null | undefined) =>
  typeof before === 'number' && typeof after === 'number' && Math.abs(after - before) < 1e-6;
