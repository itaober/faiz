import { cache } from 'react';
import z from 'zod';

import { fetchGitHubJson } from './common';

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

export const getMetaInfo = cache(async (): Promise<z.infer<typeof MetaSchema> | null> => {
  try {
    const authorData = await fetchGitHubJson(META_PATH);
    return MetaSchema.parse(authorData);
  } catch (error) {
    console.error('Failed to fetch or parse meta data:', error);
    return null;
  }
});

export const RecordItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  coverUrl: z.string(),
  createdTime: z.string(),
  rating: z.number().optional(),
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

export const getRecordsInfo = cache(async (): Promise<Records | null> => {
  try {
    const recordsData = await fetchGitHubJson(RECORDS_PATH);
    return RecordsSchema.parse(recordsData);
  } catch (error) {
    console.error('Failed to fetch or parse records data:', error);
    return null;
  }
});

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

export const getPostListInfo = cache(async (): Promise<PostList | null> => {
  try {
    const postListData = await fetchGitHubJson('data/posts.json');
    return PostListSchema.parse(postListData);
  } catch (error) {
    console.error('Failed to fetch or parse post list data:', error);
    return null;
  }
});
