'use client';

import { useEffect } from 'react';

/**
 * When a post is opened from global search (`?q=…`), find the first occurrence
 * of the query inside the rendered article, scroll it to the center, and pulse
 * a highlight on it. The highlight wrapper is removed afterwards so the article
 * DOM is left pristine. Falls back silently (stays at the top) if the text
 * isn't found verbatim — e.g. when the match was in the title or a tag.
 */
export default function PostMatchScroll({ query }: { query: string }) {
  useEffect(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return;
    }

    const timer = window.setTimeout(() => {
      const root = document.getElementById('post-content');
      if (!root) {
        return;
      }

      const findMatch = (candidate: string) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const idx = (node.textContent ?? '').toLowerCase().indexOf(candidate);
          if (idx >= 0) {
            return { node: node as Text, start: idx, length: candidate.length };
          }
          node = walker.nextNode();
        }
        return null;
      };

      // First the whole query, then its leading word, so multi-word queries still land.
      const candidates = [needle, needle.split(/\s+/)[0]].filter(Boolean);
      const found = candidates.reduce<ReturnType<typeof findMatch>>(
        (hit, candidate) => hit ?? findMatch(candidate),
        null,
      );

      if (!found) {
        return;
      }

      const range = document.createRange();
      range.setStart(found.node, found.start);
      range.setEnd(found.node, found.start + found.length);

      const mark = document.createElement('mark');
      mark.className = 'fz-search-jump';
      try {
        range.surroundContents(mark);
      } catch {
        return;
      }

      // Restore the original text node once the pulse has played.
      const removeMark = () => {
        const parent = mark.parentNode;
        if (!parent) {
          return;
        }
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize();
      };

      // Re-center a few times over ~1s. Lazy-loaded images above the match settle
      // their height progressively, so a single early scroll lands short; the
      // repeated instant aligns converge on the final position.
      let ticks = 0;
      const align = () => {
        mark.scrollIntoView({ block: 'center' });
        ticks += 1;
        if (ticks < 5) {
          window.setTimeout(align, 250);
        } else {
          window.setTimeout(removeMark, 2200);
        }
      };
      align();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [query]);

  return null;
}
