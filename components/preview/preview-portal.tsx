'use client';

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { motion, type PanInfo } from 'motion/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import Overlay from '@/components/overlay';
import { cn } from '@/lib/utils';

import { type IPreviewRect, usePreview } from './context.ts';
import {
  applyFlipFrame,
  areRectsEqual,
  getCoverFlip,
  getFocusableElements,
  getRevealMask,
  getRowView,
  getSlideCenter,
  getSourceLook,
  getSpringPath,
  isValidRect,
  PREVIEW_CLOSE_TIMEOUT_MS,
  PREVIEW_DURATION_MS,
  PREVIEW_EASING,
  PREVIEW_FULL_FRAME,
  PREVIEW_REVEAL,
  PREVIEW_TURN_MS,
  prefersReducedMotion,
  readFlipFrame,
  toPreviewRect,
  whenPaintable,
} from './geometry.ts';
import { useAsideLayout } from './use-aside-layout.ts';

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
// Past the first or last picture the row follows the finger at this fraction, then springs back.
const RUBBER_BAND = 0.3;
// How far ahead, in seconds, a flick is carried when deciding where it lands.
const FLICK_REACH = 0.12;
// A key press against either end: a nudge, in px/s, that the spring takes back.
const END_NUDGE = 600;
// How far into the opening flight the part a strip was hiding has fully appeared.
const REVEAL_BY = 0.4;
// Keyframes a page turn's path is cut into: one every 8ms or so, finer than a frame.
const ROW_STEPS = 48;

const getSlideWidth = (aspectRatio: number) =>
  `min(var(--preview-max-w), ${Number((80 * aspectRatio).toFixed(3))}svh, 64rem)`;

/**
 * The space between two neighbours in the row. Pictures of one width sit a gap apart; otherwise
 * they are spaced as if both were the wider one, so either can leave the frame they share
 * before the other arrives.
 */
const getSlideSpacing = (width: string, nextWidth: string) =>
  `calc(${ROW_GAP} + max(${width} - ${nextWidth}, ${nextWidth} - ${width}) / 2)`;

