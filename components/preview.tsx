'use client';

import { XIcon } from 'lucide-react';
import Image from 'next/image';
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

interface IPreviewContext {
  isPreview: boolean;
  setIsPreview: Dispatch<SetStateAction<boolean>>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

let previewScrollLockCount = 0;
let previousBodyOverflow: string | null = null;

const lockPreviewScroll = () => {
  if (previewScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  previewScrollLockCount += 1;
};

const unlockPreviewScroll = () => {
  if (previewScrollLockCount === 0) {
    return;
  }

  previewScrollLockCount -= 1;

  if (previewScrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow ?? '';
    previousBodyOverflow = null;
  }
};

const PreviewContext = createContext<IPreviewContext | null>(null);

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
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isPreview) {
      return;
    }

    lockPreviewScroll();

    return () => {
      unlockPreviewScroll();
    };
  }, [isPreview]);

  return (
    <PreviewContext.Provider value={{ isPreview, setIsPreview, triggerRef }}>
      {children}
    </PreviewContext.Provider>
  );
};

interface IPreviewTriggerProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

const PreviewTrigger = ({
  children,
  className,
  ariaLabel = 'Open preview',
}: IPreviewTriggerProps) => {
  const { isPreview, setIsPreview, triggerRef } = usePreview();

  return (
    <div data-preview={isPreview} className={cn('relative', className)}>
      {children}
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isPreview}
        onClick={() => setIsPreview(true)}
        className="focus-ring absolute inset-0 z-10 cursor-pointer rounded-[inherit]"
      />
    </div>
  );
};

interface IPreviewPortalProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

interface IPreviewContentProps {
  children: React.ReactNode;
  className?: string;
}

const getFocusableElements = (container: HTMLElement) => {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
};

const PreviewContent = ({ children, className }: IPreviewContentProps) => {
  return (
    <div
      className={cn(
        'relative h-[min(72vh,36rem)] w-[min(92vw,36rem)] sm:h-[min(74vh,40rem)] sm:w-[min(90vw,40rem)] md:h-[min(78vh,48rem)] md:w-[min(86vw,58rem)]',
        className,
      )}
    >
      {children}
    </div>
  );
};

const PreviewPortal = ({
  children,
  className,
  ariaLabel = 'Image preview',
}: IPreviewPortalProps) => {
  const { isPreview, setIsPreview, triggerRef } = usePreview();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleClose = useCallback(() => {
    setIsPreview(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [setIsPreview, triggerRef]);

  const handleDialogKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const currentElement = document.activeElement;

    if (
      event.shiftKey &&
      (currentElement === firstElement || currentElement === dialogRef.current)
    ) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && currentElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, []);

  useEffect(() => {
    if (!isPreview) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleClose, isPreview]);

  if (!isPreview) {
    return null;
  }

  return createPortal(
    <div
      data-preview={isPreview}
      className={cn(
        'bg-overlay-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-4 backdrop-blur md:px-6 md:py-6',
        className,
      )}
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        className="relative flex max-h-full max-w-full flex-col items-end justify-center gap-2 md:gap-3"
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close preview"
          onClick={handleClose}
          className="focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover hover:text-overlay-control-foreground size-10"
        >
          <XIcon className="size-4.5" />
        </button>
        <PreviewContent>{children}</PreviewContent>
      </div>
    </div>,
    document.body,
  );
};

interface IPreviewImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  unoptimized?: boolean;
}

const isExternalImage = (src: string) => /^(https?:)?\/\//.test(src);

const PreviewImage = ({
  src,
  alt,
  className,
  sizes = '(max-width: 640px) 92vw, (max-width: 768px) 90vw, 86vw',
  unoptimized = isExternalImage(src),
}: IPreviewImageProps) => {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={cn('object-contain', className)}
      unoptimized={unoptimized}
    />
  );
};

export { Preview, PreviewContent, PreviewImage, PreviewPortal, PreviewTrigger };
