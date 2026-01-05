import dayjs from 'dayjs';
import matter from 'gray-matter';
import { cache } from 'react';
import z from 'zod';

import { fetchGitHubDir, fetchGitHubText } from './common';

export const MDXSchema = z.object({
  content: z.string(),
  data: z.object({
    slug: z.string(),
    title: z.string(),
    createdTime: z.string(),
    updatedTime: z.string(),
    tags: z.array(z.string()).default([]),
    pinned: z.boolean().optional(),
  }),
});

type MDXPost = z.infer<typeof MDXSchema>;

export type MDXData = z.infer<typeof MDXSchema>['data'];

// ================================
// Helpers
// ================================
export const parseMDX = (raw: string | null) => (raw ? MDXSchema.parse(matter(raw)) : null);

// ================================
// GitHub MDX Fetchers
// ================================
export const getAboutMDX = cache(async () => {
  try {
    const raw = await fetchGitHubText('pages/about.mdx');
    return parseMDX(raw);
  } catch (error) {
    console.error('Failed to fetch about.mdx:', error);
    return null;
  }
});

export const getLinesMDX = cache(async () => {
  try {
    const raw = await fetchGitHubText('pages/lines.mdx');
    return parseMDX(raw);
  } catch (error) {
    console.error('Failed to fetch lines.mdx:', error);
    return null;
  }
});

export const getMemosList = cache(async () => {
  try {
    const files = await fetchGitHubDir('memos');
    const memos = await Promise.all(
      files.map(async path => {
        const raw = await fetchGitHubText(path);
        const parsed = parseMDX(raw);
        return parsed ?? null;
      }),
    );

    return memos
      .filter(Boolean)
      .sort((a, b) => dayjs(b?.data.createdTime).diff(dayjs(a?.data.createdTime))) as MDXPost[];
  } catch (error) {
    console.error('Failed to fetch memos list:', error);
    return [];
  }
});

export const getPostList = cache(async () => {
  try {
    const files = await fetchGitHubDir('posts');
    const posts = await Promise.all(
      files.map(async path => {
        const raw = await fetchGitHubText(path);
        const parsed = parseMDX(raw);
        return parsed ?? null;
      }),
    );

    return posts
      .filter(Boolean)
      .sort((a, b) => dayjs(b?.data.createdTime).diff(dayjs(a?.data.createdTime))) as MDXPost[];
  } catch (error) {
    console.error('Failed to fetch posts list:', error);
    return [];
  }
});

export const getPostMDX = cache(async (slug: string) => {
  try {
    const raw = await fetchGitHubText(`posts/${slug}.mdx`);
    return parseMDX(raw);
  } catch (error) {
    console.error(`Failed to fetch post ${slug}:`, error);
    return null;
  }
});
