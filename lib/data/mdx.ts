import dayjs from 'dayjs';
import fs from 'fs/promises';
import matter from 'gray-matter';
import path from 'path';
import { cache } from 'react';
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
const postsDir = path.join(contentDir, 'posts');

export const getMDXRawData = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, 'utf-8');
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

export const getAboutMDX = () => getParsedMDX(path.join(contentDir, 'about.mdx'));

export const getPostList = cache(async () => {
  try {
    const files = await fs.readdir(postsDir);
    const postList = await Promise.all(
      files.map(async file => {
        const filePath = path.join(postsDir, file);
        const parsedMDX = await getParsedMDX(filePath);
        return parsedMDX ? MDXSchema.parse(parsedMDX).data : null;
      }),
    );
    return postList
      .filter((p): p is z.infer<typeof MDXSchema>['data'] => p !== null)
      .sort((a, b) => dayjs(b.createdTime).diff(dayjs(a.createdTime)));
  } catch (error) {
    console.error('Error reading or parsing posts mdx meta data:', error);
    return [];
  }
});

export const getPostMDX = async (slug: string) => getParsedMDX(path.join(postsDir, `${slug}.mdx`));
