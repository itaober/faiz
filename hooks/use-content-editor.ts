'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export interface EditorTask<T> {
  /** The async work to run; only called once signed in. */
  run: () => Promise<T>;
  /** Toast text while the task runs. */
  loading: string;
  /** Toast text on success — static, or derived from the resolved value. */
  success: string | ((result: T) => string);
  /** Side effects after success (close the panel, refresh, navigate…). */
  onSuccess?: (result: T) => void;
  /** Fallback toast text when the error carries no message. */
  errorFallback?: string;
}

/**
 * Shared editing-session lifecycle for the content surfaces (post / memo / page
 * / record). Owns the settings + confirm drawer state and the submitting /
 * deleting flags, gates every write behind an edit session (routing to the
 * edit-key drawer otherwise), and wires `toast.promise`. Surfaces supply only their
 * own async work and copy via `EditorTask` — keeping all the boilerplate in one
 * place instead of four near-identical copies.
 */
export function useContentEditor(isSignedIn: boolean) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const runTask = <T>(task: EditorTask<T>, setBusy: (busy: boolean) => void) => {
    if (!isSignedIn) {
      // Signed out → ask for the edit key instead of writing.
      setConfirmOpen(false);
      setSettingsOpen(true);
      return;
    }
    setBusy(true);
    toast.promise(task.run(), {
      loading: task.loading,
      success: (result: T) => {
        task.onSuccess?.(result);
        return typeof task.success === 'function' ? task.success(result) : task.success;
      },
      error: (error: unknown) =>
        (error instanceof Error ? error.message : '') ||
        task.errorFallback ||
        'Something went wrong',
      finally: () => setBusy(false),
    });
  };

  return {
    settingsOpen,
    setSettingsOpen,
    confirmOpen,
    setConfirmOpen,
    isSubmitting,
    isDeleting,
    submit: <T>(task: EditorTask<T>) => runTask(task, setIsSubmitting),
    remove: <T>(task: EditorTask<T>) => runTask(task, setIsDeleting),
  };
}
