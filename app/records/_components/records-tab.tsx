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
  useState,
} from 'react';

import { normalizeTab, type Tab } from '../_constants';

interface IRecordsTabState {
  tab: Tab;
  /** False until the URL has been read; the prerendered "all" view is shown until then. */
  resolved: boolean;
}

const RecordsTabContext = createContext<IRecordsTabState>({ tab: 'all', resolved: false });

/**
 * The only reader of `?tab=`. useSearchParams opts its subtree out of
 * prerendering, so it sits on its own boundary and renders nothing: the tabs and
 * the list prerender as the "all" tab and switch once this has read the URL.
 */
function TabFromUrl({ onTab }: { onTab: (tab: Tab) => void }) {
  const tab = normalizeTab(useSearchParams().get('tab'));

  // A transition lets React finish hydrating the prerendered list before the
  // switch reaches it; an urgent update would discard that HTML and re-render it.
  useEffect(() => {
    startTransition(() => onTab(tab));
  }, [onTab, tab]);

  return null;
}

/**
 * While unresolved, the subtree carries `data-records-tab-pending`. The inline
 * script in records/page.tsx hides it before first paint when the URL asks for
 * another tab, so a hard load of `?tab=` never flashes the "all" tab.
 */
export function RecordsTabProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IRecordsTabState>({ tab: 'all', resolved: false });
  const onTab = useCallback((tab: Tab) => setState({ tab, resolved: true }), []);

  return (
    <RecordsTabContext.Provider value={state}>
      <Suspense fallback={null}>
        <TabFromUrl onTab={onTab} />
      </Suspense>
      <div data-records-tab-pending={state.resolved ? undefined : ''}>{children}</div>
    </RecordsTabContext.Provider>
  );
}

export const useRecordsTab = () => useContext(RecordsTabContext);
