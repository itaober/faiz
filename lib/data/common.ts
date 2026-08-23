import { cache } from 'react';

import {
  fetchGitHubDir as fetchGitHubDirFromApi,
  fetchGitHubJson as fetchGitHubJsonFromApi,
  fetchGitHubText as fetchGitHubTextFromApi,
} from './github';

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
 * Build-time content source: CI checks out the content branch and points
 * CONTENT_DIR at it, so the whole build reads one consistent commit from disk —
 * no network, no token, no API rate limits. Unset (dev), reads go to the
 * GitHub Contents API as before.
 */
const CONTENT_DIR = process.env.CONTENT_DIR;

/** Resolve a repo-relative content path inside CONTENT_DIR, rejecting escapes. */
const resolveContentPath = async (relativePath: string) => {
  const path = await import('node:path');
  const base = path.resolve(CONTENT_DIR as string);
  const target = path.resolve(base, relativePath);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error(`Content path escapes CONTENT_DIR: ${relativePath}`);
  }
  return target;
};

const readContentFile = async (relativePath: string) => {
  const { readFile } = await import('node:fs/promises');
  return readFile(await resolveContentPath(relativePath), 'utf8');
};

const listContentDir = async (relativeDir: string) => {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(await resolveContentPath(relativeDir), { withFileTypes: true });
  // Match the Contents API shape: repo-relative paths, files only.
  return entries.filter(entry => entry.isFile()).map(entry => `${relativeDir}/${entry.name}`);
};

/** API reads default to a 5-minute ISR window unless the caller opts out. */
const withRevalidate = (init?: RequestInit) =>
  init?.cache === 'no-store' ? init : { ...init, next: { revalidate: 5 * 60, ...init?.next } };

/**
 * Fetches raw text content from a content file
 *
 * @param path - File path within the content branch
 * @param init - Optional fetch configuration (API mode only)
 * @param token - Optional GitHub token (API mode only)
 */
export const fetchGitHubText = async (path: string, init?: RequestInit, token?: string) =>
  CONTENT_DIR ? readContentFile(path) : fetchGitHubTextFromApi(path, withRevalidate(init), token);

/**
 * Fetches JSON content from a content file
 *
 * @template T - Type of the JSON data
 */
export const fetchGitHubJson = async <T = object>(
  path: string,
  init?: RequestInit,
  token?: string,
) =>
  CONTENT_DIR
    ? (JSON.parse(await readContentFile(path)) as T)
    : fetchGitHubJsonFromApi<T>(path, withRevalidate(init), token);

/**
 * Fetches list of files in a content directory
 *
 * @returns Array of repo-relative file paths in the directory
 */
export const fetchGitHubDir = async (dir: string, init?: RequestInit, token?: string) =>
  CONTENT_DIR ? listContentDir(dir) : fetchGitHubDirFromApi(dir, withRevalidate(init), token);
