'use client';

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import Image from 'next/image';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  TouchEventHandler,
} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import Overlay from '@/components/overlay';
import { ANIMATION } from '@/lib/constants/animation';
import { cn } from '@/lib/utils';

type PreviewPhase = 'closed' | 'opening' | 'open' | 'closing';

interface IPreviewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface IActiveSourceImage {
  src: string;
  currentSrc: string;
  objectFit?: CSSProperties['objectFit'];
  objectPosition?: CSSProperties['objectPosition'];
}

interface IPreviewContext {
  phase: PreviewPhase;
  phaseRef: RefObject<PreviewPhase>;
  setPhase: (phase: PreviewPhase) => void;
  isPreview: boolean;
  portalMounted: boolean;
  setPortalMounted: (mounted: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  sourceMediaRef: RefObject<HTMLElement | null>;
  originRectRef: RefObject<IPreviewRect | null>;
  mediaAspectRatio: number;
  setMediaAspectRatio: (aspectRatio: number) => void;
  sourceImages: ReadonlyMap<string, string>;
  setSourceImage: (src: string, currentSrc: string) => void;
  activeSourceImage: IActiveSourceImage | null;
  setActiveSourceImage: (image: IActiveSourceImage | null) => void;
}

const PreviewContext = createContext<IPreviewContext | null>(null);

const usePreview = () => {
  const context = useContext(PreviewContext);

  if (!context) {
    throw new Error('usePreview must be used within a Preview');
  }

  return context;
};

const PREVIEW_DURATION_MS = 280;
const PREVIEW_CLOSE_TIMEOUT_MS = 1000;
const PREVIEW_PAINT_WAIT_MS = 300;
const PREVIEW_EASING = `cubic-bezier(${ANIMATION.ease.out.join(',')})`;

const toPreviewRect = (rect: DOMRect): IPreviewRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

const isValidRect = (rect: IPreviewRect | null | undefined): rect is IPreviewRect =>
  Boolean(rect?.width && rect.height);

const getFlipTransform = (source: IPreviewRect, target: IPreviewRect) => {
  const scaleX = source.width / target.width;
  const scaleY = source.height / target.height;
  const translateX = source.left - target.left;
  const translateY = source.top - target.top;

  return `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
};

const areRectsEqual = (first: IPreviewRect, second: IPreviewRect) =>
  Math.abs(first.left - second.left) < 0.5 &&
  Math.abs(first.top - second.top) < 0.5 &&
  Math.abs(first.width - second.width) < 0.5 &&
  Math.abs(first.height - second.height) < 0.5;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Resolves once the frame's image can be painted. The portal's `<img>` is created on the same tick
 * the preview opens, so on anything slower than localhost it needs a fetch and a decode first —
 * without this wait the FLIP runs against an empty box and the media only appears once it is over.
 * Capped so a stalled image can never trap the user in a dimmed overlay whose controls are hidden.
 */
const whenPaintable = (frame: HTMLElement) => {
  const image = frame.querySelector('img');
  if (!image || typeof image.decode !== 'function') {
    return Promise.resolve();
  }

  return Promise.race([
    // decode() waits for the load too, so it covers an image that hasn't arrived yet.
    image.decode().catch(() => undefined),
    new Promise(resolve => window.setTimeout(resolve, PREVIEW_PAINT_WAIT_MS)),
  ]);
};

interface IPreviewProps {
  children: React.ReactNode;
}

const Preview = ({ children }: IPreviewProps) => {
  const [phase, setPhaseState] = useState<PreviewPhase>('closed');
  const phaseRef = useRef<PreviewPhase>('closed');
  const [portalMounted, setPortalMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const sourceMediaRef = useRef<HTMLElement | null>(null);
  const originRectRef = useRef<IPreviewRect | null>(null);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(1);
  const [sourceImages, setSourceImages] = useState<ReadonlyMap<string, string>>(new Map());
  const [activeSourceImage, setActiveSourceImage] = useState<IActiveSourceImage | null>(null);

  const setPhase = useCallback((nextPhase: PreviewPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);
  const setSourceImage = useCallback((src: string, currentSrc: string) => {
    setSourceImages(images => {
      if (images.get(src) === currentSrc) {
        return images;
      }
      return new Map(images).set(src, currentSrc);
    });
  }, []);
  const isPreview = phase === 'opening' || phase === 'open' || phase === 'closing';

  return (
    <PreviewContext.Provider
      value={{
        phase,
        phaseRef,
        setPhase,
        isPreview,
        portalMounted,
        setPortalMounted,
        triggerRef,
        sourceMediaRef,
        originRectRef,
        mediaAspectRatio,
        setMediaAspectRatio,
        sourceImages,
        setSourceImage,
        activeSourceImage,
        setActiveSourceImage,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
};

const isImageLoaded = (image: HTMLImageElement | null | undefined) =>
  Boolean(image?.complete && image.naturalWidth && image.naturalHeight);

const getReusableImageSrc = (image: HTMLImageElement | null | undefined) => {
  // currentSrc only — it is the candidate the browser actually painted, so reusing it is a cache
  // hit. `src` is next/image's fallback, which is the *largest* srcset entry (w=3840 for a box a
  // tenth that size): reusing it would fetch and decode an image the page never displayed.
  const src = image?.currentSrc;
  if (!src) {
    return undefined;
  }

  const url = new URL(src, window.location.href);
  return url.origin === window.location.origin ? `${url.pathname}${url.search}` : url.href;
};

interface IPreviewTriggerProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  as?: 'div' | 'span';
  contained?: boolean;
  previewSrc?: string;
  onOpen?: () => void;
}

const PreviewTrigger = ({
  children,
  className,
  ariaLabel = 'Open preview',
  as = 'div',
  contained = false,
  previewSrc,
  onOpen,
}: IPreviewTriggerProps) => {
  const {
    phaseRef,
    setPhase,
    isPreview,
    setPortalMounted,
    triggerRef,
    sourceMediaRef,
    originRectRef,
    setMediaAspectRatio,
    setSourceImage,
    setActiveSourceImage,
  } = usePreview();
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
    const syncSourceImage = () => {
      const aspectRatio = syncSourceAspectRatio();
      const currentSrc = getReusableImageSrc(image);
      if (aspectRatio && previewSrc && currentSrc) {
        setSourceImage(previewSrc, currentSrc);
      }
    };

    if (isImageLoaded(image)) {
      syncSourceImage();
    }
    image?.addEventListener('load', syncSourceImage);
    return () => image?.removeEventListener('load', syncSourceImage);
  }, [children, previewSrc, setSourceImage, syncSourceAspectRatio]);

  const mediaStyle = contained
    ? sourceAspectRatio >= 1
      ? { width: '100%', height: 'auto', aspectRatio: sourceAspectRatio }
      : { width: 'auto', height: '100%', aspectRatio: sourceAspectRatio }
    : undefined;
  const mediaClassName = contained ? 'absolute inset-0 m-auto block' : 'relative block w-full';
  const media = (
    <Component
      ref={element => {
        mediaRef.current = element;
      }}
      className={mediaClassName}
      style={mediaStyle}
    >
      {children}
    </Component>
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
          if (phaseRef.current !== 'closed' || !mediaRef.current) {
            return;
          }

          const sourceRect = toPreviewRect(mediaRef.current.getBoundingClientRect());
          if (!isValidRect(sourceRect)) {
            return;
          }

          triggerRef.current = buttonRef.current;
          sourceMediaRef.current = mediaRef.current;
          originRectRef.current = sourceRect;

          const aspectRatio = syncSourceAspectRatio() ?? sourceRect.width / sourceRect.height;
          setMediaAspectRatio(aspectRatio);

          const image = mediaRef.current.querySelector('img');
          const currentSrc = getReusableImageSrc(image);
          if (previewSrc && currentSrc) {
            const imageStyle = image ? getComputedStyle(image) : undefined;
            setActiveSourceImage({
              src: previewSrc,
              currentSrc,
              objectFit: imageStyle?.objectFit as CSSProperties['objectFit'],
              objectPosition: imageStyle?.objectPosition,
            });
            if (isImageLoaded(image)) {
              setSourceImage(previewSrc, currentSrc);
            }
          } else {
            setActiveSourceImage(null);
          }

          onOpen?.();
          setPortalMounted(true);
          setPhase('opening');
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
  onPrevious?: () => void;
  onNext?: () => void;
}

type SidecarPlacement = 'right' | 'bottom';

interface ISidecarLayout {
  placement: SidecarPlacement;
  style: CSSProperties;
}

const DEFAULT_SIDECAR_LAYOUT: ISidecarLayout = {
  placement: 'bottom',
  style: { left: 0, top: 'calc(100% + 8px)', width: '100%' },
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
    return new DOMRect(rect.left, rect.top + (rect.height - height) / 2, rect.width, height);
  }

  const width = rect.height * imageRatio;
  return new DOMRect(rect.left + (rect.width - width) / 2, rect.top, width, rect.height);
};

const getFocusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );

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
  const {
    phase,
    phaseRef,
    setPhase,
    isPreview,
    portalMounted,
    triggerRef,
    sourceMediaRef,
    originRectRef,
    mediaAspectRatio,
    setActiveSourceImage,
  } = usePreview();
  const anchorAspectRatio = targetAspectRatio ?? mediaAspectRatio;
  const dialogRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const mediaFrameRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const animationGenerationRef = useRef(0);
  const isReversingOpeningRef = useRef(false);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const hasSidecar = Boolean(sidecar);
  const hasNavigation = Boolean(onPrevious || onNext);
  const interactive = phase === 'opening' || phase === 'open';
  const controlsVisible = phase === 'open';
  const [sidecarLayout, setSidecarLayout] = useState<ISidecarLayout>(DEFAULT_SIDECAR_LAYOUT);
  const onPreviousRef = useRef(onPrevious);
  const onNextRef = useRef(onNext);

  useEffect(() => {
    onPreviousRef.current = onPrevious;
    onNextRef.current = onNext;
  });

  const restoreSource = useCallback(() => {
    if (sourceMediaRef.current) {
      sourceMediaRef.current.style.visibility = '';
    }
  }, [sourceMediaRef]);

  const cancelAnimation = useCallback(() => {
    animationGenerationRef.current += 1;
    animationRef.current?.cancel();
    animationRef.current = null;
    isReversingOpeningRef.current = false;
  }, []);

  const getReturnRect = useCallback(() => {
    const source = sourceMediaRef.current;
    if (source?.isConnected) {
      const liveRect = toPreviewRect(source.getBoundingClientRect());
      if (isValidRect(liveRect)) {
        return liveRect;
      }
    }
    return originRectRef.current;
  }, [originRectRef, sourceMediaRef]);

  const restoreTriggerFocus = useCallback(() => {
    const trigger = triggerRef.current;
    if (trigger?.isConnected) {
      trigger.focus({ preventScroll: true });
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && dialogRef.current?.contains(activeElement)) {
      activeElement.blur();
    }
  }, [triggerRef]);

  const finishClose = useCallback(
    (frame: HTMLDivElement | null, endTransform: string) => {
      if (phaseRef.current !== 'closing') {
        return;
      }
      if (frame) {
        frame.style.transform = endTransform;
        frame.style.willChange = '';
      }
      restoreSource();
      if (frame) {
        frame.style.visibility = 'hidden';
      }
      restoreTriggerFocus();
      originRectRef.current = null;
      sourceMediaRef.current = null;
      setActiveSourceImage(null);
      setPhase('closed');
    },
    [
      originRectRef,
      phaseRef,
      restoreSource,
      restoreTriggerFocus,
      setActiveSourceImage,
      setPhase,
      sourceMediaRef,
    ],
  );

  // Watchdog: a close that never reports back would leave the modal and the
  // scroll lock stuck, so tear down from wherever the media currently sits.
  useEffect(() => {
    if (phase !== 'closing') {
      return;
    }
    const timer = window.setTimeout(() => {
      const frame = mediaFrameRef.current;
      const endTransform = frame ? getComputedStyle(frame).transform : 'none';
      cancelAnimation();
      finishClose(frame, endTransform);
    }, PREVIEW_CLOSE_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [cancelAnimation, finishClose, phase]);

  const handleClose = useCallback(() => {
    const currentPhase = phaseRef.current;
    if ((currentPhase !== 'opening' && currentPhase !== 'open') || !mediaFrameRef.current) {
      return;
    }

    const frame = mediaFrameRef.current;
    const animation = animationRef.current;
    const returnRect = getReturnRect();
    const openingRect = originRectRef.current;

    if (
      currentPhase === 'opening' &&
      animation &&
      isValidRect(returnRect) &&
      isValidRect(openingRect) &&
      areRectsEqual(returnRect, openingRect)
    ) {
      const generation = ++animationGenerationRef.current;
      isReversingOpeningRef.current = true;
      setPhase('closing');
      animation.pause();
      animation.playbackRate = -1;
      animation.play();
      animation.finished
        .then(() => {
          if (
            animationGenerationRef.current !== generation ||
            phaseRef.current !== 'closing' ||
            !isReversingOpeningRef.current
          ) {
            return;
          }
          const endTransform = frame.style.transform;
          animationRef.current = null;
          isReversingOpeningRef.current = false;
          animation.cancel();
          finishClose(frame, endTransform);
        })
        .catch(() => undefined);
      return;
    }

    const currentTransform = getComputedStyle(frame).transform;
    frame.style.transform = currentTransform === 'none' ? 'none' : currentTransform;
    cancelAnimation();
    setPhase('closing');
  }, [cancelAnimation, finishClose, getReturnRect, originRectRef, phaseRef, setPhase]);

  useLayoutEffect(() => {
    if (phase !== 'opening' || !anchorRef.current || !mediaFrameRef.current) {
      return;
    }

    const sourceRect = originRectRef.current;
    const targetRect = toPreviewRect(anchorRef.current.getBoundingClientRect());
    if (!isValidRect(sourceRect) || !isValidRect(targetRect)) {
      restoreSource();
      setPhase('open');
      return;
    }

    const frame = mediaFrameRef.current;
    const source = sourceMediaRef.current;
    const fromTransform = getFlipTransform(sourceRect, targetRect);
    frame.style.visibility = 'visible';
    frame.style.transformOrigin = '0 0';
    frame.style.transform = fromTransform;
    frame.style.willChange = 'transform';

    const generation = ++animationGenerationRef.current;
    let cancelled = false;

    const startFlip = () => {
      if (
        cancelled ||
        animationGenerationRef.current !== generation ||
        phaseRef.current !== 'opening'
      ) {
        return;
      }

      // Hand over only now. The frame sits exactly over the source at this point, so hiding the
      // source before the frame can paint is what leaves a hole where the media should be.
      if (source) {
        source.style.visibility = 'hidden';
      }

      if (prefersReducedMotion()) {
        frame.style.transform = 'none';
        frame.style.willChange = '';
        setPhase('open');
        return;
      }

      const animation = frame.animate([{ transform: fromTransform }, { transform: 'none' }], {
        duration: PREVIEW_DURATION_MS,
        easing: PREVIEW_EASING,
        fill: 'forwards',
      });
      animationRef.current = animation;
      animation.finished
        .then(() => {
          if (animationGenerationRef.current !== generation || phaseRef.current !== 'opening') {
            return;
          }
          animationRef.current = null;
          frame.style.transform = 'none';
          frame.style.willChange = '';
          animation.cancel();
          setPhase('open');
        })
        .catch(() => undefined);
    };

    whenPaintable(frame).then(startFlip);

    return () => {
      // Stops a pending handover from hiding the source after this preview is gone.
      cancelled = true;
      if (
        animationRef.current &&
        animationGenerationRef.current === generation &&
        !isReversingOpeningRef.current
      ) {
        cancelAnimation();
      }
    };
  }, [cancelAnimation, originRectRef, phase, phaseRef, restoreSource, setPhase, sourceMediaRef]);

  useLayoutEffect(() => {
    if (
      phase !== 'closing' ||
      isReversingOpeningRef.current ||
      !anchorRef.current ||
      !mediaFrameRef.current
    ) {
      return;
    }

    const frame = mediaFrameRef.current;
    const returnRect = getReturnRect();
    const targetRect = toPreviewRect(anchorRef.current.getBoundingClientRect());
    if (!isValidRect(returnRect) || !isValidRect(targetRect)) {
      finishClose(frame, getComputedStyle(frame).transform);
      return;
    }

    // Fly home by animating the frame's box, not a transform: a scale FLIP is
    // non-uniform whenever the source box crops the media (a square cover in a
    // 2:3 cell), so the media lands visibly squashed for its final frames.
    // Box keyframes let object-fit re-crop every frame instead — together with
    // the source-crop placeholder the landing frame matches the cell exactly.
    const currentRect = toPreviewRect(frame.getBoundingClientRect());
    const fromBox = isValidRect(currentRect) ? currentRect : targetRect;
    frame.style.transform = 'none';

    const toBoxKeyframe = (rect: IPreviewRect) => ({
      left: `${rect.left - targetRect.left}px`,
      top: `${rect.top - targetRect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    if (prefersReducedMotion()) {
      finishClose(frame, 'none');
      return;
    }

    const generation = ++animationGenerationRef.current;
    const animation = frame.animate([toBoxKeyframe(fromBox), toBoxKeyframe(returnRect)], {
      duration: PREVIEW_DURATION_MS,
      easing: PREVIEW_EASING,
      fill: 'forwards',
    });
    animationRef.current = animation;
    animation.finished
      .then(() => {
        if (animationGenerationRef.current !== generation || phaseRef.current !== 'closing') {
          return;
        }
        animationRef.current = null;
        animation.cancel();
        finishClose(frame, 'none');
      })
      .catch(() => undefined);

    return () => {
      if (animationRef.current === animation) {
        cancelAnimation();
      }
    };
  }, [cancelAnimation, finishClose, getReturnRect, phase, phaseRef]);

