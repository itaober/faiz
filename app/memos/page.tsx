import MemoVirtualList from '@/app/memos/_components/memo-virtual-list';
import MemosTitle from '@/app/memos/_components/memos-title';
import MotionWrapper from '@/components/motion-wrapper';
import { getMemosByMonths, getMemosIndex } from '@/lib/data/memos';
import { toMemoRenderItems } from '@/lib/data/memos-render';

import { MemosProvider } from './_context/memos-context';

export const metadata = {
  title: 'Memos',
};

export default async function MemosPage() {
  const monthsIndex = await getMemosIndex();
  const initialLoadedMonths = Math.min(2, monthsIndex.length);
  const initialMonths = monthsIndex.slice(0, initialLoadedMonths);
  const memos = await getMemosByMonths(initialMonths);
  const memoItems = await toMemoRenderItems(memos);

  return (
    <MemosProvider>
      <MotionWrapper>
        <MemosTitle />
        <div className="mt-6">
          <MemoVirtualList
            initialItems={memoItems}
            monthsIndex={monthsIndex}
            initialLoadedMonths={initialLoadedMonths}
          />
        </div>
      </MotionWrapper>
    </MemosProvider>
  );
}
