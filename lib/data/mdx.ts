import dayjs from 'dayjs';
import matter from 'gray-matter';
import z from 'zod';

import { fetchGitHubDir, fetchGitHubText } from './common';

export const MDXSchema = z.object({
  content: z.string(),
  data: z.object({
    title: z.string(),
    createdTime: z.string(),
    updatedTime: z.string(),
    tags: z.array(z.string()).default([]),
  }),
});

export type MDXData = z.infer<typeof MDXSchema>['data'];

// ================================
// Helpers
// ================================
const parseMDX = (raw: string | null) => (raw ? MDXSchema.parse(matter(raw)) : null);

// ================================
// GitHub MDX Fetchers
// ================================
export const getAboutMDX = async () => {
  try {
    const raw = await fetchGitHubText('content/about.mdx');
    return parseMDX(raw);
  } catch (error) {
    console.error('Failed to fetch about.mdx:', error);
    return null;
  }
};

export const getPostList = async () => {
  try {
    const files = await fetchGitHubDir('content/posts');
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
};

export const getPostMDX = async (slug: string) => {
  try {
    const raw = await fetchGitHubText(`content/posts/${slug}.mdx`);
    return parseMDX(raw);
  } catch (error) {
    console.error(`Failed to fetch post ${slug}:`, error);
    return null;
  }
};
