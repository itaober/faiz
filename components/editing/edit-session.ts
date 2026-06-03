'use client';

import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useEffect,
  useRef,
} from 'react';

import type { ActionBarSession } from './action-bar';

interface IEditSessionContext {
  setSession: Dispatch<SetStateAction<ActionBarSession | null>>;
  /** True while a mobile editor is focused; the dock hides its action pill so the
   *  editor's formatting pill can take the same spot (they cross-fade in place). */
  setMobileEditing: (editing: boolean) => void;
}

export const EditSessionContext = createContext<IEditSessionContext>({
  setSession: () => undefined,
  setMobileEditing: () => undefined,
});

const useEditSession = () => useContext(EditSessionContext);

/** Lets the editor flag mobile-editing so the dock yields its pill slot. */
export const useSetMobileEditing = () => useContext(EditSessionContext).setMobileEditing;

/**
 * Publishes an ActionBar session to the dock while the calling surface is active.
 * Callbacks are read through a latest-ref so the bar always invokes fresh handlers
 * without the effect re-running on every render (Vercel use-latest pattern).
 * The session is replaced (not cleared) when another surface takes over, so the
 * bar morphs smoothly rather than flickering through an empty state.
 */
export function useDockedActionBar(config: ActionBarSession) {
  const { setSession } = useEditSession();
  const latest = useRef(config);
  const published = useRef<ActionBarSession | null>(null);

  useEffect(() => {
    latest.current = config;
  });

  // On unmount, clear the bar only if no other surface has taken over. Deferred
  // so a replacement (e.g. opening the memo composer) can publish first — keeping
  // the bar morphing smoothly instead of flickering through an empty state.
  useEffect(() => {
    return () => {
      const mine = published.current;
      setTimeout(() => {
        setSession(prev => (prev === mine ? null : prev));
      }, 80);
    };
  }, [setSession]);

  // Re-publish only when display-affecting fields change; callbacks are proxied
  // through the ref so they stay current without retriggering this effect.
  const signature = JSON.stringify({
    context: config.context,
    status: config.status,
    hasToken: config.hasToken,
    mode: config.mode,
    saveLabel: config.saveLabel,
    saveDisabled: config.saveDisabled,
    dirty: config.dirty,
    hasSave: !!config.onSave,
    hasMode: !!config.onModeChange,
    tools: config.tools?.map(tool => [
      // Include the icon identity so a tool that swaps its icon while keeping the
      // same label still re-publishes (otherwise the bar would show a stale icon).
      tool.icon.displayName,
      tool.label,
      tool.active,
      tool.disabled,
      tool.danger,
      tool.activeFill,
    ]),
  });

  useEffect(() => {
    const next: ActionBarSession = {
      context: latest.current.context,
      status: latest.current.status,
      hasToken: latest.current.hasToken,
      mode: latest.current.mode,
      saveLabel: latest.current.saveLabel,
      saveDisabled: latest.current.saveDisabled,
      dirty: latest.current.dirty,
      tools: latest.current.tools?.map(tool => ({
        icon: tool.icon,
        label: tool.label,
        active: tool.active,
        disabled: tool.disabled,
        danger: tool.danger,
        activeFill: tool.activeFill,
        onClick: () => latest.current.tools?.find(t => t.label === tool.label)?.onClick(),
      })),
      onConnect: () => latest.current.onConnect(),
      onModeChange: latest.current.onModeChange
        ? mode => latest.current.onModeChange?.(mode)
        : undefined,
      onExit: () => latest.current.onExit(),
      onSave: latest.current.onSave ? () => latest.current.onSave?.() : undefined,
    };
    published.current = next;
    setSession(next);
  }, [signature, setSession]);
}
