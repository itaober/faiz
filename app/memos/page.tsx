import MemoCard from '@/app/memos/_components/memo-card';
import MemoItemWrapper from '@/app/memos/_components/memo-item-wrapper';
import MemoList from '@/app/memos/_components/memo-list';
import MemosTitle from '@/app/memos/_components/memos-title';
import MotionWrapper from '@/components/motion-wrapper';
import { getMemos } from '@/lib/data/memos';

import { MemosProvider } from './_context/memos-context';

export const metadata = {
  title: 'Memos',
};

export default async function MemosPage() {
  const memos = await getMemos();

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
        </div>
      </MotionWrapper>
    </MemosProvider>
  );
}
