import { notFound } from 'next/navigation';

import { MDX } from '@/components/mdx';
import MotionWrapper from '@/components/motion-wrapper';
import { PAGE_META } from '@/lib/constants/seo';
import { getAboutMDX } from '@/lib/data/mdx';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import PageMdxInlineSection from '../_components/page-mdx-inline-section';

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
    // flow-root keeps the last block's margin inside the page, as overflow-hidden did, without
    // clipping focus and selection rings that sit outside the content edge.
    <MotionWrapper className="flow-root">
      <PageMdxInlineSection page="about" title={data.title}>
        <article className="prose">
          <MDX source={content} />
        </article>
      </PageMdxInlineSection>
    </MotionWrapper>
  );
}
