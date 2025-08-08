import { cache } from 'react';

import { MetaSchema } from '@/lib/schema';

export const getMetaInfo = cache(async () => {
  try {
    const authorData = await import('@/content/meta.json');
    return MetaSchema.parse(authorData);
  } catch (error) {
    console.error('Error reading or parsing meta data:', error);
    return null;
  }
});
