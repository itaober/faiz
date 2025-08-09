import fs from 'fs/promises';
import matter from 'gray-matter';
import path from 'path';
import z from 'zod';

export const MDXSchema = z.object({
  content: z.string(),
  data: z.object({
    title: z.string(),
    createdTime: z.string(),
    updatedTime: z.string(),
    tags: z.array(z.string()).default([]),
  }),
});

const contentDir = path.join(process.cwd(), 'content');

export const getMDXRawData = async (filePath: string) => {
  try {
    const fullPath = path.join(contentDir, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  } catch (error) {
    console.error(`Error reading mdx file: ${filePath}`, error);
    return null;
  }
};

const getParsedMDX = async (filePath: string) => {
  const mdxData = await getMDXRawData(filePath);
  if (!mdxData) {
    return null;
  }
  return MDXSchema.parse(matter(mdxData));
};

export const getAboutMDX = () => getParsedMDX('about.mdx');

export const getPostMDX = async (filePath: string) => getParsedMDX(filePath);
