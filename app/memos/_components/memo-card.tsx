import Image from 'next/image';

import { MDX } from '@/components/mdx';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import type { Memo } from '@/lib/data/memos';
import { cn } from '@/lib/utils';

import MemoCardActions from './memo-card-actions';

interface IMemoCardProps {
  memo: Memo;
}

const getMemoImageSizes = (count: number) => {
  if (count <= 1) {
    return '(max-width: 768px) calc(100vw - 5.5rem), 36rem';
  }

  if (count === 2) {
    return '(max-width: 768px) calc((100vw - 6rem) / 2), 18rem';
  }

  return '(max-width: 768px) calc((100vw - 6rem) / 3), 12rem';
};

const MemoCardImages = ({ images }: { images: string[] }) => {
  const count = images.length;
  const imageSizes = getMemoImageSizes(count);

  return (
    <div
      className={cn('not-prose pb-4', {
        'grid grid-cols-2 gap-2 md:gap-4': count === 2,
        'grid grid-cols-3 gap-2 md:gap-4': count > 2,
      })}
    >
      {images.map((url, index) => {
        const previewUrl = `/api/image/${url}`;
        const imageAlt = `Memo image ${index + 1}`;
        return (
          <Preview key={url}>
            <PreviewTrigger
              ariaLabel={`Open ${imageAlt}`}
              className={cn('rounded-md', { 'w-fit': count === 1, 'w-full': count > 1 })}
            >
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
                  alt={imageAlt}
                  width={0}
                  height={0}
                  sizes={imageSizes}
                  className={cn({
                    'h-auto w-auto max-w-full rounded': count === 1,
                    'relative aspect-square w-full rounded object-cover': count > 1,
                  })}
                />
              </div>
            </PreviewTrigger>
            <PreviewPortal ariaLabel={`${imageAlt} preview`}>
              <PreviewImage src={previewUrl} alt={imageAlt} />
            </PreviewPortal>
          </Preview>
        );
      })}
    </div>
  );
};

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
