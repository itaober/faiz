'use client';

import { ChevronLeft, ChevronRight, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ANIMATION } from '@/lib/constants/animation';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 40;

const getMemoImageSizes = (count: number) => {
  if (count <= 1) {
    return '(max-width: 768px) calc(100vw - 5.5rem), 36rem';
  }

  if (count === 2) {
    return '(max-width: 768px) calc((100vw - 6rem) / 2), 18rem';
  }

  return '(max-width: 768px) calc((100vw - 6rem) / 3), 12rem';
};

interface MemoCardImagesProps {
  images: string[];
}

export default function MemoCardImages({ images }: MemoCardImagesProps) {
  const count = images.length;
  const imageSizes = getMemoImageSizes(count);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const previewUrls = useMemo(() => images.map(path => `/api/image/${path}`), [images]);

  const showPrev = useCallback(() => {
    if (count <= 1) {
      return;
    }
    setCurrentIndex(prev => (prev - 1 + count) % count);
  }, [count]);

  const showNext = useCallback(() => {
    if (count <= 1) {
      return;
    }
    setCurrentIndex(prev => (prev + 1) % count);
  }, [count]);

  const handleOpenPreview = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (count <= 1) {
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
    [count, showNext, showPrev],
  );

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClosePreview();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrev();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [handleClosePreview, isPreviewOpen, showNext, showPrev]);

  if (count === 0) {
    return null;
  }

  const currentPreviewUrl = previewUrls[currentIndex];
  const currentAlt = `Memo image ${currentIndex + 1}`;

  return (
    <>
      <div
        className={cn('not-prose pb-4', {
          'grid grid-cols-2 gap-2 md:gap-4': count === 2,
          'grid grid-cols-3 gap-2 md:gap-4': count > 2,
        })}
      >
        {previewUrls.map((url, index) => {
          const imageAlt = `Memo image ${index + 1}`;
          return (
            <button
              key={images[index]}
              type="button"
              onClick={() => handleOpenPreview(index)}
              aria-label={`Open ${imageAlt}`}
              className={cn('focus-ring rounded-md text-left', {
                'w-fit': count === 1,
                'w-full': count > 1,
              })}
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
                  src={url}
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
            </button>
          );
        })}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence initial={false}>
            {isPreviewOpen ? (
              <motion.div
                className="bg-overlay-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-4 backdrop-blur md:px-6 md:py-6"
                onClick={handleClosePreview}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: ANIMATION.ease.out }}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Image preview"
                  onClick={event => event.stopPropagation()}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  className="relative flex max-h-full max-w-full flex-col items-end justify-center gap-2 md:gap-3"
                  initial={{ opacity: 0, y: ANIMATION.distance.small, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: ANIMATION.distance.minimal, scale: 0.99 }}
                  transition={{ duration: 0.24, ease: ANIMATION.ease.out }}
                >
                  <motion.button
                    type="button"
                    aria-label="Close preview"
                    onClick={handleClosePreview}
                    className="focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover hover:text-overlay-control-foreground size-10"
                    initial={{ opacity: 0, y: -ANIMATION.distance.minimal }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -ANIMATION.distance.minimal }}
                    transition={{ duration: 0.18, delay: 0.03, ease: ANIMATION.ease.out }}
                  >
                    <XIcon className="size-4.5" />
                  </motion.button>

                  <div className="relative h-[min(72vh,36rem)] w-[min(92vw,36rem)] sm:h-[min(74vh,40rem)] sm:w-[min(90vw,40rem)] md:h-[min(78vh,48rem)] md:w-[min(86vw,58rem)]">
                    <Image
                      src={currentPreviewUrl}
                      alt={currentAlt}
                      fill
                      sizes="(max-width: 640px) 92vw, (max-width: 768px) 90vw, 86vw"
                      className="object-contain"
                    />

                    {count > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={showPrev}
                          className="focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover absolute top-1/2 left-2 hidden size-9 -translate-y-1/2 md:inline-flex md:size-10"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="size-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={showNext}
                          className="focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover absolute top-1/2 right-2 hidden size-9 -translate-y-1/2 md:inline-flex md:size-10"
                          aria-label="Next image"
                        >
                          <ChevronRight className="size-4.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {count > 1 && (
                    <p className="text-overlay-control-foreground w-full text-center font-mono text-xs">
                      {currentIndex + 1} / {count}
                    </p>
                  )}
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
