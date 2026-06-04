'use client';

import { useEffect, useState } from 'react';

/**
 * `true` only after the first client render. Use it to gate client-only UI
 * (e.g. edit affordances) so the server/client markup matches on hydration.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
