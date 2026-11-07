// World units. Smaller near distances let books get closer before disappearing.
export const BOOK_SPACING = 3.6;
export const BOOK_THICKNESS = 0.7;
export const BOOK_NEAR_DISTANCE = 6;
export const DETAIL_PRELOAD_COUNT = 2;
export const PAGE_PRELOAD_REMAINING = 12;
export const VISIBLE_BOOK_COUNT = 22;
export const REPEAT_PREVIEW_REMAINING = 10;
export const PASSED_BOOK_CACHE_COUNT = 3;
export const BOOK_DROP_DURATION = 0.22;

// A reversible transition that also finishes after walking stops.
export function advanceBookDrop(progress: number, passed: boolean, delta: number, reducedMotion = false) {
  if (reducedMotion) return passed ? 1 : 0;
  const step = Math.max(0, delta) / BOOK_DROP_DURATION;
  return passed ? Math.min(1, progress + step) : Math.max(0, progress - step);
}
export const WALK_SPEED = 5;

export function currentBookIndex(position: number) {
  return Math.ceil((position - 0.00001) / BOOK_SPACING);
}
// Occurrences have their own signed index; the saved vocabulary ID stays intact.
export function deckIndex(index: number, count: number) {
  return count ? ((index % count) + count) % count : 0;
}
export function isMovementTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, button, a, summary, [contenteditable="true"], [role="dialog"]'));
}

// Each stone reaches its closest, fully visible viewing point at this position.
export function adjacentStone(position: number, direction: number) {
  const index = direction > 0 ? Math.floor((position + .00001) / BOOK_SPACING) + 1
    : Math.ceil((position - .00001) / BOOK_SPACING) - 1;
  return index * BOOK_SPACING;
}
