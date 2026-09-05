import { Suspense } from 'react';

import { PAGE_META } from '@/lib/constants/seo';
import { buildPageMetadata } from '@/lib/utils/seo';

import MemosList from './_components/memos-list';
import MemosTitle from './_components/memos-title';
import { MemosProvider } from './_context/memos-context';

export const metadata = buildPageMetadata(PAGE_META.memos);

export default function MemosPage() {
  return (
    <MemosProvider>
      <MemosTitle />
      <Suspense fallback={null}>
        <MemosList />
      </Suspense>
    </MemosProvider>
  );
}
