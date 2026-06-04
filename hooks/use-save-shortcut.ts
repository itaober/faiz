import { useEffect, useRef } from 'react';

/**
 * Run `onSave` on ⌘/Ctrl+Enter while `enabled`. The latest `onSave` is read via
 * a ref so the document listener isn't re-subscribed on every render (kept as a
 * raw ref, not a useLatest hook, so the React Compiler still sees it as stable).
 */
export function useSaveShortcut(enabled: boolean, onSave: () => void) {
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (enabled) {
          onSaveRef.current();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [enabled]);
}
