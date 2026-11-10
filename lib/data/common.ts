import { cache } from 'react';

import { formatTimeForId } from '@/lib/dayjs';

/**
 * Wraps a data-layer getter in React `cache()` (per-request dedup) plus the
 * uniform "log and fall back" guard every getter repeats. The producer holds
 * the fetch + parse for that resource; on any throw we log and return
 * `fallback` so a single bad file never takes down a page render.
 *
 * @param label - Human label for the error log
 * @param produce - Fetch + parse the resource (may take args, e.g. a slug)
 * @param fallback - Value returned when `produce` throws
 */
export const cachedResource = <Args extends unknown[], T>(
  label: string,
  produce: (...args: Args) => Promise<T>,
  fallback: T,
) =>
  cache(async (...args: Args): Promise<T> => {
    try {
      return await produce(...args);
    } catch (error) {
      console.error(`Failed to load ${label}:`, error);
      return fallback;
    }
  });

/**
 * Generates a unique ID
 *
 * @example
 *   generateId('memo'); // => 'memo_20231211120000_a1b2c3'
 *   generateId(); // => '20231211120000_a1b2c3'
 *
 * @param prefix - Optional ID prefix
 * @returns Unique identifier in format `[prefix_]YYYYMMDDHHmmss_xxxxxx`
 */
export const generateId = (prefix?: string): string => {
  const base = formatTimeForId();
  /** 6-character short hash containing [0-9a-z] */
  const rand = Math.random().toString(36).slice(2, 8);
  const id = `${base}_${rand}`;
  return prefix ? `${prefix}_${id}` : id;
};
