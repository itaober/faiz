import z from 'zod';

// Content-file schemas shared by the app's read path and the worker's write
// path — keep this module free of Next/React imports.

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
