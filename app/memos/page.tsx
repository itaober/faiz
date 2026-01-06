import MemoCard from '@/app/memos/_components/memo-card';
import MemosTitle from '@/app/memos/_components/memos-title';
import { getMemos } from '@/lib/data/memos';

import { MemosProvider } from './_context/memos-context';

export const metadata = {
  title: 'Memos',
};

export default async function MemosPage() {
  const memos = await getMemos();

  return (
    <MemosProvider>
      <div>
        <MemosTitle />
        <div className="mt-6">
          <article className="prose dark:prose-invert">
            {memos.map(memo => (
              <MemoCard key={memo.id} memo={memo} />
            ))}
          </article>
        </div>
      </div>
    </MemosProvider>
  );
}
