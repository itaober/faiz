'use client';

import { useEffect } from 'react';

/**
 * When a record is opened from global search (`?focus=record:…`), find the card
 * carrying that key, scroll it to the center, and pulse a ring on it. The pulse
 * class is removed afterwards so the card DOM is left pristine. Falls back
 * silently (stays at the top) if no card matches — e.g. it lives under a tab
 * that isn't active.
 */
export default function RecordFocusScroll({ focusKey }: { focusKey: string }) {
  useEffect(() => {
    if (!focusKey) {
      return;
    }

    // Match by attribute-value comparison rather than a built selector: record
    // keys embed the title, which may contain quotes/brackets that would break
    // a `[data-record-key="…"]` selector.
    const findCard = () => {
      const cards = document.querySelectorAll<HTMLElement>('[data-record-key]');
      for (const card of cards) {
        if (card.dataset.recordKey === focusKey) {
          return card;
        }
      }
      return null;
    };

    // The list streams in through Suspense and cover images settle their height
    // progressively, so a single early scroll lands short; re-center a few times
    // over ~1s until the position converges, then drop the pulse class.
    let ticks = 0;
    let pulsed: HTMLElement | null = null;
    const align = () => {
      const card = findCard();
      if (card) {
        card.scrollIntoView({ block: 'center' });
        if (!pulsed) {
          card.classList.add('fz-record-focus');
          pulsed = card;
        }
      }
      ticks += 1;
      if (ticks < 5) {
        window.setTimeout(align, 250);
      } else if (pulsed) {
        const card = pulsed;
        window.setTimeout(() => card.classList.remove('fz-record-focus'), 2200);
      }
    };
    const timer = window.setTimeout(align, 150);

    return () => {
      window.clearTimeout(timer);
      pulsed?.classList.remove('fz-record-focus');
    };
  }, [focusKey]);

  return null;
}
