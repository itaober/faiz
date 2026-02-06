import { notFound } from 'next/navigation';

import { MDX } from '@/components/mdx';
import MotionWrapper from '@/components/motion-wrapper';
import { PAGE_META } from '@/lib/constants/seo';
import { getAboutMDX } from '@/lib/data/mdx';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import PostTitle from '../_components/post-title';

export async function generateMetadata() {
  const aboutMDX = await getAboutMDX();
  if (!aboutMDX) {
    return {};
  }
  const description = buildDescription(aboutMDX.content, aboutMDX.data.title);
  return buildPageMetadata({
    title: aboutMDX.data.title,
    description,
    canonical: PAGE_META.about.canonical,
  });
}

export default async function AboutPage() {
  const aboutMDX = await getAboutMDX();

  if (!aboutMDX) {
    notFound();
  }

  const { content, data } = aboutMDX;

  return (
    <MotionWrapper className="overflow-y-hidden">
      <PostTitle title={data.title} />
      <article className="prose dark:prose-invert">
        <MDX source={content} />
      </article>
    </MotionWrapper>
  );
}
