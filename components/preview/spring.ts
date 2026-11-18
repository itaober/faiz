import { ANIMATION } from '@/lib/constants/animation';

/**
 * Everything in the preview moves on one spring curve: the site's stiffness, damped so it never
 * overshoots. It leaves gently and lands softly, so the eye can follow a picture across the
 * screen; an ease-out covers most of that distance within two frames, which reads as a jump.
 */
const SPRING_RATE = Math.sqrt(ANIMATION.spring.stiffness);
// How long the spring is run for, in units of its own rate: 99.5% of the way there.
const SPRING_SETTLE = 7.5;
/** A page turn takes the spring's own time: the row has a whole picture's width to cover. */
export const PREVIEW_TURN_MS = (SPRING_SETTLE / SPRING_RATE) * 1000;
/** Opening and closing answer a tap, so they play the same curve at the site's `slow` pace. */
export const PREVIEW_DURATION_MS = ANIMATION.duration.slow * 1000;

/**
 * The spring's way back to rest for something `from` px off and moving at `velocity` px/s: where
 * it is, and how fast, `seconds` later. One formula covers a page turn, a flick let go mid-drag
 * and a nudge off either end, and lets a new turn pick up exactly where the last one is.
 */
export const getSpringPath = (from: number, velocity: number) => {
  const pull = velocity + SPRING_RATE * from;
  const offsetAt = (seconds: number) => (from + pull * seconds) * Math.exp(-SPRING_RATE * seconds);
  const duration = PREVIEW_TURN_MS / 1000;
  const left = offsetAt(duration);
  return {
    // The little the spring still has left at the end is taken off along the way, so the path
    // lands exactly.
    offsetAt: (seconds: number) =>
      seconds < duration ? offsetAt(seconds) - left * (seconds / duration) : 0,
    velocityAt: (seconds: number) =>
      (velocity - SPRING_RATE * pull * seconds) * Math.exp(-SPRING_RATE * seconds),
  };
};

// The same spring from a standstill, as an easing for a flight between two poses.
const SPRING_SAMPLES = Array.from({ length: 31 }, (_, index) =>
  (1 - getSpringPath(1, 0).offsetAt((index / 30) * (PREVIEW_TURN_MS / 1000))).toFixed(4),
);
export const PREVIEW_EASING =
  typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)')
    ? `linear(${SPRING_SAMPLES.join(',')})`
    : // The closest cubic curve, for browsers without linear().
      'cubic-bezier(0.25, 0.25, 0.1, 1)';
