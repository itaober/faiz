'use client';

import {
  BookmarkIcon,
  BookOpenIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  SearchIcon,
} from 'lucide-react';
import type MiniSearch from 'minisearch';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'vaul';

import Overlay from '@/components/overlay';
import Segmented, { type SegmentedOption } from '@/components/segmented';
import { isMobileViewport } from '@/hooks/use-is-mobile';
import { ANIMATION } from '@/lib/constants/animation';
import type { SearchDoc, SearchType } from '@/lib/search/types';

type SearchHit = Pick<SearchDoc, 'type' | 'title' | 'url' | 'date' | 'text' | 'rating'> & {
  id: string;
};
type Filter = 'all' | SearchType;

// Friendly labels for the record sub-categories (read from the result url's `tab`).
const RECORD_TYPE_LABEL: Record<string, string> = {
  book: 'Book',
  movie: 'Movie',
  tv: 'TV',
  music: 'Music',
  game: 'Game',
};

const TYPE_META: Record<SearchType, { label: string; plural: string; icon: typeof FileTextIcon }> =
  {
    post: { label: 'Post', plural: 'Posts', icon: FileTextIcon },
    memo: { label: 'Memo', plural: 'Memos', icon: MessageSquareTextIcon },
    record: { label: 'Record', plural: 'Records', icon: BookmarkIcon },
    page: { label: 'Page', plural: 'Pages', icon: BookOpenIcon },
  };
const FILTER_ORDER: SearchType[] = ['post', 'memo', 'record', 'page'];

