'use client';

import { useEffect } from 'react';

type Listener = () => void;
type WindowEvent = 'scroll' | 'resize';

// One shared, rAF-throttled listener per event type, fanning out to all
// subscribers — rather than every component binding (and throttling) its own
// global scroll/resize handler.
const subscribers: Record<WindowEvent, Set<Listener>> = {
  scroll: new Set(),
  resize: new Set(),
};
const bound: Record<WindowEvent, boolean> = { scroll: false, resize: false };
const ticking: Record<WindowEvent, boolean> = { scroll: false, resize: false };

const makeHandler = (type: WindowEvent) => () => {
  if (ticking[type]) {
    return;
  }
  ticking[type] = true;
  requestAnimationFrame(() => {
    ticking[type] = false;
    subscribers[type].forEach(listener => {
      listener();
    });
  });
};

const handlers: Record<WindowEvent, () => void> = {
  scroll: makeHandler('scroll'),
  resize: makeHandler('resize'),
};

/** Subscribe to a throttled window event. `listener` must be stable (useCallback). */
const useWindowEvent = (type: WindowEvent, listener: Listener) => {
  useEffect(() => {
    subscribers[type].add(listener);
    if (!bound[type]) {
      window.addEventListener(type, handlers[type], { passive: true });
      bound[type] = true;
    }
    return () => {
      subscribers[type].delete(listener);
    };
  }, [type, listener]);
};

export const useWindowScroll = (listener: Listener) => useWindowEvent('scroll', listener);
export const useWindowResize = (listener: Listener) => useWindowEvent('resize', listener);
