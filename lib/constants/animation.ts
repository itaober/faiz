export const ANIMATION = {
  duration: {
    fast: 0.15,
    normal: 0.25,
    slow: 0.35,
  },
  distance: {
    minimal: 2,
    small: 4,
    normal: 6,
    large: 8,
  },
  ease: {
    out: [0.25, 0.46, 0.45, 0.94] as const,
    in: [0.55, 0.085, 0.68, 0.53] as const,
    inOut: [0.455, 0.03, 0.515, 0.955] as const,
  },
  spring: {
    stiffness: 400,
    damping: 30,
  },
  stagger: {
    fast: 0.03,
    normal: 0.05,
    slow: 0.08,
  },
} as const;
