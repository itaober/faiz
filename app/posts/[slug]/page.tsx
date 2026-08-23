import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { MDX } from '@/components/mdx';
import MotionWrapper from '@/components/motion-wrapper';
import { getPostListInfo } from '@/lib/data/data';
import { getPostMDX } from '@/lib/data/mdx';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import PostDetailInlineSection from '../_components/post-detail-inline-section';
import PostMatchScroll from '../_components/post-match-scroll';
import PostTocDeferred from '../_components/post-toc-deferred';

interface IPostPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Prerender every post in the index. `dynamicParams` stays at its default, so a
 * post published from the editor is reachable before the next build.
 */
export async function generateStaticParams() {
  const posts = await getPostListInfo();
  return (posts ?? []).map(({ slug }) => ({ slug }));
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
    <>
      <MotionWrapper>
        <div className="relative">
          <PostDetailInlineSection post={data}>
            <article id="post-content" className="prose">
              <MDX source={content} />
            </article>
            <PostTocDeferred />
          </PostDetailInlineSection>
        </div>
      </MotionWrapper>
      <Suspense fallback={null}>
        <PostMatchScroll />
      </Suspense>
    </>
  );
}
