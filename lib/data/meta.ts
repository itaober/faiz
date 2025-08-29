import { cache } from 'react';
import z from 'zod';

import { fetchGitHubJson } from './common';

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
    const authorData = await fetchGitHubJson('data/meta.json');
    return MetaSchema.parse(authorData);
  } catch (error) {
    console.error('Failed to fetch or parse meta data:', error);
    return null;
  }
});
