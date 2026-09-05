'use client';

import { KeyRoundIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useEditMode } from '@/components/edit-mode-context';
import Overlay from '@/components/overlay';

// Lucide 1.0 dropped all brand icons; this is the github glyph from 0.539 (ISC).
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

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
