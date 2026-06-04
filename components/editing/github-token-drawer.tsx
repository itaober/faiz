'use client';

import { GithubIcon, KeyRoundIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useEditMode } from '@/components/edit-mode-context';
import Overlay from '@/components/overlay';

interface IGitHubTokenDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Connect to save" sheet. Surfaced on demand when a save needs a GitHub token,
 * rather than hidden behind a gear. The token is stored once in an httpOnly
 * cookie (via {@link useEditMode}); the client only ever holds a sentinel.
 */
export default function GitHubTokenDrawer({ open, onOpenChange }: IGitHubTokenDrawerProps) {
  const { token, saveToken } = useEditMode();
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue('');
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const handleSave = async () => {
    if (!inputValue.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await saveToken(inputValue.trim());
      toast.success('Connected');
      onOpenChange(false);
      setInputValue('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save token');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={() => onOpenChange(false)}
      ariaLabel="Connect to save"
      className="items-center justify-center bg-[color-mix(in_oklch,black_8%,transparent)] p-4"
    >
      <form
        className="fz-sheet relative"
        onSubmit={async event => {
          event.preventDefault();
          await handleSave();
        }}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="fz-iconbtn absolute top-3 right-3"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </button>

        <span className="bg-muted text-foreground inline-flex size-11 items-center justify-center rounded-full">
          <KeyRoundIcon className="size-5" />
        </span>
        <h3>Connect to save</h3>
        <p>
          Saving writes to your content repo. Paste a GitHub token once — it stays in this browser.
        </p>

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
        <div className="fz-token-field">
          <GithubIcon className="text-muted-foreground size-[15px] shrink-0" />
          <input
            ref={inputRef}
            name="github-token"
            aria-label="GitHub token"
            type="password"
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            placeholder="github_pat_••••••••••••"
            autoComplete="new-password"
          />
          <button
            type="submit"
            className="fz-btn fz-btn-primary"
            style={{ height: 32 }}
            disabled={isSaving || !inputValue.trim()}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-muted-foreground/80 mt-3 mb-0 text-xs">
          {token
            ? 'Token saved. Paste a new token to replace it.'
            : 'GitHub → Settings → Developer settings → Fine-grained tokens'}
        </p>
      </form>
    </Overlay>
  );
}
