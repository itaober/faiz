import dayjs from 'dayjs';
import matter from 'gray-matter';
import { cache } from 'react';
import z from 'zod';

import { fetchGitHubDir, fetchGitHubText } from './common';

export const MDXSchema = z.object({
  content: z.string(),
  data: z.object({
    title: z.string(),
    createdTime: z.string(),
    updatedTime: z.string(),
    tags: z.array(z.string()).default([]),
    pinned: z.boolean().optional(),
  }),
});

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

export const getPostList = cache(async () => {
  try {
    const files = await fetchGitHubDir('posts');
    const posts = await Promise.all(
      files.map(async path => {
        const raw = await fetchGitHubText(path);
        const parsed = parseMDX(raw);
        return parsed ? parsed.data : null;
      }),
    );

    return posts
      .filter((p): p is z.infer<typeof MDXSchema>['data'] => p !== null)
      .sort((a, b) => dayjs(b.createdTime).diff(dayjs(a.createdTime)));
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
