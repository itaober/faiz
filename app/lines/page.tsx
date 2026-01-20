import { notFound } from 'next/navigation';

import { MDX } from '@/components/mdx';
import MotionWrapper from '@/components/motion-wrapper';
import { getLinesMDX } from '@/lib/data/mdx';

import PostTitle from '../_components/post-title';

export async function generateMetadata() {
  const linesMDX = await getLinesMDX();
  if (!linesMDX) {
    return {};
  }
  return { title: linesMDX.data.title };
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
