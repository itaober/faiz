'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import { cn } from '@/lib/utils';
import { type MdxImageGalleryItem, unescapeMarkdownValue } from '@/lib/utils/editor-image';

interface MDXImageGalleryProps {
  images?: Array<MdxImageGalleryItem | string>;
}

interface NormalizedImage {
  alt: string;
  src: string;
}

const IMAGE_SIZES = '(max-width: 768px) calc(100vw - 3rem), 36rem';

const isExternalImage = (src: string) => /^(https?:)?\/\//.test(src);

const normalizeImage = (
  value: MdxImageGalleryItem | string | null | undefined,
): NormalizedImage | null => {
  if (typeof value === 'string') {
    const src = unescapeMarkdownValue(value).trim();
    return src ? { alt: 'Content image', src } : null;
  }
  if (!value?.src) {
    return null;
  }
  const src = unescapeMarkdownValue(value.src).trim();
  if (!src) {
    return null;
  }
  const alt = value.alt ? unescapeMarkdownValue(value.alt).trim() : '';
  const caption = value.caption ? unescapeMarkdownValue(value.caption).trim() : '';
  return { alt: alt || caption, src };
};

/**
 * Read-view gallery for two or more images: a fixed-height (square) main image
 * shown `object-contain` so switching never shifts the layout, a thumbnail
 * filmstrip, and click-to-zoom via the shared <Preview> lightbox (with prev/next).
 * Card-less so it flows in the prose like the standalone <Image>.
 */
export default function MDXImageGallery({ images }: MDXImageGalleryProps) {
  const normalized = (images ?? [])
    .map(normalizeImage)
    .filter((image): image is NormalizedImage => Boolean(image));
  const count = normalized.length;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = Math.min(selectedIndex, Math.max(0, count - 1));

  useEffect(() => {
    if (selectedIndex !== safeIndex) {
      setSelectedIndex(safeIndex);
    }
  }, [safeIndex, selectedIndex]);

  if (count === 0) {
    return null;
  }

  const selected = normalized[safeIndex];
  const caption = selected.alt;
  const isGallery = count > 1;
  const previewLabel = `Open image preview${caption ? `: ${caption}` : ''}`;
  const showPrevious = () => setSelectedIndex((safeIndex - 1 + count) % count);
  const showNext = () => setSelectedIndex((safeIndex + 1) % count);

  return (
    <Preview>
      <span className="not-prose mb-4 flex w-full flex-col">
        <span className="mx-auto flex w-full max-w-xl flex-col px-2">
          {isGallery ? (
            <PreviewTrigger
              as="span"
              contained
              ariaLabel={previewLabel}
              className="relative block aspect-square w-full overflow-hidden rounded-md bg-[var(--fz-image-frame)] md:rounded-lg"
            >
              <Image
                src={selected.src}
                alt={caption || 'Content image'}
                fill
                sizes={IMAGE_SIZES}
                className="object-contain"
                unoptimized={isExternalImage(selected.src)}
              />
            </PreviewTrigger>
          ) : (
            <PreviewTrigger
              as="span"
              ariaLabel={previewLabel}
              className="block w-full overflow-hidden rounded-md md:rounded-lg"
            >
              <Image
                src={selected.src}
                alt={caption || 'Content image'}
                width={0}
                height={0}
                sizes={IMAGE_SIZES}
                className="h-auto w-full"
                unoptimized={isExternalImage(selected.src)}
              />
            </PreviewTrigger>
          )}

          {isGallery ? (
            <span className="relative mt-2 block min-h-5 w-full">
              <span className="text-muted-foreground block truncate px-10 text-center text-sm">
                {caption}
              </span>
              <span className="text-muted-foreground/70 pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 font-mono text-xs">
                {safeIndex + 1}/{count}
              </span>
            </span>
          ) : caption ? (
            <span className="text-muted-foreground mt-2 block text-center text-sm">{caption}</span>
          ) : null}

          {isGallery ? (
            <span className="mt-1 flex w-full gap-2 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {normalized.map((image, index) => (
                <button
                  key={`${image.src}-${index}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={cn(
                    'focus-ring relative size-12 shrink-0 overflow-hidden rounded-md bg-[var(--fz-image-frame)] transition md:size-14',
                    index === safeIndex ? 'opacity-100' : 'opacity-50 hover:opacity-90',
                  )}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === safeIndex ? 'true' : undefined}
                >
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    sizes="4rem"
                    className="object-contain"
                    unoptimized={isExternalImage(image.src)}
                  />
                </button>
              ))}
            </span>
          ) : null}
        </span>
      </span>

      <PreviewPortal
        ariaLabel={`Image preview: ${caption || 'image'}`}
        onPrevious={isGallery ? showPrevious : undefined}
        onNext={isGallery ? showNext : undefined}
      >
        <PreviewImage src={selected.src} alt={caption || 'Content image'} />
      </PreviewPortal>
    </Preview>
  );
}