  useLayoutEffect(() => {
    if (phase === 'open') {
      closeButtonRef.current?.focus({ preventScroll: true });
    } else if (phase === 'opening' || phase === 'closing') {
      dialogRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  const handleDialogKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus({ preventScroll: true });
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
    } else if (!event.shiftKey && currentElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, []);

  useEffect(() => {
    if (!interactive || !hasNavigation) {
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
  }, [hasNavigation, interactive]);

  useEffect(() => {
    if (phase !== 'open' || !hasSidecar || !previewFrameRef.current) {
      setSidecarLayout(DEFAULT_SIDECAR_LAYOUT);
      return;
    }

    let frameId = 0;
    const updatePlacement = () => {
      const frame = previewFrameRef.current;
      if (!frame) {
        return;
      }

      const image = frame.querySelector('img');
      const frameRect = frame.getBoundingClientRect();
      const mediaRect = image ? getContainedImageRect(image) : frameRect;
      const sidecarWidth = 224;
      const sidecarGap = 16;
      const viewportPadding = 16;
      const rightSpace = window.innerWidth - mediaRect.right;

      if (rightSpace >= sidecarWidth + sidecarGap + viewportPadding) {
        setSidecarLayout({
          placement: 'right',
          style: {
            left: mediaRect.right - frameRect.left + sidecarGap,
            top: mediaRect.top - frameRect.top,
            width: sidecarWidth,
          },
        });
      } else {
        setSidecarLayout({
          placement: 'bottom',
          style: {
            left: mediaRect.left - frameRect.left,
            top: mediaRect.bottom - frameRect.top + 8,
            width: mediaRect.width,
          },
        });
      }
    };
    const schedulePlacement = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePlacement);
    };

    schedulePlacement();
    const resizeObserver = new ResizeObserver(schedulePlacement);
    resizeObserver.observe(previewFrameRef.current);
    const image = previewFrameRef.current.querySelector('img');
    image?.addEventListener('load', schedulePlacement);
    window.addEventListener('resize', schedulePlacement);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      image?.removeEventListener('load', schedulePlacement);
      window.removeEventListener('resize', schedulePlacement);
    };
  }, [hasSidecar, phase]);

