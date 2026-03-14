import { MDX } from '@/components/mdx';
import type { Memo } from '@/lib/data/memos';

import MemoCardActions from './memo-card-actions';
import MemoCardImages from './memo-card-images';

interface IMemoCardProps {
  memo: Memo;
}

export default function MemoCard({ memo }: IMemoCardProps) {
  const { images = [], createdTime } = memo;

  return (
    <div>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="border-border size-3 rounded-full border" />
          <time
            dateTime={createdTime}
            className="text-muted-foreground/70 font-sans text-sm font-medium"
          >
            {createdTime}
          </time>
        </div>
        <MemoCardActions memo={memo} />
      </header>
      <div className="flex w-full gap-2 md:gap-4">
        <div className="flex h-auto w-3 shrink-0 justify-center">
          <div className="bg-border h-full w-px" />
        </div>
        <div className="min-w-0 flex-1">
          <MDX source={memo.content} />
          {images.length > 0 && <MemoCardImages images={images} />}
        </div>
      </div>
    </div>
  );
}
