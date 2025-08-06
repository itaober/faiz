import fs from 'fs/promises';
import path from 'path';
import { cache } from 'react';

import { UserSchema } from '@/lib/schema';

const userFilePath = path.join(process.cwd(), 'content/meta/user.json');

export const getUser = cache(async () => {
  try {
    const fileContent = await fs.readFile(userFilePath, 'utf-8');
    const userData = JSON.parse(fileContent);

    const validatedUserData = UserSchema.parse(userData);

    return validatedUserData;
  } catch (error) {
    console.error('Error reading or parsing user data:', error);
    return null;
  }
});
