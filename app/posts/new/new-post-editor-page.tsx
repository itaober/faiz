'use client';

import { useRouter } from 'next/navigation';

import PostEditorSurface from '../_components/post-editor-surface';

export default function NewPostEditorPage() {
  const router = useRouter();

  return <PostEditorSurface onCancel={() => router.push('/posts')} />;
}
