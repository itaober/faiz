'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { useEditMode } from '@/components/edit-mode-context';
import EditKeyDrawer from './edit-key-drawer';
import { useDockedActionBar } from './edit-session';

interface IPageEditBarProps {
  context: string;
  addLabel: string;
  onAdd: () => void;
}

/**
 * Page-level ActionBar session for list pages (memos / posts / records). Mounted
 * by its parent only in edit mode; publishes the + add action + exit into the
 * shared dock so the add affordance lives in the bar, not on the page.
 */
export default function PageEditBar({ context, addLabel, onAdd }: IPageEditBarProps) {
  const { setEditMode, isSignedIn } = useEditMode();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useDockedActionBar({
    context,
    status: 'idle',
    isSignedIn,
    onSignIn: () => setSettingsOpen(true),
    tools: [{ icon: PlusIcon, label: addLabel, onClick: onAdd }],
    onExit: () => setEditMode(false),
  });

  return <EditKeyDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />;
}
