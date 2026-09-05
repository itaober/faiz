import MemoCard from '@/app/memos/_components/memo-card';
import MemoItemWrapper from '@/app/memos/_components/memo-item-wrapper';
import MemosStream from '@/app/memos/_components/memos-stream';
import MotionWrapper from '@/components/motion-wrapper';
import { getMemosByMonths, getMemosIndex } from '@/lib/data/memos';

const INITIAL_MONTHS = 2;

/**
 * Static first page: the newest months render into the prerendered HTML (data
 * refreshes at runtime via fetch revalidate + updateTag on save, same as
 * posts). Older months stream in client-side via the load-more server action,
 * so no searchParams touch this route and it never goes dynamic.
 */
export default async function MemosList() {
  const monthsIndex = await getMemosIndex();
  const loadedMonthKeys = monthsIndex.slice(0, INITIAL_MONTHS);
  const memos = await getMemosByMonths(loadedMonthKeys);
  const nextOffset = monthsIndex.length > INITIAL_MONTHS ? INITIAL_MONTHS : null;

  return (
    <MotionWrapper>
      <div className="mt-6">
        <MemosStream initialNextOffset={nextOffset}>
          {memos.map(memo => (
            <MemoItemWrapper key={memo.id}>
              <MemoCard memo={memo} />
            </MemoItemWrapper>
          ))}
        </MemosStream>
      </div>
    </MotionWrapper>
  );
}
