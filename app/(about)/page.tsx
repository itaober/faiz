import { notFound } from 'next/navigation';

import { MDX } from '@/components/mdx';
import { getAboutMDX } from '@/lib/data/mdx';

import PostTitle from '../_components/post-title';

export async function generateMetadata() {
  const aboutMDX = await getAboutMDX();
  if (!aboutMDX) {
    return {};
  }
  return { title: aboutMDX.data.title };
}

export default async function AboutPage() {
  const aboutMDX = await getAboutMDX();

  if (!aboutMDX) {
    notFound();
  }

  const { content, data } = aboutMDX;

  return (
    <div className="max-w-4xl overflow-y-hidden">
      <PostTitle title={data.title} />
      <article className="prose dark:prose-invert">
        <MDX source={content} />
      </article>
    </div>
  );
}
