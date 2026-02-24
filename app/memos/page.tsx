import { Suspense } from 'react';

import { PAGE_META } from '@/lib/constants/seo';
import { buildPageMetadata } from '@/lib/utils/seo';

import MemosList from './_components/memos-list';
import MemosTitle from './_components/memos-title';
import { MemosProvider } from './_context/memos-context';

export const metadata = buildPageMetadata(PAGE_META.memos);

interface MemosPageProps {
  searchParams?: Promise<{
    end?: string;
    limit?: string;
  }>;
}

export default function MemosPage({ searchParams }: MemosPageProps) {
  return (
    <MemosProvider>
      <MemosTitle />
      <Suspense fallback={null}>
        <MemosList searchParams={searchParams} />
      </Suspense>
    </MemosProvider>
  );
}
