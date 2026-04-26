export const ANIMATION = {
  duration: {
    fast: 0.16,
    normal: 0.22,
    slow: 0.28,
  },
  distance: {
    minimal: 2,
    small: 4,
    normal: 6,
    large: 8,
  },
  ease: {
    out: [0.23, 1, 0.32, 1] as const,
    inOut: [0.77, 0, 0.175, 1] as const,
    drawer: [0.32, 0.72, 0, 1] as const,
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
