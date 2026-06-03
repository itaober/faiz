'use client';

import { AnimatePresence } from 'motion/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { useEditMode } from '@/components/edit-mode-context';

import ActionBar, { type ActionBarSession } from './action-bar';
import { EditSessionContext } from './edit-session';

/**
 * Hosts a single ActionBar instance shared by every editing surface. Surfaces
 * publish a session config (via useDockedActionBar) instead of rendering their
 * own bar, so the bar persists and its content morphs — never remounts — as the
 * active editor changes.
 */
export function EditDockProvider({ children }: { children: ReactNode }) {
  const { isEditMode } = useEditMode();
  const [session, setSession] = useState<ActionBarSession | null>(null);
  // While a mobile editor is focused, the editor renders its formatting pill in
  // this same spot — so the dock yields (cross-fades out) to avoid two pills.
  const [mobileEditing, setMobileEditing] = useState(false);

  // Leaving edit mode dismisses the bar.
  useEffect(() => {
    if (!isEditMode) {
      setSession(null);
      setMobileEditing(false);
    }
  }, [isEditMode]);

  const value = useMemo(() => ({ setSession, setMobileEditing }), []);

  return (
    <EditSessionContext.Provider value={value}>
      {children}
      <div className="fz-edit-dock">
        <AnimatePresence>
          {isEditMode && session && !mobileEditing ? (
            <ActionBar key="dock-bar" {...session} />
          ) : null}
        </AnimatePresence>
      </div>
    </EditSessionContext.Provider>
  );
}
