import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import PostTitle from '@/app/_components/post-title';
import { MDX } from '@/components/mdx';
import MotionWrapper from '@/components/motion-wrapper';
import { getPostMDX } from '@/lib/data/mdx';

interface IPostPageProps {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
  const post = await getPostMDX(slug);
  if (!post) {
    notFound();
  }
  return post;
}

export async function generateMetadata({ params }: IPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return { title: { absolute: post.data.title } };
}

export default async function PostPage({ params }: IPostPageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  const { content, data } = post;

  return (
    <MotionWrapper>
      <PostTitle {...data} />
      <article className="prose dark:prose-invert">
        <MDX source={content} />
      </article>
    </MotionWrapper>
  );
}
