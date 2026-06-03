'use client';

import { EyeIcon, PlusIcon, SquarePenIcon } from 'lucide-react';
import { useState } from 'react';

import { useEditMode } from '@/components/edit-mode-context';
import type { ActionBarTool } from '@/components/editing/action-bar';
import { useDockedActionBar } from '@/components/editing/edit-session';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';

import { useRecordsInlineComposer } from './use-records-inline-composer';

/**
 * Records list action bar. Carries a browse/edit toggle: in `preview` a record
 * cover opens the lightbox; in `wysiwyg` it opens the edit side panel and the
 * "add" affordance appears. Hidden while the side panel is open (it has its own).
 */
function RecordsActionBar() {
  const { setEditMode, token } = useEditMode();
  const { mode, setMode, setComposerOpen } = useRecordsInlineComposer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isEditing = mode === 'wysiwyg';

  const tools: ActionBarTool[] = [
    {
      icon: isEditing ? EyeIcon : SquarePenIcon,
      label: isEditing ? 'Preview' : 'Edit',
      active: isEditing,
      onClick: () => setMode(isEditing ? 'preview' : 'wysiwyg'),
    },
  ];
  if (isEditing) {
    tools.push({ icon: PlusIcon, label: 'New record', onClick: () => setComposerOpen(true) });
  }

  useDockedActionBar({
    context: 'Records',
    status: 'idle',
    hasToken: !!token,
    onConnect: () => setSettingsOpen(true),
    tools,
    onExit: () => setEditMode(false),
  });

  return <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />;
}

export default function RecordsTitleActions() {
  const { isComposerOpen, editingRecordKey } = useRecordsInlineComposer();

  // While the side panel is open it carries its own actions.
  if (isComposerOpen || editingRecordKey) {
    return null;
  }

  return <RecordsActionBar />;
}
