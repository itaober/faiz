import { MDX } from '@/components/mdx';
import MediaStrip from '@/components/media-strip';
import { resolveAssetSrc } from '@/lib/assets';
import { getImageMeta } from '@/lib/data/images';
import type { Memo } from '@/lib/data/memos';

import MemoCardInline from './memo-card-inline';

interface IMemoCardProps {
  memo: Memo;
  /** Load images right away instead of lazily, for memos in the first viewport. */
  eager?: boolean;
}

export default async function MemoCard({ memo, eager }: IMemoCardProps) {
  const metas = await Promise.all(memo.images.map(getImageMeta));
  const images = memo.images.map((path, index) => ({
    src: resolveAssetSrc(path),
    alt: `Memo image ${index + 1}`,
    width: metas[index]?.width,
    height: metas[index]?.height,
    blurDataURL: metas[index]?.blurDataURL,
  }));

  return (
    <MemoCardInline memo={memo}>
      <MDX source={memo.content} />
      {images.length > 0 && (
        <div className="mt-3">
          <MediaStrip items={images} layout="stream" eager={eager} />
        </div>
      )}
    </MemoCardInline>
  );
}
