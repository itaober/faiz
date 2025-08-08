import { cache } from 'react';
import z from 'zod';

export const MetaSchema = z.object({
  name: z.string(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  social: z
    .object({
      github: z.string().optional(),
    })
    .optional(),
});

export const getMetaInfo = cache(async () => {
  try {
    const authorData = await import('@/content/meta.json');
    return MetaSchema.parse(authorData);
  } catch (error) {
    console.error('Error reading or parsing meta data:', error);
    return null;
  }
});
