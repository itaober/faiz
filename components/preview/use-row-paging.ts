import type { PanInfo } from 'motion/react';
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

import { usePreview } from './context.ts';
import { getRowView, getSlideCenter, prefersReducedMotion } from './geometry.ts';
import { getSpringPath, PREVIEW_TURN_MS } from './spring.ts';

// Past the first or last picture the row follows the finger at this fraction, then springs back.
const RUBBER_BAND = 0.3;
// How far ahead, in seconds, a flick is carried when deciding where it lands.
const FLICK_REACH = 0.12;
// A key press against either end: a nudge, in px/s, that the spring takes back.
const END_NUDGE = 600;
// Keyframes a page turn's path is cut into: one every 8ms or so, finer than a frame.
const ROW_STEPS = 48;

const subscribeToZoom = (onChange: () => void) => {
  window.visualViewport?.addEventListener('resize', onChange);
  return () => window.visualViewport?.removeEventListener('resize', onChange);
};
const isZoomedIn = () => (window.visualViewport?.scale ?? 1) > 1.01;

interface IRowPagingOptions {
  /** The picture the row is laid out around, out of `count`. */
  shown: number;
  count: number;
  /** What the picture at `shown` previews: names the thumbnail the preview flies home to. */
  shownSrc: string;
  /** Whether the row can be paged right now: the preview is open and has more than one picture. */
  active: boolean;
  onIndexChange?: (index: number) => void;
  dialogRef: RefObject<HTMLDivElement | null>;
  /** The frame the row shows through. */
  frameRef: RefObject<HTMLDivElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Pages the preview's row of pictures by arrow, key or finger. React lays the row out around the
 * picture at `shown`; this moves the row (`trackRef`) from one such layout to the next along the
 * spring, and can say where it is at any moment, so a turn, a flick and a close each pick up
 * from wherever the last one left it.
 */
export const useRowPaging = ({
  shown,
  count,
  shownSrc,
  active,
  onIndexChange,
  dialogRef,
  frameRef,
  closeButtonRef,
}: IRowPagingOptions) => {
  const { phaseRef, retargetSource } = usePreview();
  const trackRef = useRef<HTMLDivElement>(null);
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
  const showRowAt = useCallback(
    (offset: number) => {
      const frame = frameRef.current;
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
    },
    [closeButtonRef, frameRef],
  );

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
    pageRef.current = page;
  });

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
  }, [
    closeButtonRef,
    dialogRef,
    flyRow,
    getRowMotion,
    holdRow,
    phaseRef,
    retargetSource,
    shown,
    shownSrc,
  ]);

  useEffect(() => {
    // Paging only once open: the opening flight is computed for the current image's shape.
    if (!active) {
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
  }, [active]);

  useEffect(() => {
    return () => {
      flightRef.current?.animation.cancel();
    };
  }, []);

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
    const reach = (frameRef.current?.offsetWidth ?? 0) / 4;
    const target = shown + (landing < -reach ? 1 : landing > reach ? -1 : 0);
    if (target !== shown && target >= 0 && target < count) {
      flickRef.current = info.velocity.x;
      onIndexChange?.(target);
    } else {
      flyRow(heldRef.current, info.velocity.x);
    }
  };

  return {
    trackRef,
    zoomed,
    page,
    getRowMotion,
    holdRow,
    panHandlers: active
      ? { onPanStart: handlePanStart, onPan: handlePan, onPanEnd: handlePanEnd }
      : undefined,
  };
};
