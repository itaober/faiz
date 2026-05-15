'use client';

import { SaveIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import { useEditMode } from '@/components/edit-mode-context';

interface IGitHubTokenDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GitHubTokenDrawer({ open, onOpenChange }: IGitHubTokenDrawerProps) {
  const { token, saveToken } = useEditMode();
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
    <Drawer.Root direction="right" open={open} onOpenChange={handleOpenChange} handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay className="bg-overlay-backdrop fixed inset-0 z-30" />
        <Drawer.Content className="bg-background border-border fixed top-0 right-0 bottom-0 z-30 flex w-[90vw] max-w-lg flex-col rounded-l-xl border outline-none">
          <Drawer.Title className="sr-only">GitHub Token Settings</Drawer.Title>
          <Drawer.Description className="sr-only">
            Save a GitHub token in localStorage for content edits.
          </Drawer.Description>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={event => {
              event.preventDefault();
              handleSave();
            }}
          >
            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-11"
                aria-label="Close settings"
              >
                <XIcon className="size-6" />
              </button>
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-11 disabled:cursor-not-allowed"
                aria-label="Save token"
              >
                <SaveIcon className="size-6" />
              </button>
            </div>

            <div className="px-4 pb-8">
              <input
                type="text"
                name="github-token-username"
                autoComplete="username"
                value="github"
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
              />
              <input
                name="github-token"
                aria-label="GitHub token"
                type="password"
                value={inputValue}
                onChange={event => setInputValue(event.target.value)}
                placeholder="github_pat_xxxxxxxxxxxxxxxxxxxx"
                autoComplete="new-password"
                autoFocus
                className="placeholder:text-muted-foreground w-full border-b bg-transparent pb-2 text-base outline-none"
              />
              <p className="text-muted-foreground mt-2 text-xs">
                GitHub / Settings / Developer settings / Personal access tokens / Fine-grained
                tokens
              </p>
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
