'use client';

import { Loader2, X } from 'lucide-react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

interface PendingImage {
  id: string;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface ImagePreviewGridProps {
  images: PendingImage[];
  onRemove: (id: string) => void;
  className?: string;
}

const getImageSrc = (url: string) => {
  if (url.startsWith('blob:')) {
    return url;
  }
  return `/api/image/${url}`;
};

/** Image preview grid for pending/uploaded images */
export function ImagePreviewGrid({ images, onRemove, className }: ImagePreviewGridProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {images.map(image => (
        <div key={image.id} className="bg-muted relative aspect-square overflow-hidden rounded-lg">
          <Image
            src={getImageSrc(image.preview)}
            alt="Preview"
            fill
            className="object-cover"
            unoptimized={image.preview.startsWith('blob:')}
          />

          {image.status === 'uploading' && (
            <div className="bg-background/60 absolute inset-0 flex items-center justify-center">
              <Loader2 className="text-foreground/60 size-6 animate-spin" />
            </div>
          )}

          {image.status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
              <span className="px-2 text-center text-xs text-red-600 dark:text-red-400">
                {image.error || 'Upload failed'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onRemove(image.id)}
            className="bg-background/80 hover:bg-background absolute top-1 right-1 rounded-full p-1 transition-colors"
            aria-label="Remove image"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
