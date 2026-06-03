'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import PageEditBar from '@/components/editing/page-edit-bar';

export default function PostsTitleActions() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch('/posts/new');
  }, [router]);

  return (
    <PageEditBar context="Posts" addLabel="New post" onAdd={() => router.push('/posts/new')} />
  );
}
