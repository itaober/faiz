'use client';

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, TouchEventHandler } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import Overlay from '@/components/overlay';
import { cn } from '@/lib/utils';

import { type IPreviewRect, usePreview } from './context.ts';
import {
  areRectsEqual,
  getFlipTransform,
  getFocusableElements,
  isValidRect,
  PREVIEW_CLOSE_TIMEOUT_MS,
  PREVIEW_DURATION_MS,
  PREVIEW_EASING,
  prefersReducedMotion,
  toPreviewRect,
  whenPaintable,
} from './geometry.ts';
import { useAsideLayout } from './use-aside-layout.ts';

interface IPreviewPortalProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  aside?: React.ReactNode;
  asideClassName?: string;
  targetAspectRatio?: number;
  footer?: React.ReactNode;
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
  onPrevious?: () => void;
  onNext?: () => void;
}

export const PreviewPortal = ({
  children,
  className,
  contentClassName,
  ariaLabel = 'Image preview',
  aside,
  asideClassName,
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
  const hasAside = Boolean(aside);
  const hasNavigation = Boolean(onPrevious || onNext);
  const interactive = phase === 'opening' || phase === 'open';
  const controlsVisible = phase === 'open';
  const asideLayout = useAsideLayout({
    enabled: hasAside,
    phase,
    frameRef: previewFrameRef,
  });
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
          {aside && phase === 'open' ? (
            <aside
              style={asideLayout.style}
              className={cn(
                'absolute max-w-full overflow-y-auto text-left',
                asideLayout.placement === 'right'
                  ? 'max-h-[min(78vh,48rem)] max-w-56'
                  : 'max-h-[min(30vh,16rem)]',
                asideClassName,
              )}
            >
              {aside}
            </aside>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
};