const subscribeToZoom = (onChange: () => void) => {
  window.visualViewport?.addEventListener('resize', onChange);
  return () => window.visualViewport?.removeEventListener('resize', onChange);
};
const isZoomedIn = () => (window.visualViewport?.scale ?? 1) > 1.01;

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
    retargetSource,
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
  const trackRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const animationGenerationRef = useRef(0);
  const isReversingOpeningRef = useRef(false);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const hasAside = Boolean(aside);
  const hasNavigation = count > 1;
  const interactive = phase === 'opening' || phase === 'open';
  const controlsVisible = phase === 'open';
  const asideLayout = useAsideLayout({
    enabled: hasAside,
    phase,
    frameRef: previewFrameRef,
  });
  const prepareReturnRef = useRef(prepareReturn);
  // The index the row is laid out around, for the handlers below that run outside render.
  const shownRef = useRef(shown);
  // A page turn on its way to rest. The row itself moves as an animation, off the main thread,
  // so nothing the page is busy with can make it stutter; `path` says where it is at any moment.
  const flightRef = useRef<{ animation: Animation; path: ReturnType<typeof getSpringPath> } | null>(
    null,
  );
  // How far off rest a finger is holding the row.
  const heldRef = useRef(0);
  // Where the row was when a finger took hold of it; false for a pan left to the browser.
  const panRef = useRef<number | false | null>(null);
  // The finger's speed as it let go, for the page turn that follows to carry on from.
  const flickRef = useRef<number | null>(null);
  // A pinched-in page pans with one finger, so sideways drags are the browser's while zoomed.
  const zoomed = useSyncExternalStore(subscribeToZoom, isZoomedIn, () => false);

  // What shows follows from how far the row sits off the picture it is laid out around. Only the
  // two pictures passing each other are in sight, inside a frame as wide as the wider of them:
  // each keeps its shape, leaving and arriving through that frame's sides, the way a strip cuts
  // on the page. The close button crosses from one picture's corner to the other's with them.
  const showRowAt = useCallback((offset: number) => {
    const frame = mediaFrameRef.current;
    const track = trackRef.current;
    const close = closeButtonRef.current;
    const current = track?.children[shownRef.current];
    if (!frame || !track || !close || !(current instanceof HTMLElement)) {
      return;
    }
    const atRest = Math.abs(offset) < 0.5;
    const view = getRowView(track.children, shownRef.current, offset);
    for (const slide of track.children as HTMLCollectionOf<HTMLElement>) {
      // At rest the classes decide.
      slide.style.visibility = atRest
        ? ''
        : slide === view.near || slide === view.far
          ? 'visible'
          : 'hidden';
    }
    const spare = atRest ? 0 : (current.offsetWidth - view.span) / 2;
    // Only the sides cut: a neighbour of another height, and its caption, show in full. At rest
    // the frame is the picture's own box, with its neighbours already painted just outside it,
    // so a page turn has nothing left to draw. A lone picture needs no frame.
    frame.style.clipPath =
      track.children.length > 1
        ? `inset(-100vh ${spare - Math.max(0, view.drift)}px -100vh ${spare + Math.min(0, view.drift)}px)`
        : '';
    const mix = (from: number, to: number) => from + (to - from) * view.blend;
    close.style.translate = atRest
      ? ''
      : `${(mix(view.near.offsetWidth, view.far.offsetWidth) - current.offsetWidth) / 2}px ${
          (current.offsetHeight - mix(view.near.offsetHeight, view.far.offsetHeight)) / 2
        }px`;
  }, []);

  const getRowMotion = useCallback(() => {
    const flight = flightRef.current;
    if (!flight) {
      return { offset: heldRef.current, velocity: 0 };
    }
    const seconds = Number(flight.animation.currentTime ?? 0) / 1000;
    return { offset: flight.path.offsetAt(seconds), velocity: flight.path.velocityAt(seconds) };
  }, []);

  /** Puts the row `offset` px off rest and keeps it there: under a finger, or back at rest. */
  const holdRow = useCallback(
    (offset: number) => {
      flightRef.current?.animation.cancel();
      flightRef.current = null;
      heldRef.current = offset;
      if (trackRef.current) {
        trackRef.current.style.transform = offset ? `translateX(${offset}px)` : '';
      }
      showRowAt(offset);
    },
    [showRowAt],
  );

  /** Lets the row go from `from` px off rest, moving at `velocity` px/s, to settle on the spring. */
  const flyRow = useCallback(
    (from: number, velocity: number) => {
      const track = trackRef.current;
      if (!track) {
        return;
      }
      holdRow(0);
      const path = getSpringPath(from, velocity);
      const animation = track.animate(
        Array.from({ length: ROW_STEPS + 1 }, (_, step) => ({
          transform: `translateX(${path.offsetAt(((step / ROW_STEPS) * PREVIEW_TURN_MS) / 1000)}px)`,
        })),
        PREVIEW_TURN_MS,
      );
      const flight = { animation, path };
      flightRef.current = flight;
      const follow = () => {
        if (flightRef.current !== flight) {
          return;
        }
        if (animation.playState === 'finished') {
          holdRow(0);
          return;
        }
        showRowAt(getRowMotion().offset);
        requestAnimationFrame(follow);
      };
      follow();
    },
    [getRowMotion, holdRow, showRowAt],
  );

  const page = (direction: -1 | 1) => {
    const target = shown + direction;
    if (target >= 0 && target < count) {
      onIndexChange?.(target);
    } else if (!prefersReducedMotion()) {
      flyRow(0, -direction * END_NUDGE);
    }
  };
  const pageRef = useRef(page);

  useEffect(() => {
    prepareReturnRef.current = prepareReturn;
    pageRef.current = page;
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

  // The row has just been laid out around another picture. It is put back where it was showing
  // and left to settle from there, so a page turn, a flick, and a turn taken mid-turn are all
  // one continuous slide.
  useLayoutEffect(() => {
    const from = shownRef.current;
    shownRef.current = shown;
    const track = trackRef.current;
    if (from === shown || phaseRef.current !== 'open' || !track) {
      return;
    }
    retargetSource(shownSrc);
    // An arrow that has run out of pictures hides, and would take the focus with it.
    if (dialogRef.current?.querySelector('[aria-hidden="true"]:focus')) {
      closeButtonRef.current?.focus({ preventScroll: true });
    }

    const { offset, velocity } = getRowMotion();
    const flick = flickRef.current;
    flickRef.current = null;
    const last = track.children[from];
    const next = track.children[shown];
    if (
      !(last instanceof HTMLElement) ||
      !(next instanceof HTMLElement) ||
      prefersReducedMotion()
    ) {
      holdRow(0);
      return;
    }
    flyRow(offset + getSlideCenter(next) - getSlideCenter(last), flick ?? velocity);
  }, [flyRow, getRowMotion, holdRow, phaseRef, retargetSource, shown, shownSrc]);

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
    // Paging only once open: the opening flight is computed for the current image's shape.
    if (!controlsVisible || !hasNavigation) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        pageRef.current(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        pageRef.current(1);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [controlsVisible, hasNavigation]);

  useEffect(() => {
    return () => {
      flightRef.current?.animation.cancel();
      cancelAnimation();
      restoreSource();
    };
  }, [cancelAnimation, restoreSource]);

  // A finger moves the row directly; letting go hands its speed to the spring.
  const handlePanStart = (event: PointerEvent, info: PanInfo) => {
    const sideways = Math.abs(info.offset.x) > Math.abs(info.offset.y);
    if (event.pointerType === 'mouse' || zoomed || !sideways) {
      panRef.current = false;
      return;
    }
    const { offset } = getRowMotion();
    holdRow(offset);
    panRef.current = offset;
  };

  const handlePan = (_event: PointerEvent, info: PanInfo) => {
    const origin = panRef.current;
    if (typeof origin !== 'number') {
      return;
    }
    const offset = origin + info.offset.x;
    const pastEnd = offset > 0 ? shown === 0 : shown === count - 1;
    holdRow(pastEnd ? offset * RUBBER_BAND : offset);
  };

  const handlePanEnd = (_event: PointerEvent, info: PanInfo) => {
    const origin = panRef.current;
    panRef.current = null;
    if (typeof origin !== 'number') {
      return;
    }
    // Turns the page when the drag, carried on by its speed, would end past a quarter of the frame.
    const landing = heldRef.current + info.velocity.x * FLICK_REACH;
    const reach = (mediaFrameRef.current?.offsetWidth ?? 0) / 4;
    const target = shown + (landing < -reach ? 1 : landing > reach ? -1 : 0);
    if (target !== shown && target >= 0 && target < count) {
      flickRef.current = info.velocity.x;
      onIndexChange?.(target);
    } else {
      flyRow(heldRef.current, info.velocity.x);
    }
  };

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
  const pannable = hasNavigation && controlsVisible;

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
        onPanStart={pannable ? handlePanStart : undefined}
        onPan={pannable ? handlePan : undefined}
        onPanEnd={pannable ? handlePanEnd : undefined}
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
