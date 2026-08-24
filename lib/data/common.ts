import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

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
 * no network, no token, no API rate limits. Unset, reads go to the GitHub
 * Contents API, which is what `next dev` uses.
 */
const CONTENT_DIR = process.env.CONTENT_DIR;

/** Content paths carry editor-written slugs, so keep them inside CONTENT_DIR. */
const resolveContentPath = (relativePath: string) => {
  const base = path.resolve(CONTENT_DIR as string);
  const target = path.resolve(base, relativePath);
  if (!target.startsWith(base + path.sep)) {
    throw new Error(`Content path escapes CONTENT_DIR: ${relativePath}`);
  }
  return target;
};

const readContentFile = (relativePath: string) =>
  readFile(resolveContentPath(relativePath), 'utf8');

const listContentDir = async (relativeDir: string) => {
  const entries = await readdir(resolveContentPath(relativeDir), { withFileTypes: true });
  // Match the Contents API shape: repo-relative paths, files only.
  return entries.filter(entry => entry.isFile()).map(entry => `${relativeDir}/${entry.name}`);
};

/** API reads default to a 5-minute ISR window unless the caller opts out. */
const withRevalidate = (init?: RequestInit) =>
  init?.cache === 'no-store' ? init : { ...init, next: { revalidate: 5 * 60, ...init?.next } };

/** Reads raw text for a path within the content branch. */
export const fetchGitHubText = async (pathname: string, init?: RequestInit) =>
  CONTENT_DIR ? readContentFile(pathname) : fetchGitHubTextFromApi(pathname, withRevalidate(init));

/** Reads and parses JSON for a path within the content branch. */
export const fetchGitHubJson = async <T = object>(pathname: string, init?: RequestInit) =>
  CONTENT_DIR
    ? (JSON.parse(await readContentFile(pathname)) as T)
    : fetchGitHubJsonFromApi<T>(pathname, withRevalidate(init));

/** Lists repo-relative file paths in a content-branch directory. */
export const fetchGitHubDir = async (dir: string, init?: RequestInit) =>
  CONTENT_DIR ? listContentDir(dir) : fetchGitHubDirFromApi(dir, withRevalidate(init));
