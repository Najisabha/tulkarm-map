/** Count root nodes + immediate children in a place-category tree response. */
export function countCategoryTreeNodes(roots: unknown[]): number {
  let n = 0;
  for (const root of roots) {
    n += 1;
    const ch = (root as { children?: unknown[] }).children;
    if (Array.isArray(ch)) n += ch.length;
  }
  return n;
}
