import z from 'zod';

import { cachedResource, fetchGitHubJson } from './common';

const META_PATH = 'data/meta.json';
const RECORDS_PATH = 'data/records.json';

export const MetaSchema = z.object({
  name: z.string(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  site: z.string().optional(),
  social: z
    .object({
      github: z.string().optional(),
    })
    .optional(),
});

export const getMetaInfo = cachedResource(
  'meta',
  async () => MetaSchema.parse(await fetchGitHubJson(META_PATH)),
  null,
);

export const RecordItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  coverUrl: z.string(),
  createdTime: z.string(),
  rating: z.number().optional(),
  comment: z.string().optional(),
  type: z.enum(['book', 'movie', 'tv', 'music', 'game']),
});
export const RecordsSchema = z.object({
  book: z.array(RecordItemSchema),
  movie: z.array(RecordItemSchema),
  tv: z.array(RecordItemSchema),
  music: z.array(RecordItemSchema),
  game: z.array(RecordItemSchema),
});

export type RecordType = keyof z.infer<typeof RecordsSchema>;
export type RecordItem = z.infer<typeof RecordItemSchema>;
export type Records = z.infer<typeof RecordsSchema>;

export const getRecordsInfo = cachedResource(
  'records',
  async () => RecordsSchema.parse(await fetchGitHubJson(RECORDS_PATH)),
  null,
);

export const PostMetaSchema = z.object({
  slug: z.string(),
  title: z.string(),
  createdTime: z.string(),
  updatedTime: z.string(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().optional(),
});
export const PostListSchema = z.array(PostMetaSchema);

export type PostMeta = z.infer<typeof PostMetaSchema>;
export type PostList = z.infer<typeof PostListSchema>;

export const getPostListInfo = cachedResource(
  'post list',
  async () => PostListSchema.parse(await fetchGitHubJson('data/posts.json')),
  null,
);
