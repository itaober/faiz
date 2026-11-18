'use client';

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import Overlay from '@/components/overlay';
import { cn } from '@/lib/utils';

import { type IPreviewRect, usePreview } from './context.ts';
import {
  applyFlipFrame,
  areRectsEqual,
  getCoverFlip,
  getFocusableElements,
  getRevealMask,
  getSourceLook,
  isValidRect,
  PREVIEW_CLOSE_TIMEOUT_MS,
  PREVIEW_FULL_FRAME,
  PREVIEW_REVEAL,
  prefersReducedMotion,
  readFlipFrame,
  toPreviewRect,
  whenPaintable,
} from './geometry.ts';
import { PREVIEW_DURATION_MS, PREVIEW_EASING } from './spring.ts';
import { useAsideLayout } from './use-aside-layout.ts';
import { useRowPaging } from './use-row-paging.ts';

/** One picture of a row the preview pages through. */
export interface IPreviewSlide {
  /** What its trigger previews (`previewSrc`): names the slide and the thumbnail it flies home to. */
  src: string;
  aspectRatio?: number;
  media: React.ReactNode;
  footer?: React.ReactNode;
}

interface IPreviewPortalProps {
  /** The media, when the preview shows one thing. */
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  aside?: React.ReactNode;
  asideClassName?: string;
  targetAspectRatio?: number;
  footer?: React.ReactNode;
  /**
   * A row to page through, in place of `children`: the pictures sit side by side as they do on
   * the page, and `index` is the one in the frame.
   */
  slides?: IPreviewSlide[];
  index?: number;
  onIndexChange?: (index: number) => void;
  /**
   * Runs as the media starts flying home, so a container that cuts part of the source off (a
   * sideways strip) can bring it into view first; returns where the source will sit once it has.
   */
  prepareReturn?: (source: HTMLElement) => IPreviewRect | undefined;
}

// Wide screens keep the arrows beside the media, on the backdrop; a narrow window has no room, so
// there they sit on the photo and need a chip that reads over any image. Touch pages by swiping,
// so there the arrows are kept for screen readers only.
const NAV_BUTTON =
  'focus-ring-overlay icon-button bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover pointer-events-auto absolute top-0 size-10 -translate-y-1/2 max-md:bg-surface/90 max-md:text-foreground max-md:shadow-(--fz-shadow-md) pointer-coarse:sr-only';

// The space between neighbouring pictures as they pass through the frame.
const ROW_GAP = '1rem';
// How far into the opening flight the part a strip was hiding has fully appeared.
const REVEAL_BY = 0.4;

const getSlideWidth = (aspectRatio: number) =>
  `min(var(--preview-max-w), ${Number((80 * aspectRatio).toFixed(3))}svh, 64rem)`;

/**
 * The space between two neighbours in the row. Pictures of one width sit a gap apart; otherwise
 * they are spaced as if both were the wider one, so either can leave the frame they share
 * before the other arrives.
 */
const getSlideSpacing = (width: string, nextWidth: string) =>
  `calc(${ROW_GAP} + max(${width} - ${nextWidth}, ${nextWidth} - ${width}) / 2)`;

const clearReveal = (frame: HTMLElement) => {
  frame.style.maskImage = '';
  frame.style.removeProperty(PREVIEW_REVEAL);
};

/** At rest when open: no transform, clip or mask, so nothing costs a compositing pass. */
const settleOpen = (frame: HTMLElement) => {
  frame.style.transform = 'none';
  frame.style.clipPath = '';
  frame.style.willChange = '';
  clearReveal(frame);
};

