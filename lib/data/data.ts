import { cache } from 'react';
import z from 'zod';

import { fetchGitHubJson } from './common';

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
    const authorData = await fetchGitHubJson('data/meta.json');
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
  rating: z.number(),
  type: z.string(),
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
    const recordsData = await fetchGitHubJson('data/records.json');
    return RecordsSchema.parse(recordsData);
  } catch (error) {
    console.error('Failed to fetch or parse records data:', error);
    return null;
  }
});
