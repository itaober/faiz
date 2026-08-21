import matter from 'gray-matter';
import z from 'zod';

import { cachedResource, fetchGitHubText } from './common';
import { PostMetaSchema } from './data';

// Frontmatter and the data/posts.json index hold the same fields, so they share
// one schema — pages/*.mdx uses the same shape as posts.
export const MDXSchema = z.object({
  content: z.string(),
  data: PostMetaSchema,
});

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

export const getPostMDX = cachedResource(
  'post',
  async (slug: string) => parseMDX(await fetchGitHubText(`data/posts/${slug}.mdx`)),
  null,
);
