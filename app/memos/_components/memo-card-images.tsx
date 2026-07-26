'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import { cn } from '@/lib/utils';
import { toApiImageUrl } from '@/lib/utils/editor-image';

import { getMemoImageLayout } from './memo-image-layout';

const SWIPE_THRESHOLD = 40;

const getMemoImageSizes = (columns: number) => {
  if (columns <= 1) {
    return '(max-width: 768px) calc(100vw - 5.5rem), 36rem';
  }

  if (columns === 2) {
    return '(max-width: 768px) calc((100vw - 6rem) / 2), 18rem';
  }

  return '(max-width: 768px) calc((100vw - 6rem) / 3), 12rem';
};

interface MemoCardImagesProps {
  images: string[];
}

export default function MemoCardImages({ images }: MemoCardImagesProps) {
  const layout = getMemoImageLayout(images.length);
  const { columns, visibleCount } = layout;
  const visibleImages = useMemo(() => images.slice(0, visibleCount), [images, visibleCount]);
  const imageSizes = getMemoImageSizes(columns);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const previewUrls = useMemo(() => visibleImages.map(toApiImageUrl), [visibleImages]);

  useEffect(() => {
    setCurrentIndex(index => Math.min(index, Math.max(0, visibleCount - 1)));
  }, [visibleCount]);

  const showPrev = useCallback(() => {
    if (visibleCount <= 1) {
      return;
    }
    setCurrentIndex(prev => (prev - 1 + visibleCount) % visibleCount);
  }, [visibleCount]);

  const showNext = useCallback(() => {
    if (visibleCount <= 1) {
      return;
    }
    setCurrentIndex(prev => (prev + 1) % visibleCount);
  }, [visibleCount]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (visibleCount <= 1) {
        return;
      }

      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      if (startX === null || startY === null) {
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      touchStartXRef.current = null;
      touchStartYRef.current = null;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      if (deltaX < 0) {
        showNext();
      } else {
        showPrev();
      }
    },
    [visibleCount, showNext, showPrev],
  );

  if (visibleCount === 0) {
    return null;
  }

  const currentPreviewUrl = previewUrls[currentIndex];
  const currentAlt = `Memo image ${currentIndex + 1}`;
  const hasMultipleImages = visibleCount > 1;

  return (
    <Preview>
      <div
        className={cn('not-prose pb-4', {
          'grid grid-cols-2 gap-2 md:gap-4': columns === 2,
          'grid grid-cols-3 gap-2 md:gap-4': columns === 3,
        })}
      >
        {previewUrls.map((url, index) => {
          const imageAlt = `Memo image ${index + 1}`;
          return (
            <PreviewTrigger
              key={`${visibleImages[index]}-${index}`}
              layoutId={`memo-image-${index}`}
              previewSrc={url}
              onOpen={() => setCurrentIndex(index)}
              ariaLabel={`Open ${imageAlt}`}
              className={cn('rounded-md text-left', {
                'w-fit': columns === 1,
                'w-full': columns > 1,
              })}
            >
              <div
                className={cn('fz-img-outline', {
                  'bg-muted/30 w-fit max-w-full cursor-pointer overflow-hidden rounded-md':
                    columns === 1,
                  'bg-muted/30 aspect-square w-full cursor-pointer overflow-hidden rounded-md':
                    columns > 1,
                })}
              >
                <Image
                  src={url}
                  alt={imageAlt}
                  width={0}
                  height={0}
                  sizes={imageSizes}
                  className={cn({
                    'h-auto w-auto max-w-full rounded-md': columns === 1,
                    'relative aspect-square w-full rounded-md object-cover': columns > 1,
                  })}
                />
              </div>
            </PreviewTrigger>
          );
        })}
      </div>

      <PreviewPortal
        ariaLabel="Image preview"
        targetAspectRatio={columns > 1 ? 1 : undefined}
        onPrevious={hasMultipleImages ? showPrev : undefined}
        onNext={hasMultipleImages ? showNext : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        footer={
          hasMultipleImages ? (
            <p className="text-overlay-control-foreground text-center font-mono text-xs">
              {currentIndex + 1} / {visibleCount}
            </p>
          ) : undefined
        }
      >
        <PreviewImage src={currentPreviewUrl} alt={currentAlt} />
      </PreviewPortal>
    </Preview>
  );
}
