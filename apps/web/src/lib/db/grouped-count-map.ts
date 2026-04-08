/**
 * Build a map from grouped SQL count rows (e.g. `select({ id: col, cnt: count() }).groupBy(col)`).
 */
export function countMap<K extends string>(
  rows: ReadonlyArray<Record<K, string> & { cnt: unknown }>,
  key: K
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r[key], Number(r.cnt));
  }
  return m;
}
