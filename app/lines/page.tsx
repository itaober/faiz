import { notFound } from 'next/navigation';

import { MDX } from '@/components/mdx';
import MotionWrapper from '@/components/motion-wrapper';
import { PAGE_META } from '@/lib/constants/seo';
import { getLinesMDX } from '@/lib/data/mdx';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import PostTitle from '../_components/post-title';

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
      <PostTitle {...data} />
      <article className="prose dark:prose-invert">
        <MDX source={content} />
      </article>
    </MotionWrapper>
  );
};

export default LinesPage;
