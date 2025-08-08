import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import z from 'zod';

export const MDXSchema = z.object({
  content: z.string(),
  data: z.object({
    title: z.string(),
    createdTime: z.string(),
    updatedTime: z.string(),
    tags: z.array(z.string()),
  }),
});

const contentDir = path.join(process.cwd(), 'content');

export const getMDXRawData = async (filePath: string) => {
  try {
    const fullPath = path.join(contentDir, filePath);
    const mdxData = fs.readFileSync(fullPath, 'utf-8');
    return mdxData;
  } catch (error) {
    console.error('Error reading or parsing mdx data:', error);
    return null;
  }
};

export const getAboutMDX = async () => {
  const mdxData = await getMDXRawData('about.mdx');
  const mattered = matter(mdxData || '');
  return MDXSchema.parse(mattered);
};

export const getPostMDX = async (filePath: string) => {
  const mdxData = await getMDXRawData(filePath);
  return matter(mdxData || '');
};