  useEffect(() => {
    return () => {
      cancelAnimation();
      restoreSource();
    };
  }, [cancelAnimation, restoreSource]);

  if (!portalMounted) {
    return null;
  }

  const previousButton = onPrevious ? (
    <button
      type="button"
      aria-label="Previous image"
      aria-hidden={!controlsVisible}
      tabIndex={controlsVisible ? 0 : -1}
      onClick={onPrevious}
      className={cn(
        'focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover absolute top-1/2 left-1 z-10 size-10 -translate-y-1/2 md:-left-[3.25rem]',
        !controlsVisible && 'invisible pointer-events-none',
      )}
    >
      <ChevronLeftIcon className="size-5" />
    </button>
  ) : null;
  const nextButton = onNext ? (
    <button
      type="button"
      aria-label="Next image"
      aria-hidden={!controlsVisible}
      tabIndex={controlsVisible ? 0 : -1}
      onClick={onNext}
      className={cn(
        'focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover absolute top-1/2 right-1 z-10 size-10 -translate-y-1/2 md:-right-[3.25rem]',
        !controlsVisible && 'invisible pointer-events-none',
      )}
    >
      <ChevronRightIcon className="size-5" />
    </button>
  ) : null;

  return (
    <Overlay
      open={isPreview}
      // Dim leaves on the first closing frame; the media keeps flying home under it.
      backdropOpen={interactive}
      onClose={handleClose}
      ariaLabel={ariaLabel}
      scrollLockMode="overflow"
      persistent
      className={cn('items-center justify-center px-4 py-4 md:px-6 md:py-6', className)}
      backdropClassName="bg-overlay-backdrop dark:backdrop-blur"
    >
      <div
        ref={dialogRef}
        role="document"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        onTouchStart={interactive ? onTouchStart : undefined}
        onTouchEnd={interactive ? onTouchEnd : undefined}
        className="relative flex max-h-full max-w-full items-center justify-center"
      >
        <div
          ref={anchorRef}
          className={cn(
            'relative max-h-[80svh] max-w-[90vw]',
            contentClassName,
            hasNavigation ? 'md:max-w-[calc(100vw-8rem)]' : 'md:max-w-[calc(100vw-7rem)]',
          )}
          style={{
            aspectRatio: anchorAspectRatio,
            // svh, not vh: iOS resolves vh against the URL-bar-hidden viewport, which is taller
            // than the fixed overlay actually gets — the close button above the media would be
            // pushed off screen.
            width: `min(90vw, ${80 * anchorAspectRatio}svh, 64rem)`,
          }}
        >
          <div ref={previewFrameRef} className="absolute inset-0">
            <div ref={mediaFrameRef} className="absolute inset-0">
              {children}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close preview"
            aria-hidden={!controlsVisible}
            tabIndex={controlsVisible ? 0 : -1}
            onClick={handleClose}
            className={cn(
              'focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover hover:text-overlay-control-foreground absolute -top-12 right-0 z-20 size-11 md:-right-12 md:size-10',
              !controlsVisible && 'invisible pointer-events-none',
            )}
          >
            <XIcon className="size-4.5" />
          </button>
          {previousButton}
          {nextButton}
          {footer ? (
            <div
              aria-hidden={!controlsVisible}
              className={cn(
                'absolute top-full left-0 mt-2 w-full',
                !controlsVisible && 'invisible',
              )}
            >
              {footer}
            </div>
          ) : null}
          {sidecar && phase === 'open' ? (
            <aside
              style={sidecarLayout.style}
              className={cn(
                'absolute max-w-full overflow-y-auto text-left',
                sidecarLayout.placement === 'right'
                  ? 'max-h-[min(78vh,48rem)] max-w-56'
                  : 'max-h-[min(30vh,16rem)]',
                sidecarClassName,
              )}
            >
              {sidecar}
            </aside>
          ) : null}
        </div>
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

const ProgressivePreviewImage = ({
  src,
  alt,
  className,
  sizes,
  unoptimized,
}: Required<IPreviewImageProps>) => {
  const { phase, activeSourceImage, sourceImages } = usePreview();
  const isActiveSource = activeSourceImage?.src === src;
  const placeholderSrc = isActiveSource ? activeSourceImage.currentSrc : sourceImages.get(src);
  const [isLoaded, setIsLoaded] = useState(false);
  // Closing keeps the source crop too, so the media flying home re-crops
  // toward the exact rendition the grid cell will show at handover.
  const preserveSourceCrop = isActiveSource && (phase === 'opening' || phase === 'closing');
  const showPlaceholder = Boolean(placeholderSrc) && (!isLoaded || preserveSourceCrop);
  const showPreview = !placeholderSrc || (isLoaded && !preserveSourceCrop);
  const placeholderStyle = preserveSourceCrop
    ? {
        objectFit: activeSourceImage?.objectFit,
        objectPosition: activeSourceImage?.objectPosition,
      }
    : undefined;

  return (
    <>
      {showPlaceholder ? (
        <Image
          src={placeholderSrc!}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className={cn('object-contain', className)}
          style={placeholderStyle}
          loading="eager"
          fetchPriority="high"
          unoptimized
        />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cn('object-contain', showPreview ? 'opacity-100' : 'opacity-0', className)}
        // This portal only exists because the user asked to see the image; nothing in it is
        // below the fold, so lazy loading would only delay the handover.
        loading="eager"
        fetchPriority="high"
        unoptimized={unoptimized}
        onLoad={() => setIsLoaded(true)}
      />
    </>
  );
};

const PreviewImage = ({
  src,
  alt,
  className = '',
  sizes = '(max-width: 640px) 92vw, (max-width: 768px) 90vw, 86vw',
  unoptimized = isExternalImage(src),
}: IPreviewImageProps) => (
  <ProgressivePreviewImage
    key={src}
    src={src}
    alt={alt}
    className={className}
    sizes={sizes}
    unoptimized={unoptimized}
  />
);

export { Preview, PreviewImage, PreviewPortal, PreviewTrigger };
