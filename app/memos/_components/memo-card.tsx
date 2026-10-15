import { MDX } from '@/components/mdx';
import { getImageMeta } from '@/lib/data/images';
import type { Memo } from '@/lib/data/memos';

import MemoCardImages from './memo-card-images';
import MemoCardInline from './memo-card-inline';
import { MAX_MEMO_CARD_IMAGES } from './memo-image-layout';

interface IMemoCardProps {
  memo: Memo;
  /** Load images right away instead of lazily, for memos in the first viewport. */
  eager?: boolean;
}

export default async function MemoCard({ memo, eager }: IMemoCardProps) {
  const paths = memo.images.slice(0, MAX_MEMO_CARD_IMAGES);
  const metas = await Promise.all(paths.map(getImageMeta));
  const images = paths.map((path, index) => ({ path, meta: metas[index] }));

  return (
    <MemoCardInline memo={memo}>
      <MDX source={memo.content} />
      {images.length > 0 && <MemoCardImages images={images} eager={eager} />}
    </MemoCardInline>
  );
}
