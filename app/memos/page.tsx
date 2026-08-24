import MotionWrapper from '@/components/motion-wrapper';
import { PAGE_META } from '@/lib/constants/seo';
import { getMemosByMonth, getMemosIndex } from '@/lib/data/memos';
import { buildPageMetadata } from '@/lib/utils/seo';

import MemoCard from './_components/memo-card';
import MemoItemWrapper from './_components/memo-item-wrapper';
import MemosPaginated from './_components/memos-paginated';
import MemosTitle from './_components/memos-title';
import { MemosProvider } from './_context/memos-context';

export const metadata = buildPageMetadata(PAGE_META.memos);

export default async function MemosPage() {
  // Bake every month into the page; MemosPaginated reveals them client-side.
  const months = await getMemosIndex();
  const groups = await Promise.all(
    months.map(async month => ({
      month,
      node: (
        <>
          {(await getMemosByMonth(month)).map(memo => (
            <MemoItemWrapper key={memo.id}>
              <MemoCard memo={memo} />
            </MemoItemWrapper>
          ))}
        </>
      ),
    })),
  );

  return (
    <MemosProvider>
      <MemosTitle />
      <MotionWrapper>
        <div className="mt-6">
          <MemosPaginated groups={groups} />
        </div>
      </MotionWrapper>
    </MemosProvider>
  );
}
