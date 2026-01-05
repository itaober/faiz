import { useCallback, useRef } from 'react';

interface UseConsecutiveClicksOptions {
  threshold?: number;
  timeout?: number;
  onTrigger: () => void;
}

export function useConsecutiveClicks({
  threshold = 10,
  timeout = 300,
  onTrigger,
}: UseConsecutiveClicksOptions) {
  const countRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = useCallback(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Increment count
    countRef.current += 1;

    // Check threshold
    if (countRef.current >= threshold) {
      onTrigger();
      countRef.current = 0; // Reset after trigger
    } else {
      // Set timer to reset count if next click doesn't happen soon enough
      timerRef.current = setTimeout(() => {
        countRef.current = 0;
      }, timeout);
    }
  }, [threshold, timeout, onTrigger]);

  return handleClick;
}
