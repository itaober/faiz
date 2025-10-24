import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import PostTitle from '@/app/_components/post-title';
import { MDX } from '@/components/mdx';
import { getPostMDX } from '@/lib/data/mdx';

interface IPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: IPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: { absolute: decodeURIComponent(slug) } };
}

export default async function PostPage({ params }: IPostPageProps) {
  const { slug } = await params;

  const post = await getPostMDX(decodeURIComponent(slug));

  if (!post) {
    notFound();
  }

  const { content, data } = post;

  return (
    <article className="max-w-4xl overflow-y-hidden">
      <PostTitle {...data} />
      <article className="prose dark:prose-invert">
        <MDX source={content} />
      </article>
    </article>
  );
}
