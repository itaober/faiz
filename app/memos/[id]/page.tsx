import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import MotionWrapper from '@/components/motion-wrapper';
import { getMemoById } from '@/lib/data/memos';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import MemoCard from '../_components/memo-card';
import MemoItemWrapper from '../_components/memo-item-wrapper';
import MemoList from '../_components/memo-list';
import { MemosProvider } from '../_context/memos-context';

interface IMemoPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: IMemoPageProps): Promise<Metadata> {
  const { id } = await params;
  const memo = await getMemoById(id);
  if (!memo) {
    return {};
  }
  const description = buildDescription(memo.content, 'Memo');
  return buildPageMetadata({
    title: description.slice(0, 40) || 'Memo',
    description,
    canonical: `/memos/${id}`,
  });
}

export default async function MemoPage({ params }: IMemoPageProps) {
  const { id } = await params;
  const memo = await getMemoById(id);
  if (!memo) {
    notFound();
  }

  return (
    <MemosProvider>
      <MotionWrapper>
        <div className="mt-6">
          <Link
            href="/memos"
            className="focus-ring text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 rounded-sm text-sm"
          >
            <ArrowLeftIcon className="size-4" />
            Memos
          </Link>
          <MemoList>
            <MemoItemWrapper>
              <MemoCard memo={memo} />
            </MemoItemWrapper>
          </MemoList>
        </div>
      </MotionWrapper>
    </MemosProvider>
  );
}
