'use client';

import {
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useWindowResize, useWindowScroll } from '@/hooks/use-window-event';

interface TocItem {
  id: string;
  text: string;
  /** 0 for the shallowest heading level in the post, 1 for the next. */
  depth: 0 | 1;
}

/** Past this a column of dashes stops being a map; keep only the top level. */
const MAX_ITEMS = 20;
/** Closest the TOC may come to the body text. */
const BODY_GAP = 32;
/** Margin it needs for its dashes plus a readable run of title; any narrower and it hides. */
const MIN_ROOM = 200;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const collectTocFromArticle = (article: HTMLElement): TocItem[] => {
  const slugCount = new Map<string, number>();
  const headings = Array.from(article.querySelectorAll<HTMLElement>('h2, h3, h4, h5')).flatMap(
    node => {
      const text = node.textContent?.trim() ?? '';
      if (!text) {
        return [];
      }

      const base = slugify(text) || 'section';
      const count = (slugCount.get(base) ?? 0) + 1;
      slugCount.set(base, count);
      if (!node.id) {
        node.id = count === 1 ? base : `${base}-${count}`;
      }

      return [{ id: node.id, text, level: Number(node.tagName[1]) }];
    },
  );
  if (headings.length === 0) {
    return [];
  }

  // Two levels at most, so dash length alone tells them apart.
  const top = Math.min(...headings.map(heading => heading.level));
  const twoLevels = headings.filter(heading => heading.level <= top + 1);
  const picked =
    twoLevels.length > MAX_ITEMS ? headings.filter(heading => heading.level === top) : twoLevels;
  return picked.map(({ id, text, level }) => ({ id, text, depth: level === top ? 0 : 1 }));
};

/**
 * A column of dashes at the page's right edge, one per heading: length is the
 * level, the darker one is where you are. Resting on it a beat fades the titles
 * in beside their dashes (pure CSS, see `.fz-toc` in globals.css). Pinned at the
 * body's first line, so it never moves while you scroll.
 */
export default function PostToc() {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  // Null while the margin right of the body is too narrow to hold the TOC.
  const [bounds, setBounds] = useState<{ limit: number; top: number } | null>(null);
  const [activeId, setActiveId] = useState<string>('');

  useLayoutEffect(() => {
    const article = document.getElementById('post-content');
    if (!article) {
      return;
    }

    const measure = () => {
      const rect = article.getBoundingClientRect();
      const limit = rect.right + BODY_GAP;
      // clientWidth leaves out the scrollbar, which is no room for titles.
      const room = document.documentElement.clientWidth - limit;
      setBounds(room >= MIN_ROOM ? { limit, top: rect.top + window.scrollY } : null);
    };

    setTocItems(collectTocFromArticle(article));
    measure();

    // The root catches viewport and scrollbar changes; the title can rewrap and
    // push the body down on its own.
    const title = document.querySelector<HTMLElement>('[data-post-title-anchor]');
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(article);
    if (title) {
      resizeObserver.observe(title);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const headingsRef = useRef<HTMLElement[]>([]);

  const updateActive = useCallback(() => {
    const headings = headingsRef.current;
    if (headings.length === 0) {
      return;
    }

    const offset = 140;
    let current = headings[0].id;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= offset) {
        current = heading.id;
      } else {
        break;
      }
    }

    setActiveId(current);
  }, []);

  // Re-resolve heading elements whenever the TOC changes, then sync once.
  useEffect(() => {
    headingsRef.current = tocItems
      .map(item => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));
    updateActive();
  }, [tocItems, updateActive]);

  // Scroll-spy via the shared throttled scroll/resize listeners.
  useWindowScroll(updateActive);
  useWindowResize(updateActive);

  const onTocLinkClick = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const heading = document.getElementById(id);
    if (!heading) {
      return;
    }

    const top = heading.getBoundingClientRect().top + window.scrollY - 32;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    setActiveId(id);
    // A pointer click is done once it jumps; a lingering focus would hold the
    // titles open. Keyboard focus (detail 0) stays with the keyboard.
    if (event.detail > 0) {
      event.currentTarget.blur();
    }
  }, []);

  if (tocItems.length < 3 || bounds === null) {
    return null;
  }

  return (
    <nav
      aria-label="Table of contents"
      className="fz-toc fz-enter"
      style={
        { '--toc-limit': `${bounds.limit}px`, '--toc-top': `${bounds.top}px` } as CSSProperties
      }
    >
      {tocItems.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="fz-toc-item focus-ring"
          data-depth={item.depth}
          aria-current={item.id === activeId ? 'location' : undefined}
          onClick={event => onTocLinkClick(event, item.id)}
        >
          <span className="fz-toc-label">{item.text}</span>
          <span className="fz-toc-dash" aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}
