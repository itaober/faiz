import { notFound } from 'next/navigation';

import { MDX } from '@/components/mdx';
import MotionWrapper from '@/components/motion-wrapper';
import { PAGE_META } from '@/lib/constants/seo';
import { getLinesMDX } from '@/lib/data/mdx';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import PageMdxInlineSection from '../_components/page-mdx-inline-section';

export async function generateMetadata() {
  const linesMDX = await getLinesMDX();
  if (!linesMDX) {
    return {};
  }
  const description = buildDescription(linesMDX.content, linesMDX.data.title);
  return buildPageMetadata({
    title: linesMDX.data.title,
    description,
    canonical: PAGE_META.lines.canonical,
  });
}

const LinesPage = async () => {
  const linesMDX = await getLinesMDX();

  if (!linesMDX) {
    notFound();
  }

  const { content, data } = linesMDX;

  return (
    <MotionWrapper>
      <PageMdxInlineSection page="lines" title={data.title} content={content}>
        <article className="prose dark:prose-invert">
          <MDX source={content} />
        </article>
      </PageMdxInlineSection>
    </MotionWrapper>
  );
};

export default LinesPage;
