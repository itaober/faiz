'use client';

import { XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import type {
  CSSProperties,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ANIMATION } from '@/lib/constants/animation';
import { cn } from '@/lib/utils';

interface IPreviewContext {
  isPreview: boolean;
  setIsPreview: Dispatch<SetStateAction<boolean>>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

let previewScrollLockCount = 0;
let previousBodyOverflow: string | null = null;
let previousBodyPosition: string | null = null;
let previousBodyTop: string | null = null;
let previousBodyWidth: string | null = null;
let previousDocumentOverflow: string | null = null;
let previousScrollY = 0;

const lockPreviewScroll = () => {
  if (previewScrollLockCount === 0) {
    previousScrollY = window.scrollY;
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPosition = document.body.style.position;
    previousBodyTop = document.body.style.top;
    previousBodyWidth = document.body.style.width;
    previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';
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
    document.body.style.position = previousBodyPosition ?? '';
    document.body.style.top = previousBodyTop ?? '';
    document.body.style.width = previousBodyWidth ?? '';
    document.documentElement.style.overflow = previousDocumentOverflow ?? '';
    previousBodyOverflow = null;
    previousBodyPosition = null;
    previousBodyTop = null;
    previousBodyWidth = null;
    previousDocumentOverflow = null;
    window.scrollTo(0, previousScrollY);
    previousScrollY = 0;
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
  as?: 'div' | 'span';
}

const PreviewTrigger = ({
  children,
  className,
  ariaLabel = 'Open preview',
  as = 'div',
}: IPreviewTriggerProps) => {
  const { isPreview, setIsPreview, triggerRef } = usePreview();
  const Component = as;

  return (
    <Component data-preview={isPreview} className={cn('relative', className)}>
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
    </Component>
  );
};

interface IPreviewPortalProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  sidecar?: React.ReactNode;
  sidecarClassName?: string;
}

interface IPreviewContentProps {
  children: React.ReactNode;
  className?: string;
}

type SidecarPlacement = 'right' | 'bottom';

interface ISidecarLayout {
  placement: SidecarPlacement;
  style: CSSProperties;
}

const DEFAULT_SIDECAR_LAYOUT: ISidecarLayout = {
  placement: 'bottom',
  style: { marginTop: 8, width: '100%' },
};

const getContainedImageRect = (image: HTMLImageElement) => {
  const rect = image.getBoundingClientRect();
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) {
    return rect;
  }

  const imageRatio = naturalWidth / naturalHeight;
  const frameRatio = rect.width / rect.height;

  if (imageRatio > frameRatio) {
    const height = rect.width / imageRatio;
    const y = rect.top + (rect.height - height) / 2;
    return new DOMRect(rect.left, y, rect.width, height);
  }

  const width = rect.height * imageRatio;
  const x = rect.left + (rect.width - width) / 2;
  return new DOMRect(x, rect.top, width, rect.height);
};

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
        'relative h-[min(72vh,36rem)] w-[min(92vw,36rem)] sm:h-[min(74vh,40rem)] sm:w-[min(90vw,40rem)] md:h-[min(84vh,54rem)] md:w-[min(86vw,64rem)]',
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
  contentClassName,
  ariaLabel = 'Image preview',
  sidecar,
  sidecarClassName,
}: IPreviewPortalProps) => {
  const { isPreview, setIsPreview, triggerRef } = usePreview();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const hasSidecar = Boolean(sidecar);
  const [sidecarLayout, setSidecarLayout] = useState<ISidecarLayout>(DEFAULT_SIDECAR_LAYOUT);
  const sidecarPlacement = sidecarLayout.placement;

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

  useEffect(() => {
    if (!isPreview || !hasSidecar) {
      setSidecarLayout(DEFAULT_SIDECAR_LAYOUT);
      return;
    }

    let frameId = 0;

    const updatePlacement = () => {
      const frame = previewFrameRef.current;

      if (!frame) {
        return;
      }

      const content = frame.firstElementChild as HTMLElement | null;
      const image = frame.querySelector('img');
      const frameRect = frame.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect() ?? frameRect;
      const mediaRect = image ? getContainedImageRect(image) : contentRect;
      const sidecarWidth = 224;
      const sidecarGap = 16;
      const viewportPadding = 16;
      const rightSpace = window.innerWidth - mediaRect.right;
      const canPlaceRight = rightSpace >= sidecarWidth + sidecarGap + viewportPadding;

      if (canPlaceRight) {
        setSidecarLayout({
          placement: 'right',
          style: {
            left: mediaRect.right - frameRect.left + sidecarGap,
            top: mediaRect.top - frameRect.top,
            width: sidecarWidth,
          },
        });
        return;
      }

      const visibleBottomOffset = Math.max(0, contentRect.bottom - mediaRect.bottom);

      setSidecarLayout({
        placement: 'bottom',
        style: {
          marginLeft: mediaRect.left - frameRect.left,
          marginTop: 8 - visibleBottomOffset,
          width: mediaRect.width,
        },
      });
    };

    const schedulePlacement = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePlacement);
    };

    schedulePlacement();

    const resizeObserver = new ResizeObserver(schedulePlacement);
    const frame = previewFrameRef.current;
    const image = frame?.querySelector('img');

    if (frame) {
      resizeObserver.observe(frame);
    }

    image?.addEventListener('load', schedulePlacement);

    window.addEventListener('resize', schedulePlacement);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      image?.removeEventListener('load', schedulePlacement);
      window.removeEventListener('resize', schedulePlacement);
    };
  }, [hasSidecar, isPreview]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence initial={false}>
      {isPreview ? (
        <motion.div
          data-preview={isPreview}
          className={cn(
            'bg-overlay-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-4 backdrop-blur md:px-6 md:py-6',
            className,
          )}
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: ANIMATION.ease.out }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            onClick={event => event.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
            className="relative flex max-h-full max-w-full flex-col items-end justify-center gap-2 md:gap-3"
            initial={{ opacity: 0, y: ANIMATION.distance.small, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: ANIMATION.distance.minimal, scale: 0.99 }}
            transition={{ duration: 0.24, ease: ANIMATION.ease.out }}
          >
            <motion.button
              ref={closeButtonRef}
              type="button"
              aria-label="Close preview"
              onClick={handleClose}
              className="focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover hover:text-overlay-control-foreground size-11 md:size-10"
              initial={{ opacity: 0, y: -ANIMATION.distance.minimal }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -ANIMATION.distance.minimal }}
              transition={{ duration: 0.18, delay: 0.03, ease: ANIMATION.ease.out }}
            >
              <XIcon className="size-4.5" />
            </motion.button>
            {hasSidecar ? (
              <div
                className={cn(
                  'relative flex max-w-[calc(100vw-2rem)] flex-col items-center overflow-visible pb-1',
                  sidecarPlacement === 'right' && 'overflow-visible',
                )}
              >
                <div ref={previewFrameRef} className="relative shrink-0">
                  <PreviewContent className={contentClassName}>{children}</PreviewContent>
                  <motion.aside
                    style={sidecarLayout.style}
                    className={cn(
                      'text-left',
                      sidecarPlacement === 'right'
                        ? 'absolute max-h-[min(78vh,48rem)] max-w-56 overflow-y-auto'
                        : 'relative max-w-full',
                      sidecarClassName,
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: 0.04, ease: ANIMATION.ease.out }}
                  >
                    {sidecar}
                  </motion.aside>
                </div>
              </div>
            ) : (
              <PreviewContent className={contentClassName}>{children}</PreviewContent>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
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
