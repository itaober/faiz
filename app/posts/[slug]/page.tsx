import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import PostTitle from '@/app/_components/post-title';
import { MDX } from '@/components/mdx';
import MotionWrapper from '@/components/motion-wrapper';
import { getPostMDX } from '@/lib/data/mdx';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

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
  const description = buildDescription(post.content, post.data.title);
  const base = buildPageMetadata({
    title: post.data.title,
    description,
    canonical: `/posts/${slug}`,
    metaTitle: { absolute: post.data.title },
    openGraph: {
      type: 'article',
      publishedTime: post.data.createdTime,
      modifiedTime: post.data.updatedTime,
      tags: post.data.tags,
    },
  });

  return {
    ...base,
    keywords: post.data.tags,
  };
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
