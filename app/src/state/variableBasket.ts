/** Helpers for the Phase E variable basket (URL `variableIds`). */

export function addToBasket(current: string[] | undefined, id: string): string[] {
  const set = new Set(current ?? []);
  set.add(id);
  return [...set].slice(0, 64);
}
