import dayjs from 'dayjs';
import matter from 'gray-matter';
import { cache } from 'react';
import z from 'zod';

import { cachedResource, fetchGitHubDir, fetchGitHubText } from './common';

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
export const getAboutMDX = cachedResource(
  'about.mdx',
  async () => parseMDX(await fetchGitHubText('pages/about.mdx')),
  null,
);

export const getLinesMDX = cachedResource(
  'lines.mdx',
  async () => parseMDX(await fetchGitHubText('pages/lines.mdx')),
  null,
);

export const getPostList = cache(async () => {
  try {
    const files = await fetchGitHubDir('data/posts');
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

export const getPostMDX = cachedResource(
  'post',
  async (slug: string) => parseMDX(await fetchGitHubText(`data/posts/${slug}.mdx`)),
  null,
);
