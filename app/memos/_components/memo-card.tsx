import { MDX } from '@/components/mdx';
import type { Memo } from '@/lib/data/memos';

import MemoCardImages from './memo-card-images';
import MemoCardInline from './memo-card-inline';

interface IMemoCardProps {
  memo: Memo;
}

export default function MemoCard({ memo }: IMemoCardProps) {
  const { images = [] } = memo;

  return (
    <MemoCardInline memo={memo}>
      <MDX source={memo.content} />
      {images.length > 0 && <MemoCardImages images={images} />}
    </MemoCardInline>
  );
}
