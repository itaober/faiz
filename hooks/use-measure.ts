'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

export interface ElementBounds {
  width: number;
  height: number;
}

const EMPTY_BOUNDS: ElementBounds = { width: 0, height: 0 };

export default function useMeasure<T extends HTMLElement = HTMLDivElement>(syncKey?: unknown) {
  const [element, setElement] = useState<T | null>(null);
  const [bounds, setBounds] = useState<ElementBounds>(EMPTY_BOUNDS);
  const ref = useCallback((node: T | null) => {
    setElement(node);
    if (!node) {
      setBounds(EMPTY_BOUNDS);
      return;
    }

    const rect = node.getBoundingClientRect();
    setBounds({ width: rect.width, height: rect.height });
  }, []);

  useLayoutEffect(() => {
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    setBounds(current =>
      current.width === rect.width && current.height === rect.height
        ? current
        : { width: rect.width, height: rect.height },
    );
  }, [element, syncKey]);

  useEffect(() => {
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const borderBox = entry.borderBoxSize?.[0];
      if (borderBox) {
        setBounds({ width: borderBox.inlineSize, height: borderBox.blockSize });
        return;
      }

      const rect = element.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds, element] as const;
}