export const PreviewPortal = ({
  children,
  className,
  contentClassName,
  ariaLabel = 'Image preview',
  aside,
  asideClassName,
  targetAspectRatio,
  footer,
  slides,
  index = 0,
  onIndexChange,
  prepareReturn,
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
  const row = slides ?? [{ src: '', aspectRatio: targetAspectRatio, media: children, footer }];
  const count = row.length;
  const shown = Math.min(Math.max(index, 0), count - 1);
  const shownSrc = row[shown].src;
  const widths = row.map(slide => getSlideWidth(slide.aspectRatio ?? mediaAspectRatio));
  const anchorAspectRatio = row[shown].aspectRatio ?? mediaAspectRatio;
  const dialogRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const mediaFrameRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const animationGenerationRef = useRef(0);
  const isReversingOpeningRef = useRef(false);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const hasAside = Boolean(aside);
  const hasNavigation = count > 1;
  const interactive = phase === 'opening' || phase === 'open';
  const controlsVisible = phase === 'open';
  const pannable = hasNavigation && controlsVisible;
  const asideLayout = useAsideLayout({
    enabled: hasAside,
    phase,
    frameRef: previewFrameRef,
  });
  const prepareReturnRef = useRef(prepareReturn);
  const { trackRef, zoomed, page, getRowMotion, holdRow, panHandlers } = useRowPaging({
    shown,
    count,
    shownSrc,
    active: pannable,
    onIndexChange,
    dialogRef,
    frameRef: mediaFrameRef,
    closeButtonRef,
  });

  useEffect(() => {
    prepareReturnRef.current = prepareReturn;
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

    // A page turn or a drag stops where it is, and the picture flies home from there.
    const { offset } = getRowMotion();
    holdRow(0);
    if (offset) {
      frame.style.transform = `translateX(${offset}px)`;
    }
    // Freezes the pose the media is in now (fully open, mid-opening or mid-page) as the close's
    // start.
    applyFlipFrame(frame, readFlipFrame(getComputedStyle(frame)));
    clearReveal(frame);
    cancelAnimation();
    setPhase('closing');
  }, [
    cancelAnimation,
    finishClose,
    getReturnRect,
    getRowMotion,
    holdRow,
    originRectRef,
    phaseRef,
    setPhase,
  ]);

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
    const look = getSourceLook(source);
    const from = getCoverFlip(sourceRect, targetRect, look);
    // A picture a strip half hides still lifts whole, at its own shape; only its hidden part
    // waits behind a mask and dissolves in over the first stretch of the flight.
    const reveal = source ? getRevealMask(source, sourceRect, targetRect, look) : undefined;
    frame.style.visibility = 'visible';
    frame.style.transformOrigin = '0 0';
    applyFlipFrame(frame, from);
    frame.style.maskImage = reveal ?? '';
    frame.style.setProperty(PREVIEW_REVEAL, '0');
    frame.style.willChange = 'transform, clip-path';

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
        settleOpen(frame);
        setPhase('open');
        return;
      }

      const animation = frame.animate(
        [
          { ...from, [PREVIEW_REVEAL]: 0 },
          { [PREVIEW_REVEAL]: 1, offset: REVEAL_BY },
          { ...PREVIEW_FULL_FRAME, [PREVIEW_REVEAL]: 1 },
        ],
        { duration: PREVIEW_DURATION_MS, easing: PREVIEW_EASING, fill: 'forwards' },
      );
      animationRef.current = animation;
      animation.finished
        .then(() => {
          if (animationGenerationRef.current !== generation || phaseRef.current !== 'opening') {
            return;
          }
          animationRef.current = null;
          settleOpen(frame);
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
    if (prefersReducedMotion()) {
      finishClose(frame, 'none');
      return;
    }

    const source = sourceMediaRef.current;
    const returnRect =
      (source?.isConnected && prepareReturnRef.current?.(source)) || getReturnRect();
    const targetRect = toPreviewRect(anchorRef.current.getBoundingClientRect());
    if (!isValidRect(returnRect) || !isValidRect(targetRect)) {
      finishClose(frame, getComputedStyle(frame).transform);
      return;
    }

    // Starts from the pose handleClose froze.
    const from = readFlipFrame(frame.style);
    const to = getCoverFlip(returnRect, targetRect, getSourceLook(source));
    frame.style.transformOrigin = '0 0';
    frame.style.willChange = 'transform, clip-path';

    const generation = ++animationGenerationRef.current;
    const animation = frame.animate([from, to], {
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
        applyFlipFrame(frame, to);
        finishClose(frame, to.transform);
      })
      .catch(() => undefined);

    return () => {
      if (animationRef.current === animation) {
        cancelAnimation();
      }
    };
  }, [cancelAnimation, finishClose, getReturnRect, phase, phaseRef, sourceMediaRef]);

  useLayoutEffect(() => {
    if (phase === 'open') {
      closeButtonRef.current?.focus({ preventScroll: true });
      // The neighbours join the row in this render; the frame goes up around the picture before
      // they can be seen.
      holdRow(0);
    } else if (phase === 'opening' || phase === 'closing') {
      dialogRef.current?.focus({ preventScroll: true });
    }
  }, [holdRow, phase]);

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
    return () => {
      cancelAnimation();
      restoreSource();
    };
  }, [cancelAnimation, restoreSource]);

  if (!portalMounted) {
    return null;
  }

  const hidden = 'invisible pointer-events-none opacity-0';
  const navButtons = ([-1, 1] as const).map(direction => {
    const Icon = direction < 0 ? ChevronLeftIcon : ChevronRightIcon;
    const off = !controlsVisible || (direction < 0 ? shown === 0 : shown === count - 1);
    return (
      <button
        key={direction}
        type="button"
        aria-label={direction < 0 ? 'Previous image' : 'Next image'}
        aria-hidden={off}
        tabIndex={off ? -1 : 0}
        onClick={() => page(direction)}
        className={cn(
          NAV_BUTTON,
          direction < 0 ? 'left-1 md:-left-15' : 'right-1 md:-right-15',
          off && hidden,
        )}
      >
        <Icon className="size-5" />
      </button>
    );
  });

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
      <motion.div
        ref={dialogRef}
        role="document"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        {...panHandlers}
        // Sideways drags are ours; pinching stays the browser's.
        style={{ touchAction: hasNavigation && !zoomed ? 'pan-y pinch-zoom' : undefined }}
        // Focus only parks here while the media flies; a ring would trace the box mid-flight.
        className="relative flex max-h-full max-w-full items-center justify-center outline-none"
      >
        <div
          ref={anchorRef}
          className={cn(
            'relative [--preview-max-w:90vw]',
            contentClassName,
            hasNavigation
              ? 'md:[--preview-max-w:min(90vw,calc(100vw_-_8rem))]'
              : 'md:[--preview-max-w:min(90vw,calc(100vw_-_7rem))]',
          )}
          // svh, not vh: iOS resolves vh against the URL-bar-hidden viewport, which is taller
          // than the fixed overlay actually gets — the close button above the media would be
          // pushed off screen.
          style={{ aspectRatio: anchorAspectRatio, width: getSlideWidth(anchorAspectRatio) }}
        >
          <div ref={previewFrameRef} className="absolute inset-0">
            <div ref={mediaFrameRef} className="absolute inset-0">
              {/* Every picture of the row at the size it would be shown, side by side; the one
                  in the frame is offset to land exactly on it. */}
              <div
                ref={trackRef}
                // Laid out only: clicks beside the picture fall through to the backdrop. Its own
                // layer while it can be paged, so a turn starts without a repaint.
                className={cn(
                  'pointer-events-none absolute top-0 flex h-full items-center',
                  pannable && 'will-change-transform',
                )}
                style={{
                  left: `calc(0px - ${
                    widths
                      .slice(0, shown)
                      .map((width, at) => `${width} - ${getSlideSpacing(width, widths[at + 1])}`)
                      .join(' - ') || '0px'
                  })`,
                }}
              >
                {row.map((slide, slideIndex) => {
                  const isShown = slideIndex === shown;
                  // The neighbours are drawn ahead of time, just outside the frame.
                  const isDrawn = phase === 'open' && Math.abs(slideIndex - shown) <= 1;
                  return (
                    <div
                      key={slide.src}
                      aria-hidden={isShown ? undefined : true}
                      className={cn(
                        'relative shrink-0',
                        isShown && 'pointer-events-auto',
                        !isShown && !isDrawn && 'invisible',
                      )}
                      style={{
                        aspectRatio: slide.aspectRatio ?? mediaAspectRatio,
                        width: widths[slideIndex],
                        marginLeft: slideIndex
                          ? getSlideSpacing(widths[slideIndex - 1], widths[slideIndex])
                          : undefined,
                      }}
                    >
                      {/* Only the picture asked for takes part in the flight; the rest join once
                          it has landed. */}
                      {isShown || phase === 'open' ? slide.media : null}
                      {slide.footer ? (
                        <div
                          className={cn(
                            'pointer-events-none absolute top-full left-0 mt-2 w-full transition-opacity duration-(--fz-dur-normal)',
                            isShown && !controlsVisible && 'invisible opacity-0',
                          )}
                        >
                          {slide.footer}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
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
              !controlsVisible && hidden,
            )}
          >
            <XIcon className="size-4.5" />
          </button>
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
        {hasNavigation ? (
          // Sized to the widest frame any image gets (the anchor's width cap), so on wide screens
          // the arrows sit outside every image and stay put while paging between shapes.
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-0 w-[min(90vw,64rem)] -translate-x-1/2 md:w-[min(90vw,calc(100vw-8rem),64rem)]">
            {navButtons}
          </div>
        ) : null}
      </motion.div>
    </Overlay>
  );
};
