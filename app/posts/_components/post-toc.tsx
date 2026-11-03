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
import { cn } from '@/lib/utils';

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
      style={
        { '--toc-limit': `${bounds.limit}px`, '--toc-top': `${bounds.top}px` } as CSSProperties
      }
      className={cn(
        // Only the dashes and the shown titles take the pointer, so the empty
        // margin around them never opens the titles.
        'group/toc fz-enter pointer-events-none fixed z-20 flex w-max flex-col overflow-y-auto overscroll-contain [scrollbar-width:none]',
        // The 20px dash column sits on the back-to-top button's axis (its
        // right-5 plus half its size-8), never crosses --toc-limit, and stops
        // above the button.
        'top-(--toc-top) right-[calc(2.25rem-10px)] max-h-[calc(100dvh-var(--toc-top)-4.25rem)] max-w-[calc(100%-2.25rem+10px-var(--toc-limit))]',
      )}
    >
      {tocItems.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={item.id === activeId ? 'location' : undefined}
          onClick={event => onTocLinkClick(event, item.id)}
          className="group/item focus-ring text-border hover:text-foreground focus-visible:text-foreground aria-[current=location]:text-foreground/60 grid h-6 grid-cols-[minmax(0,1fr)_20px] items-center gap-2.5 transition-colors duration-(--fz-dur-fast)"
        >
          <span
            className={cn(
              'text-foreground/50 group-hover/item:text-foreground group-focus-visible/item:text-foreground group-aria-[current=location]/item:text-foreground pointer-events-auto max-w-[14em] truncate text-[13px]',
              // Rest a beat before fading in, linger as long before fading out.
              'invisible opacity-0 transition-[opacity,visibility] delay-300 duration-(--fz-dur-fast) ease-(--ease-out)',
              'group-hover/toc:visible group-hover/toc:opacity-100 group-hover/toc:duration-(--fz-dur-morph)',
              'group-has-focus-visible/toc:visible group-has-focus-visible/toc:opacity-100',
              item.depth === 1 && 'pl-3',
            )}
          >
            {item.text}
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-auto flex h-full items-center justify-end"
          >
            <span
              className={cn('h-[3px] rounded-full bg-current', item.depth === 1 ? 'w-3.5' : 'w-5')}
            />
          </span>
        </a>
      ))}
    </nav>
  );
}
