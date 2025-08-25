import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';

import { getLinesMDX } from '@/lib/data/mdx';

import PostTitle from '../_components/post-title';

const LinesPage = async () => {
  const linesMDX = await getLinesMDX();

  if (!linesMDX) {
    notFound();
  }

  const { content, data } = linesMDX;

  return (
    <div className="max-w-4xl overflow-y-hidden">
      <PostTitle {...data} />
      <article className="prose dark:prose-invert">
        <MDXRemote source={content} />
      </article>
    </div>
  );
};

export default LinesPage;
