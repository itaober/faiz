'use client';

import Image from 'next/image';
import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

interface IPreviewContext {
  isPreview: boolean;
  setIsPreview: Dispatch<SetStateAction<boolean>>;
}

const PreviewContext = createContext<IPreviewContext>({
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

    return () => {
      document.body.style.overflow = 'auto';
    };
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

  const handleClick = () => {
    setIsPreview(true);
  };

  return (
    <div data-preview={isPreview} className={cn('cursor-pointer', className)} onClick={handleClick}>
      {children}
    </div>
  );
};

interface IPreviewPortalProps {
  children: React.ReactNode;
  className?: string;
}

const PreviewPortal = ({ children, className }: IPreviewPortalProps) => {
  const { isPreview, setIsPreview } = usePreview();

  const handleClose = () => {
    setIsPreview(false);
  };

  if (!isPreview) {
    return null;
  }

  return createPortal(
    <div
      data-preview={isPreview}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-6 backdrop-blur md:px-0 dark:bg-black/80',
        className,
      )}
      onClick={handleClose}
    >
      {children}
    </div>,
    document.body,
  );
};

interface IPreviewImageProps {
  src: string;
  alt: string;
  className?: string;
}

const PreviewImage = ({ src, alt, className }: IPreviewImageProps) => {
  return (
    <Image
      src={src}
      alt={alt}
      width={0}
      height={0}
      sizes="100%"
      className={cn('h-5/6 w-auto object-contain', className)}
      priority
    />
  );
};

export { Preview, PreviewImage, PreviewPortal, PreviewTrigger };
