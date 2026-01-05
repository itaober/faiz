'use client';

import { SaveIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import { useMemosContext } from '../_context/memos-context';

interface MemosSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MemosSettingsDrawer({ open, onOpenChange }: MemosSettingsDrawerProps) {
  const { token, saveToken } = useMemosContext();
  const [inputValue, setInputValue] = useState('');

  const handleSave = () => {
    if (!inputValue.trim()) {
      return;
    }

    saveToken(inputValue.trim());
    toast.success('Token saved');
    onOpenChange(false);
    setInputValue('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && token) {
      setInputValue(token);
    }
    onOpenChange(newOpen);
  };

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="bg-foreground/40 fixed inset-0 z-20" />
        <Drawer.Content className="bg-background border-r-none fixed top-0 right-0 bottom-0 z-20 flex w-[90vw] max-w-lg flex-col rounded-l-xl border border-gray-200 outline-none dark:border-gray-800">
          {/* Hidden title for accessibility */}
          <Drawer.Title className="sr-only">GitHub Token Settings</Drawer.Title>

          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="hover:bg-muted opacity-70 transition-colors hover:opacity-100"
            >
              <XIcon className="size-6" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!inputValue.trim()}
              className="hover:bg-muted rounded-full opacity-70 transition-colors hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Save token"
            >
              <SaveIcon className="size-6" />
            </button>
          </div>

          {/* Input area */}
          <div className="px-4 pb-8">
            <input
              type="password"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="github_pat_xxxxxxxxxxxxxxxxxxxx"
              autoFocus
              className="placeholder:text-foreground/40 w-full border-b bg-transparent pb-2 text-base outline-none"
            />
            <p className="text-foreground/70 mt-2 text-xs">
              GitHub / Settings / Developer settings / Personal access tokens / Fine-grained tokens
            </p>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
