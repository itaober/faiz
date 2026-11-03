'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useEditMode } from '@/components/edit-mode-context';

import PostEditorSurface from '../_components/post-editor-surface';

export default function NewPostEditorPage() {
  const router = useRouter();
  const { isEditMode, isEditModeLoaded } = useEditMode();

  // Writing a post only exists inside edit mode: landing here without it, or
  // leaving it mid-draft, goes back to the list.
  useEffect(() => {
    if (isEditModeLoaded && !isEditMode) {
      router.replace('/posts');
    }
  }, [isEditMode, isEditModeLoaded, router]);

  // `isEditMode` stays false until the stored flag is read, so the form never flashes.
  if (!isEditMode) {
    return null;
  }

  return <PostEditorSurface onExit={() => router.push('/posts')} />;
}
