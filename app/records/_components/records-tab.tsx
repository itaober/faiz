'use client';

import { useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  Suspense,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import { normalizeTab, type Tab } from '../_constants';

/** Set on <html> by the inline script in records/page.tsx on a hard load of `?tab=`. */
const TAB_QUERY_FLAG = 'data-records-tab-query';

const RecordsTabContext = createContext<Tab>('all');

/**
 * The only reader of `?tab=`. useSearchParams opts its subtree out of
 * prerendering, so it sits on its own boundary and renders nothing: the tabs and
 * the list prerender as the "all" tab and switch once this has read the URL. A
 * layout effect switches before the browser paints, so a client-side navigation
 * to `?tab=` never shows the "all" tab first.
 */
function TabFromUrl({ onTab }: { onTab: (tab: Tab) => void }) {
  const tab = normalizeTab(useSearchParams().get('tab'));

  useLayoutEffect(() => {
    onTab(tab);
  }, [onTab, tab]);

  return null;
}

/**
 * While unresolved, the subtree carries `data-records-tab-pending`, which
 * globals.css hides on a hard load of `?tab=` until the requested tab is in place.
 */
export function RecordsTabProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('all');
  const [resolved, setResolved] = useState(false);

  const onTab = useCallback((next: Tab) => {
    const apply = () => {
      setTab(next);
      setResolved(true);
    };
    // On a hard load the list may not have hydrated yet, and an urgent update
    // would make React drop its prerendered HTML. It is hidden until resolved, so
    // the transition costs nothing visible there.
    if (document.documentElement.hasAttribute(TAB_QUERY_FLAG)) {
      startTransition(apply);
    } else {
      apply();
    }
  }, []);

  // Left in place, the flag would hide the list again the next time /records is
  // entered client-side.
  useEffect(() => {
    if (resolved) {
      document.documentElement.removeAttribute(TAB_QUERY_FLAG);
    }
  }, [resolved]);

  return (
    <RecordsTabContext.Provider value={tab}>
      <Suspense fallback={null}>
        <TabFromUrl onTab={onTab} />
      </Suspense>
      <div data-records-tab-pending={resolved ? undefined : ''}>{children}</div>
    </RecordsTabContext.Provider>
  );
}

export const useRecordsTab = () => useContext(RecordsTabContext);
