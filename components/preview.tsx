'use client';

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import Image from 'next/image';
import type {
  CSSProperties,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
  TouchEventHandler,
} from 'react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';

import Overlay from '@/components/overlay';
import { ANIMATION } from '@/lib/constants/animation';
import { cn } from '@/lib/utils';

interface IPreviewContext {
  isPreview: boolean;
  setIsPreview: Dispatch<SetStateAction<boolean>>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  mediaAspectRatio: number;
  setMediaAspectRatio: Dispatch<SetStateAction<number>>;
  activeLayoutId: string;
  setActiveLayoutId: Dispatch<SetStateAction<string>>;
}

const PreviewContext = createContext<IPreviewContext | null>(null);

const usePreview = () => {
  const context = useContext(PreviewContext);

  if (!context) {
    throw new Error('usePreview must be used within an Preview');
  }

  return context;
};

const PREVIEW_LAYOUT_TRANSITION = {
  type: 'tween',
  duration: 0.28,
  ease: ANIMATION.ease.out,
} as const;

interface IPreviewProps {
  children: React.ReactNode;
}

const Preview = ({ children }: IPreviewProps) => {
  const [isPreview, setIsPreview] = useState(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(1);
  const [activeLayoutId, setActiveLayoutId] = useState('preview-media');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const layoutGroupId = useId();

  return (
    <PreviewContext.Provider
      value={{
        isPreview,
        setIsPreview,
        triggerRef,
        mediaAspectRatio,
        setMediaAspectRatio,
        activeLayoutId,
        setActiveLayoutId,
      }}
    >
      <LayoutGroup id={layoutGroupId}>{children}</LayoutGroup>
    </PreviewContext.Provider>
  );
};

interface IPreviewTriggerProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  as?: 'div' | 'span';
  contained?: boolean;
  layoutId?: string;
  onOpen?: () => void;
}

const PreviewTrigger = ({
  children,
  className,
  ariaLabel = 'Open preview',
  as = 'div',
  contained = false,
  layoutId = 'preview-media',
  onOpen,
}: IPreviewTriggerProps) => {
  const { isPreview, setIsPreview, triggerRef, setMediaAspectRatio, setActiveLayoutId } =
    usePreview();
  const [sourceAspectRatio, setSourceAspectRatio] = useState(1);
  const mediaRef = useRef<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const Component = as;

  const syncSourceAspectRatio = useCallback(() => {
    const image = mediaRef.current?.querySelector('img');

    if (!image?.naturalWidth || !image.naturalHeight) {
      return undefined;
    }

    const aspectRatio = image.naturalWidth / image.naturalHeight;
    setSourceAspectRatio(aspectRatio);
    return aspectRatio;
  }, []);

  useEffect(() => {
    const image = mediaRef.current?.querySelector('img');

    syncSourceAspectRatio();
    image?.addEventListener('load', syncSourceAspectRatio);
    return () => image?.removeEventListener('load', syncSourceAspectRatio);
  }, [children, syncSourceAspectRatio]);

  const mediaStyle = contained
    ? sourceAspectRatio >= 1
      ? { width: '100%', height: 'auto', aspectRatio: sourceAspectRatio }
      : { width: 'auto', height: '100%', aspectRatio: sourceAspectRatio }
    : undefined;

  const mediaClassName = contained ? 'absolute inset-0 m-auto block' : 'relative block w-full';
  const media =
    as === 'span' ? (
      <motion.span
        ref={element => {
          mediaRef.current = element;
        }}
        layoutId={layoutId}
        className={mediaClassName}
        style={mediaStyle}
        transition={{ layout: PREVIEW_LAYOUT_TRANSITION }}
      >
        {children}
      </motion.span>
    ) : (
      <motion.div
        ref={element => {
          mediaRef.current = element;
        }}
        layoutId={layoutId}
        className={mediaClassName}
        style={mediaStyle}
        transition={{ layout: PREVIEW_LAYOUT_TRANSITION }}
      >
        {children}
      </motion.div>
    );

  return (
    <Component data-preview={isPreview} className={cn('relative', className)}>
      {media}
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isPreview}
        onClick={() => {
          triggerRef.current = buttonRef.current;
          const aspectRatio = syncSourceAspectRatio();
          if (aspectRatio) {
            setMediaAspectRatio(aspectRatio);
          }
          setActiveLayoutId(layoutId);
          onOpen?.();
          setIsPreview(true);
        }}
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
  targetAspectRatio?: number;
  footer?: React.ReactNode;
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
  /** When provided, render prev/next controls (arrows + ←/→ keys) for galleries. */
  onPrevious?: () => void;
  onNext?: () => void;
}

