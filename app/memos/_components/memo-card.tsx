import Image from 'next/image';

import { MDX } from '@/components/mdx';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import type { Memo } from '@/lib/data/memos';
import { cn } from '@/lib/utils';

import MemoCardActions from './memo-card-actions';

interface IMemoCardProps {
  memo: Memo;
}

const MemoCardImages = ({ images }: { images: string[] }) => {
  const count = images.length;

  return (
    <div
      className={cn('not-prose mt-3', {
        'grid grid-cols-2 gap-2 md:gap-4': count === 2,
        'grid grid-cols-3 gap-2 md:gap-4': count > 2,
      })}
    >
      {images.map(url => {
        const previewUrl = `/api/image/${url}`;
        return (
          <Preview key={url}>
            <PreviewTrigger className={cn('w-full', { 'w-fit': count === 1 })}>
              <div
                className={cn({
                  'bg-muted/30 w-fit max-w-full cursor-pointer overflow-hidden rounded-md':
                    count === 1,
                  'bg-muted/30 aspect-square w-full cursor-pointer overflow-hidden rounded-md':
                    count > 1,
                })}
              >
                <Image
                  src={previewUrl}
                  alt=""
                  width={0}
                  height={0}
                  sizes="100vw"
                  className={cn({
                    'h-auto w-auto max-w-full rounded': count === 1,
                    'relative aspect-square w-full rounded object-cover': count > 1,
                  })}
                />
              </div>
            </PreviewTrigger>
            <PreviewPortal>
              <PreviewImage src={previewUrl} alt="Memo preview" />
            </PreviewPortal>
          </Preview>
        );
      })}
    </div>
  );
};

const MemoCard = ({ memo }: IMemoCardProps) => {
  const { content, images = [], createdTime } = memo;

  return (
    <div>
      <header className="flex items-center justify-between gap-2 opacity-70">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="size-3 rounded-full border border-neutral-300 dark:border-neutral-600" />
          <time dateTime={createdTime} className="font-sans text-sm font-medium">
            {createdTime}
          </time>
        </div>
        <MemoCardActions memo={memo} />
      </header>
      <div className="flex w-full gap-2 md:gap-4">
        <div className="flex h-auto w-3 shrink-0 justify-center">
          <div className="h-full w-px bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div className="min-w-0 flex-1">
          <MDX source={content || ''} />
          {images.length > 0 && <MemoCardImages images={images} />}
        </div>
      </div>
    </div>
  );
};

export default MemoCard;
