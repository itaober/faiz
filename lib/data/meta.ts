import fs from 'fs/promises';
import path from 'path';
import { cache } from 'react';

import { AuthorSchema } from '@/lib/schema';

const authorFilePath = path.join(process.cwd(), 'content/meta/author.json');

export const getAuthorInfo = cache(async () => {
  try {
    const fileContent = await fs.readFile(authorFilePath, 'utf-8');
    const authorData = JSON.parse(fileContent);

    return AuthorSchema.parse(authorData);
  } catch (error) {
    console.error('Error reading or parsing author data:', error);
    return null;
  }
});
