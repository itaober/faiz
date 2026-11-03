'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useEditMode } from '@/components/edit-mode-context';

import PostEditorSurface from '../_components/post-editor-surface';

export default function NewPostEditorPage() {
  const router = useRouter();
  const { isEditMode, isEditModeLoaded } = useEditMode();

  // Edit mode lives in localStorage, out of the server's sight.
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