interface IPreviewContentProps {
  children: React.ReactNode;
  className?: string;
  aspectRatio?: number;
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

const PreviewContent = ({ children, className, aspectRatio }: IPreviewContentProps) => {
  const { mediaAspectRatio, activeLayoutId } = usePreview();
  const resolvedAspectRatio = aspectRatio ?? mediaAspectRatio;

  return (
    <motion.div
      layoutId={activeLayoutId}
      className={cn('relative max-h-[82vh] max-w-[90vw]', className)}
      style={{
        aspectRatio: resolvedAspectRatio,
        width: `min(90vw, ${82 * resolvedAspectRatio}vh, 64rem)`,
      }}
      transition={{ layout: PREVIEW_LAYOUT_TRANSITION }}
    >
      {children}
    </motion.div>
  );
};

const PreviewPortal = ({
  children,
  className,
  contentClassName,
  ariaLabel = 'Image preview',
  sidecar,
  sidecarClassName,
  targetAspectRatio,
  footer,
  onTouchStart,
  onTouchEnd,
  onPrevious,
  onNext,
}: IPreviewPortalProps) => {
  const { isPreview, setIsPreview, triggerRef } = usePreview();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const closeRequestedRef = useRef(false);
  const isLayoutSettledRef = useRef(false);
  const hasSidecar = Boolean(sidecar);
  const hasNavigation = Boolean(onPrevious || onNext);
  const [sidecarLayout, setSidecarLayout] = useState<ISidecarLayout>(DEFAULT_SIDECAR_LAYOUT);
  const [isMediaSettled, setIsMediaSettled] = useState(false);
  const sidecarPlacement = sidecarLayout.placement;
  const isSidecarReady = isMediaSettled && sidecarLayout !== DEFAULT_SIDECAR_LAYOUT;
  // Latest nav callbacks for the keyboard handler without re-subscribing.
  const onPreviousRef = useRef(onPrevious);
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onPreviousRef.current = onPrevious;
    onNextRef.current = onNext;
  });

  const finishClose = useCallback(() => {
    closeRequestedRef.current = false;
    isLayoutSettledRef.current = false;
    setIsMediaSettled(false);
    setIsPreview(false);
  }, [setIsPreview]);

  const handleClose = useCallback(() => {
    if (!isLayoutSettledRef.current) {
      closeRequestedRef.current = true;
      return;
    }
    finishClose();
  }, [finishClose]);

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

  // Esc + scroll-lock are handled by <Overlay>; here we just focus the close
  // button when the lightbox opens (Tab focus-trap stays in handleDialogKeyDown).
  useEffect(() => {
    if (!isPreview) {
      return;
    }
    closeButtonRef.current?.focus();
  }, [isPreview]);

  // Arrow-key navigation for galleries.
  useEffect(() => {
    if (!isPreview || !hasNavigation) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPreviousRef.current?.();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNextRef.current?.();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isPreview, hasNavigation]);

  useEffect(() => {
    if (!isPreview) {
      return;
    }

    const timer = window.setTimeout(() => {
      isLayoutSettledRef.current = true;
      setIsMediaSettled(true);
      if (closeRequestedRef.current) {
        finishClose();
      }
    }, PREVIEW_LAYOUT_TRANSITION.duration * 1000);

    return () => window.clearTimeout(timer);
  }, [finishClose, isPreview]);

  useEffect(() => {
    if (!isPreview || !hasSidecar || !isMediaSettled) {
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
  }, [hasSidecar, isMediaSettled, isPreview]);

  return (
    <Overlay
      open={isPreview}
      onClose={handleClose}
      onExitComplete={() => triggerRef.current?.focus({ preventScroll: true })}
      ariaLabel={ariaLabel}
      scrollLockMode="overflow"
      deferScrollUnlock
      exitTimeoutMs={400}
      className={cn('items-center justify-center px-4 py-4 md:px-6 md:py-6', className)}
      backdropClassName="bg-overlay-backdrop dark:backdrop-blur"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex max-h-full max-w-full flex-col items-end justify-center gap-2 md:gap-3"
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close preview"
          onClick={handleClose}
          className="focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover hover:text-overlay-control-foreground size-11 md:size-10"
        >
          <XIcon className="size-4.5" />
        </button>
        {hasSidecar ? (
          <div
            className={cn(
              'relative flex max-w-[calc(100vw-2rem)] flex-col items-center overflow-visible pb-1',
              sidecarPlacement === 'right' && 'overflow-visible',
            )}
          >
            <div ref={previewFrameRef} className="relative shrink-0">
              <PreviewContent className={contentClassName} aspectRatio={targetAspectRatio}>
                {children}
              </PreviewContent>
              {isSidecarReady ? (
                <aside
                  style={sidecarLayout.style}
                  className={cn(
                    'text-left',
                    sidecarPlacement === 'right'
                      ? 'absolute max-h-[min(78vh,48rem)] max-w-56 overflow-y-auto'
                      : 'relative max-w-full',
                    sidecarClassName,
                  )}
                >
                  {sidecar}
                </aside>
              ) : null}
            </div>
          </div>
        ) : (
          <PreviewContent className={contentClassName} aspectRatio={targetAspectRatio}>
            {children}
          </PreviewContent>
        )}
        {footer ? <div className="w-full">{footer}</div> : null}
        {onPrevious ? (
          <button
            type="button"
            aria-label="Previous image"
            onClick={onPrevious}
            className="focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover absolute top-1/2 left-1 size-10 -translate-y-1/2 md:left-2"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
        ) : null}
        {onNext ? (
          <button
            type="button"
            aria-label="Next image"
            onClick={onNext}
            className="focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover absolute top-1/2 right-1 size-10 -translate-y-1/2 md:right-2"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        ) : null}
      </div>
    </Overlay>
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
