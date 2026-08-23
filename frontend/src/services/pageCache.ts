/**
 * Tiny in-memory page data cache.
 *
 * Pattern: stale-while-revalidate.
 *   1. On page mount → if cache has data, render it immediately (no spinner).
 *   2. Kick off a background fetch → update state + cache when done.
 *   3. Show the full-screen spinner ONLY on the very first ever load (cold cache).
 *
 * Cache is module-level (lives for the SPA session).
 * Keys are arbitrary strings (e.g. 'dashboard', 'orders', 'menu-today').
 */

const store: Record<string, unknown> = {};

export const pageCache = {
  /** Return cached value (or undefined if not yet cached). */
  get<T>(key: string): T | undefined {
    return store[key] as T | undefined;
  },

  /** Store a value under key. */
  set<T>(key: string, value: T): void {
    store[key] = value;
  },

  /** Check if a key exists in cache. */
  has(key: string): boolean {
    return key in store;
  },

  /** Remove a key (e.g. after logout). */
  clear(key?: string): void {
    if (key) {
      delete store[key];
    } else {
      Object.keys(store).forEach((k) => delete store[k]);
    }
  },
};