// A single CJK / kana / Hangul character — languages that don't separate words
// with spaces. (CJK Ext-A, Unified, Compat ideographs, kana, Hangul syllables.)
const CJK_CHAR = /[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/;
const WORD_CHAR = /[\p{L}\p{N}]/u;

// CJK text is indexed as overlapping bigrams, so a query like "中电" matches only
// documents that contain that adjacent pair — not every doc that merely holds
// "中" and "电" somewhere apart (the old single-char tokenization over-matched).
// Latin/number runs stay whole, lowercased words. The same tokenizer runs over
// both the documents and the query, so the two stay consistent.
const tokenize = (text: string): string[] => {
  const tokens: string[] = [];
  const len = text.length;
  let i = 0;
  while (i < len) {
    const ch = text[i];
    if (CJK_CHAR.test(ch)) {
      let j = i;
      while (j < len && CJK_CHAR.test(text[j])) {
        j += 1;
      }
      const run = text.slice(i, j);
      if (run.length === 1) {
        tokens.push(run);
      } else {
        for (let k = 0; k < run.length - 1; k += 1) {
          tokens.push(run.slice(k, k + 2));
        }
      }
      i = j;
    } else if (WORD_CHAR.test(ch)) {
      let j = i;
      while (j < len && WORD_CHAR.test(text[j]) && !CJK_CHAR.test(text[j])) {
        j += 1;
      }
      tokens.push(text.slice(i, j).toLowerCase());
      i = j;
    } else {
      i += 1;
    }
  }
  return tokens;
};

// One-time, module-level index — survives palette re-opens within the session.
let index: MiniSearch<SearchDoc> | null = null;
let indexPromise: Promise<MiniSearch<SearchDoc>> | null = null;

const buildIndex = async (): Promise<MiniSearch<SearchDoc>> => {
  if (index) {
    return index;
  }
  if (!indexPromise) {
    indexPromise = (async () => {
      const [{ default: MiniSearchCtor }, res] = await Promise.all([
        import('minisearch'),
        fetch('/api/search'),
      ]);
      const { docs } = (await res.json()) as { docs: SearchDoc[] };

      const mini = new MiniSearchCtor<SearchDoc>({
        fields: ['title', 'text', 'tags'],
        storeFields: ['type', 'title', 'url', 'date', 'text', 'rating'],
        tokenize,
        // `tags` is an array → join it into one indexable string. Every other
        // field keeps its real type (e.g. numeric `rating`, optional `date`):
        // the indexed fields (title/text) are always present strings, and the
        // stored-only fields are read back as-is rather than coerced to ''.
        extractField: (doc, field) =>
          field === 'tags' ? (doc.tags ?? []).join(' ') : (doc[field as keyof SearchDoc] as string),
        searchOptions: {
          boost: { title: 3, tags: 2 },
          prefix: true,
          fuzzy: 0.2,
          combineWith: 'AND',
        },
      });
      mini.addAll(docs);
      index = mini;
      return mini;
    })();
  }
  return indexPromise;
};

/** Short excerpt around the first query hit (for sub-line / memo title). */
const snippet = (text: string, query: string, len = 80) => {
  if (!text) {
    return '';
  }
  const needle = query.trim().slice(0, 8).toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) {
    return text.length > len ? `${text.slice(0, len)}…` : text;
  }
  const start = Math.max(0, at - 16);
  const end = start + len;
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wrap occurrences of the query terms in <mark> for a subtle highlight. */
const highlight = (text: string, query: string): ReactNode => {
  const needles = Array.from(new Set(query.trim().split(/\s+/).filter(Boolean)));
  if (!text || needles.length === 0) {
    return text;
  }
  const parts = text.split(new RegExp(`(${needles.map(escapeRegExp).join('|')})`, 'gi'));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="fz-search-hl">
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

/**
 * Second line of a result: memos show their timestamp; records show
 * `category · score · date`; titled items (posts/pages) show the matching
 * excerpt. Returns null when there's nothing to show.
 */
const renderSubLine = (hit: SearchHit, query: string): ReactNode => {
  if (hit.type === 'memo') {
    return (hit.date ?? '').slice(0, 16) || null;
  }
  if (hit.type === 'record') {
    const category = new URLSearchParams(hit.url.split('?')[1] ?? '').get('tab') ?? '';
    const parts = [
      RECORD_TYPE_LABEL[category] ?? null,
      typeof hit.rating === 'number' ? hit.rating.toFixed(1) : null,
      (hit.date ?? '').slice(0, 16) || null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  }
  const excerpt = snippet(hit.text, query);
  return excerpt ? highlight(excerpt, query) : null;
};

interface ISearchCommandProps {
  onClose: () => void;
}

export default function SearchCommand({ onClose }: ISearchCommandProps) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState<boolean>(isMobileViewport);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(index != null);
  const [filter, setFilter] = useState<Filter>('all');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  // Scroll-lock is handled by <Overlay> (desktop) / vaul (mobile); here we just
  // focus the input on desktop. Mobile uses vaul's autoFocus.
  useEffect(() => {
    if (isMobile) {
      return;
    }
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(focusId);
  }, [isMobile]);

  useEffect(() => {
    let alive = true;
    buildIndex().then(() => {
      if (alive) {
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Derived during render rather than via effect+state: searching the in-memory
  // index is instant, so an extra render per keystroke is wasteful. `ready` is in
  // the deps so results recompute once the lazily-built index finishes loading.
  const results = useMemo<SearchHit[]>(() => {
    const q = query.trim();
    const idx = ready ? index : null;
    if (!q || !idx) {
      return [];
    }
    return idx.search(q).slice(0, 40) as unknown as SearchHit[];
  }, [query, ready]);

  const counts = useMemo(() => {
    const c = {} as Record<SearchType, number>;
    for (const hit of results) {
      c[hit.type] = (c[hit.type] ?? 0) + 1;
    }
    return c;
  }, [results]);

  const visible = useMemo(
    () => (filter === 'all' ? results : results.filter(hit => hit.type === filter)),
    [results, filter],
  );

  // Group visible results by type (ordered by FILTER_ORDER) so results render
  // under labelled sections instead of as a flat list with trailing type tags.
  const grouped = useMemo(() => {
    const groups: {
      type: SearchType;
      hits: { hit: SearchHit; globalIndex: number }[];
    }[] = [];
    for (const type of FILTER_ORDER) {
      const hits = visible
        .map((hit, i) => ({ hit, globalIndex: i }))
        .filter(({ hit }) => hit.type === type);
      if (hits.length > 0) {
        groups.push({ type, hits });
      }
    }
    return groups;
  }, [visible]);

  // Drop a type filter that has no matches once a search is running (a type can
  // still be pre-selected while the query is empty).
  useEffect(() => {
    if (filter !== 'all' && query.trim() && (counts[filter] ?? 0) === 0) {
      setFilter('all');
    }
  }, [counts, filter, query]);

  // Keep the active row scrolled into view during keyboard navigation.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, visible]);

  const go = (hit: SearchHit) => {
    // Posts carry the query so the article scrolls to + highlights the match;
    // records carry their id so the records page scrolls to that card; memos
    // open their own permalink page, so their url already locates them.
    const q = query.trim();
    let url = hit.url;
    if (hit.type === 'post' && q) {
      url = `${hit.url}?q=${encodeURIComponent(q)}`;
    } else if (hit.type === 'record') {
      url = `${hit.url}&focus=${encodeURIComponent(hit.id)}`;
    }
    router.push(url);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(current => Math.min(current + 1, visible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(current => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = visible[active];
      if (hit) {
        go(hit);
      }
    }
    // Escape is handled by <Overlay> (desktop) / vaul (mobile).
  };

  const hasQuery = query.trim().length > 0;

  // Counts (e.g. "Memos (3)") show only once searched; a type with no matches
  // is disabled rather than removed, so the filter row never reflows.
  const filterOptions: SegmentedOption<Filter>[] = [
    {
      value: 'all',
      label: hasQuery && results.length > 0 ? `All (${results.length})` : 'All',
    },
    ...FILTER_ORDER.map<SegmentedOption<Filter>>(type => {
      const n = counts[type] ?? 0;
      return {
        value: type,
        label: hasQuery && n > 0 ? `${TYPE_META[type].plural} (${n})` : TYPE_META[type].plural,
        disabled: hasQuery && n === 0,
      };
    }),
  ];

  const body = (
    <>
      <div className="fz-search-input-row">
        <SearchIcon className="text-muted-foreground size-[18px] shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search posts, memos, records…"
          aria-label="Search query"
        />
      </div>

      <div className="fz-search-filters">
        <Segmented
          className="fz-search-seg"
          layoutId="fz-search-filter-seg"
          options={filterOptions}
          value={filter}
          onChange={value => {
            setFilter(value);
            setActive(0);
          }}
        />
      </div>

      <div className="fz-search-results" ref={listRef}>
        {!hasQuery ? (
          <div className="text-muted-foreground my-auto p-4 text-center text-sm">
            Search posts, memos, records &amp; pages
          </div>
        ) : visible.length === 0 ? (
          <div className="text-muted-foreground my-auto p-4 text-center text-sm">
            {ready ? 'No results' : 'Searching…'}
          </div>
        ) : (
          grouped.map(group => {
            const meta = TYPE_META[group.type];
            const Icon = meta.icon;
            return (
              <div key={group.type}>
                <span className="fz-search-group-header">
                  {meta.plural} ({group.hits.length})
                </span>
                {group.hits.map(({ hit, globalIndex }) => {
                  // Memos have no title, so the matching excerpt is the primary line.
                  const primary = hit.title || snippet(hit.text, query);
                  const subNode = renderSubLine(hit, query);
                  return (
                    <button
                      key={hit.id}
                      type="button"
                      className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left data-[active=true]:bg-muted"
                      data-active={globalIndex === active || undefined}
                      onMouseEnter={() => setActive(globalIndex)}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => go(hit)}
                    >
                      <span className="text-muted-foreground/55 inline-flex size-5 shrink-0 items-center justify-center">
                        <Icon className="size-[15px]" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                            {highlight(primary || 'Untitled', query)}
                          </span>
                        </span>
                        {subNode ? (
                          <span className="text-muted-foreground min-w-0 truncate text-[13px]">
                            {subNode}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {!isMobile ? (
        <div className="fz-search-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <Drawer.Root
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAnimationEnd={open => {
          if (!open) {
            onClose();
          }
        }}
        fixed
        repositionInputs
        autoFocus
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fz-search-drawer-overlay" />
          <Drawer.Content className="fz-search-drawer" aria-describedby={undefined}>
            <Drawer.Title className="sr-only">Search</Drawer.Title>
            <Drawer.Handle className="mt-2.5 mb-1" />
            {body}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Overlay open onClose={onClose} ariaLabel="Search" className="fz-search-overlay">
      <motion.div
        className="fz-search"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: ANIMATION.duration.normal, ease: ANIMATION.ease.out }}
      >
        {body}
      </motion.div>
    </Overlay>
  );
}
