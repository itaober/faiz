import matter from 'gray-matter';
import z from 'zod';

import { CONTENT_KEYS } from '@/lib/content-keys';
import { readContent } from '@/lib/storage/r2';

import { cachedResource } from './common';
import { PostMetaSchema } from './data';

// Frontmatter and the posts index hold the same fields, so they share
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
// MDX Fetchers
// ================================
export const getAboutMDX = cachedResource(
  'about.mdx',
  async () => parseMDX(await readContent(CONTENT_KEYS.page('about'))),
  null,
);

export const getLinesMDX = cachedResource(
  'lines.mdx',
  async () => parseMDX(await readContent(CONTENT_KEYS.page('lines'))),
  null,
);

export const getPostMDX = cachedResource(
  'post',
  async (slug: string) => parseMDX(await readContent(CONTENT_KEYS.post(slug))),
  null,
);
