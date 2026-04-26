'use client';

import { Columns2Icon } from 'lucide-react';
import { motion } from 'motion/react';
import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type TocMode = 'minimal' | 'full';

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3 | 4 | 5;
}

const STORAGE_KEY = 'faiz:toc-mode';

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

  useLayoutEffect(() => {
    const article = document.getElementById('post-content');
    if (!article) {
      return;
    }

    const recalculateTocLeft = () => {
      const rect = article.getBoundingClientRect();
      const horizontalGap = 120;
      const rightPadding = 12;
      const tocWidth = 160;
      const preferredLeft = rect.right + horizontalGap;
      const maxLeft = window.innerWidth - tocWidth - rightPadding;
      setTocLeft(Math.min(preferredLeft, maxLeft));
    };

    setTocItems(collectTocFromArticle(article));
    recalculateTocLeft();

    const resizeObserver = new ResizeObserver(recalculateTocLeft);
    resizeObserver.observe(article);
    window.addEventListener('resize', recalculateTocLeft);

    setIsReady(true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', recalculateTocLeft);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (tocItems.length === 0) {
      return;
    }

    const headings = tocItems
      .map(item => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (headings.length === 0) {
      return;
    }

    const updateActive = () => {
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
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(() => {
        updateActive();
        ticking = false;
      });
    };

    updateActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [tocItems]);

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

  if (!isReady || tocItems.length < 3 || tocLeft === null) {
    return null;
  }

  return (
    <motion.aside
      className="pointer-events-auto fixed top-56 z-20 hidden xl:block"
      style={{ left: tocLeft }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="group flex w-40 flex-col items-stretch gap-2 rounded-lg">
        <nav aria-label="Table of contents" className="px-1 py-1">
          <ul className="space-y-1.5">
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
                        expanded ? 'max-w-[8.5rem] opacity-100' : 'max-w-0 opacity-0',
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
            'focus-ring text-muted-foreground/45 hover:text-muted-foreground/90 border-border/45 bg-background/65 hover:border-border/70 hover:bg-background/85 ml-1 inline-flex items-center justify-start gap-1 self-start rounded-full border px-1.5 py-0.5 backdrop-blur-sm transition-colors',
            'pointer-events-none opacity-0',
            'group-hover:pointer-events-auto group-hover:opacity-100',
          )}
          onClick={() => setMode(prev => (prev === 'minimal' ? 'full' : 'minimal'))}
          aria-label={
            mode === 'minimal' ? 'Expand table of contents' : 'Collapse table of contents'
          }
        >
          <Columns2Icon className="size-3" />
          <span className="text-[10px] leading-none tracking-wide">
            {mode === 'minimal' ? 'Minimal' : 'Expanded'}
          </span>
        </button>
      </div>
    </motion.aside>
  );
}
