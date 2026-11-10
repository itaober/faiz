'use client';

import { KeyRoundIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useEditMode } from '@/components/edit-mode-context';
import Overlay from '@/components/overlay';

interface IEditKeyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Sign in to save" sheet. Surfaced on demand when a save needs an edit session, rather than
 * hidden behind a gear. The key is sent once; the session lives in an httpOnly cookie (via
 * {@link useEditMode}), so the client never holds a credential.
 */
export default function EditKeyDrawer({ open, onOpenChange }: IEditKeyDrawerProps) {
  const { signIn } = useEditMode();
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
      await signIn(inputValue.trim());
      toast.success('Signed in');
      onOpenChange(false);
      setInputValue('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={() => onOpenChange(false)}
      ariaLabel="Sign in to save"
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
        <h3>Enter your edit key</h3>
        <p>You only need it once in this browser.</p>

        {/* A fixed username lets password managers save and fill the key like a login. */}
        <input
          type="text"
          name="edit-key-username"
          autoComplete="username"
          value="editor"
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        />
        <div className="fz-key-field">
          <input
            ref={inputRef}
            name="edit-key"
            aria-label="Edit key"
            type="password"
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            placeholder="Edit key"
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="fz-btn fz-btn-primary"
            style={{ height: 32 }}
            disabled={isSaving || !inputValue.trim()}
          >
            {isSaving ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
