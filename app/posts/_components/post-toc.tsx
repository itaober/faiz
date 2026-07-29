'use client';

import { PinIcon, PinOffIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useWindowResize, useWindowScroll } from '@/hooks/use-window-event';
import { cn } from '@/lib/utils';

type TocMode = 'minimal' | 'full';

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3 | 4 | 5;
}

const STORAGE_KEY = 'faiz:toc-mode';
const VIEWPORT_PADDING = 16;
const TOC_BOTTOM_PADDING = 32;
const MIN_TOC_HEIGHT = 32;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const collectTocFromArticle = (article: HTMLElement): TocItem[] => {
  const headings = Array.from(article.querySelectorAll('h2, h3, h4, h5'));
  const slugCount = new Map<string, number>();

  return headings
    .map(node => {
      const text = node.textContent?.trim() ?? '';
      const level = Number(node.tagName.slice(1)) as 2 | 3 | 4 | 5;

      if (!text || (level !== 2 && level !== 3 && level !== 4 && level !== 5)) {
        return null;
      }

      const base = slugify(text) || 'section';
      const count = slugCount.get(base) ?? 0;
      const nextCount = count + 1;
      slugCount.set(base, nextCount);
      const fallbackId = nextCount === 1 ? base : `${base}-${nextCount}`;

      if (!node.id) {
        node.id = fallbackId;
      }

      return {
        id: node.id,
        text,
        level,
      };
    })
    .filter((item): item is TocItem => Boolean(item));
};

export default function PostToc() {
  const [mode, setMode] = useState<TocMode>(() => {
    if (typeof window === 'undefined') {
      return 'minimal';
    }
    const savedMode = localStorage.getItem(STORAGE_KEY);
    return savedMode === 'minimal' || savedMode === 'full' ? savedMode : 'minimal';
  });
  const [isReady, setIsReady] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [tocLeft, setTocLeft] = useState<number | null>(null);
  const [tocTop, setTocTop] = useState<number | null>(null);
  const [tocMaxHeight, setTocMaxHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const article = document.getElementById('post-content');
    const title = document.querySelector<HTMLElement>('[data-post-title-anchor]');
    if (!article || !title) {
      return;
    }

    const recalculateTocPosition = () => {
      const rect = article.getBoundingClientRect();
      const horizontalGap = 120;
      const rightPadding = 12;
      const tocWidth = 160;
      const preferredLeft = rect.right + horizontalGap;
      const maxLeft = window.innerWidth - tocWidth - rightPadding;
      const titleTop = Math.max(
        VIEWPORT_PADDING,
        title.getBoundingClientRect().top + window.scrollY,
      );
      const maxTop = Math.max(
        VIEWPORT_PADDING,
        window.innerHeight - TOC_BOTTOM_PADDING - MIN_TOC_HEIGHT,
      );
      const top = Math.min(titleTop, maxTop);

      setTocLeft(Math.min(preferredLeft, maxLeft));
      setTocTop(top);
      setTocMaxHeight(Math.max(1, window.innerHeight - top - TOC_BOTTOM_PADDING));
    };

    setTocItems(collectTocFromArticle(article));
    recalculateTocPosition();

    const resizeObserver = new ResizeObserver(recalculateTocPosition);
    resizeObserver.observe(article);
    resizeObserver.observe(title);
    window.addEventListener('resize', recalculateTocPosition);

    setIsReady(true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', recalculateTocPosition);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

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

  const expanded = mode === 'full';

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
  }, []);

  if (
    !isReady ||
    tocItems.length < 3 ||
    tocLeft === null ||
    tocTop === null ||
    tocMaxHeight === null
  ) {
    return null;
  }

  return (
    <motion.aside
      className="pointer-events-auto fixed z-20 hidden xl:block"
      style={{ left: tocLeft, top: tocTop }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="group flex w-40 flex-col items-stretch gap-2 rounded-lg">
        <nav
          aria-label="Table of contents"
          style={{ maxHeight: tocMaxHeight }}
          className="overflow-y-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="space-y-0.5">
            {tocItems.map(item => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={cn(
                      'focus-ring text-muted-foreground/60 hover:text-foreground flex items-center rounded-sm py-0.5 pr-1 text-[11px] transition-colors',
                      item.level === 2 && 'pl-1',
                      item.level === 3 && 'pl-1',
                      item.level === 4 && 'pl-3',
                      item.level === 5 && 'pl-5',
                      active && 'text-foreground',
                    )}
                    onClick={event => onTocLinkClick(event, item.id)}
                    aria-current={active ? 'location' : undefined}
                  >
                    {(item.level === 2 || item.level === 3) && (
                      <span className="mr-2 inline-flex w-5 shrink-0 justify-start">
                        <span
                          className={cn(
                            'block h-[3px] rounded-full transition-[width,background-color] duration-200 ease-(--ease-out)',
                            item.level === 3 ? 'w-3' : 'w-6',
                            active ? 'bg-foreground/60' : 'bg-border',
                          )}
                        />
                      </span>
                    )}
                    <span
                      className={cn(
                        'ml-1 overflow-hidden text-ellipsis whitespace-nowrap transition-opacity duration-150',
                        expanded
                          ? 'max-w-[8.5rem] opacity-100'
                          : 'max-w-0 opacity-0 group-hover:max-w-[8.5rem] group-hover:opacity-100',
                      )}
                    >
                      {item.text}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className={cn(
            'focus-ring icon-button text-muted-foreground/50 hover:text-foreground bg-muted/60 hover:bg-muted ml-1 size-6 self-start',
            'pointer-events-none opacity-0',
            'group-hover:pointer-events-auto group-hover:opacity-100',
          )}
          onClick={() => setMode(prev => (prev === 'minimal' ? 'full' : 'minimal'))}
          aria-label={mode === 'minimal' ? 'Pin table of contents open' : 'Unpin table of contents'}
        >
          {mode === 'minimal' ? (
            <PinIcon className="size-3.5" />
          ) : (
            <PinOffIcon className="size-3.5" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
