'use client';

import type { ImageProps } from 'next/image';
import Image from 'next/image';
import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const PreviewContext = createContext<{
  isPreview: boolean;
  setIsPreview: Dispatch<SetStateAction<boolean>>;
}>({
  isPreview: false,
  setIsPreview: () => {},
});

const usePreview = () => {
  const context = useContext(PreviewContext);

  if (!context) {
    throw new Error('usePreview must be used within an Preview');
  }

  return context;
};

interface IPreviewProps {
  children: React.ReactNode;
}

const Preview = ({ children }: IPreviewProps) => {
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (isPreview) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isPreview]);

  return (
    <PreviewContext.Provider value={{ isPreview, setIsPreview }}>
      {children}
    </PreviewContext.Provider>
  );
};

interface IPreviewTriggerProps {
  children: React.ReactNode;
  className?: string;
}

const PreviewTrigger = ({ children, className }: IPreviewTriggerProps) => {
  const { isPreview, setIsPreview } = usePreview();
  return (
    <div
      data-preview={isPreview}
      className={cn(
        {
          'cursor-pointer': !isPreview,
          'fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-6 backdrop-blur md:px-0 dark:bg-black/80':
            isPreview,
        },
        className,
      )}
      onClick={() => setIsPreview(prev => !prev)}
    >
      {children}
    </div>
  );
};

interface IPreviewContentProps {
  children: React.ReactNode;
  className?: string;
  isMusicType?: boolean;
}
const PreviewContent = ({ children, className, isMusicType }: IPreviewContentProps) => {
  const { isPreview } = usePreview();
  return (
    <div
      data-preview={isPreview}
      className={cn(
        'relative w-full',
        {
          'aspect-square': isPreview || isMusicType,
          'max-w-lg': isPreview,
        },
        className,
      )}
    >
      {children}
    </div>
  );
};

const PreviewImage = ({ src, alt, className, ...props }: ImageProps) => {
  const { isPreview } = usePreview();
  return (
    <Image
      data-preview={isPreview}
      src={src}
      alt={alt}
      fill
      className={cn(
        'rounded object-cover',
        {
          'rounded-none': isPreview,
        },
        className,
      )}
      {...props}
    />
  );
};

export { Preview, PreviewContent, PreviewImage, PreviewTrigger };
