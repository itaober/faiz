import MemoCard from '@/app/memos/_components/memo-card';
import MemoItemWrapper from '@/app/memos/_components/memo-item-wrapper';
import MemoList from '@/app/memos/_components/memo-list';
import MemosLoadMore from '@/app/memos/_components/memos-load-more';
import MemosTitle from '@/app/memos/_components/memos-title';
import MotionWrapper from '@/components/motion-wrapper';
import { PAGE_META } from '@/lib/constants/seo';
import { getMemosByMonths, getMemosIndex } from '@/lib/data/memos';
import dayjs from '@/lib/dayjs';
import { buildPageMetadata } from '@/lib/utils/seo';

import { MemosProvider } from './_context/memos-context';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata(PAGE_META.memos);

interface MemosPageProps {
  searchParams?: Promise<{
    end?: string;
    limit?: string;
  }>;
}

const DEFAULT_LIMIT = 2;

const normalizeEnd = (value: string | undefined, monthsIndex: string[]) => {
  const fallback = monthsIndex[0] ?? '';
  if (!value) {
    return fallback;
  }
  const normalized = /^\d{4}-\d{2}$/.test(value) ? value.replace('-', '') : value;
  if (!/^\d{6}$/.test(normalized)) {
    return fallback;
  }
  const isValid = dayjs(`${normalized.slice(0, 4)}-${normalized.slice(4)}-01`).isValid();
  if (!isValid) {
    return fallback;
  }
  if (!monthsIndex.includes(normalized)) {
    return fallback;
  }
  return normalized;
};

const clampLimit = (value: number, total: number) => {
  if (total <= 0) {
    return 0;
  }
  const fallback = Math.min(DEFAULT_LIMIT, total);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const coerced = Math.floor(value);
  const minLimit = total < DEFAULT_LIMIT ? total : DEFAULT_LIMIT;
  return Math.min(Math.max(minLimit, coerced), total);
};

export default async function MemosPage({ searchParams }: MemosPageProps) {
  const resolvedSearchParams = await searchParams;
  const monthsIndex = await getMemosIndex();
  const totalMonths = monthsIndex.length;
  const monthIndexMap = new Map(monthsIndex.map((month, index) => [month, index]));
  const endMonth = normalizeEnd(resolvedSearchParams?.end, monthsIndex);
  const endIndex = monthIndexMap.get(endMonth) ?? 0;
  const availableFromEnd = Math.max(0, totalMonths - endIndex);
  const requestedLimit = Number(resolvedSearchParams?.limit ?? DEFAULT_LIMIT);
  const loadedLimit = clampLimit(requestedLimit, availableFromEnd);
  const loadedMonthKeys = monthsIndex.slice(endIndex, endIndex + loadedLimit);
  const memos = await getMemosByMonths(loadedMonthKeys);

  return (
    <MemosProvider>
      <MotionWrapper>
        <MemosTitle />
        <div className="mt-6">
          <MemoList>
            {memos.map(memo => (
              <MemoItemWrapper key={memo.id}>
                <MemoCard memo={memo} />
              </MemoItemWrapper>
            ))}
          </MemoList>
          <MemosLoadMore
            loadedLimit={loadedLimit}
            totalAvailable={availableFromEnd}
            end={endMonth}
          />
        </div>
      </MotionWrapper>
    </MemosProvider>
  );
}
