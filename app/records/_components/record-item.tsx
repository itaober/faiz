import dayjs from 'dayjs';
import Link from 'next/link';

import { Badge } from '@/components/badge';
import { Preview, PreviewContent, PreviewImage, PreviewTrigger } from '@/components/preview';
import type { RecordItem } from '@/lib/data/data';
import { cn } from '@/lib/utils';

import type { Tab } from './constants';

interface IRecordItemProps extends RecordItem {
  tab: Tab;
  typeLabel?: string;
}

export default function RecordItem({
  title,
  link,
  coverUrl,
  createdTime,
  rating,
  tab,
  type,
  typeLabel,
}: IRecordItemProps) {
  const isMusicTab = tab === 'music';
  const isMusicType = type === 'music';

  return (
    <div
      key={title}
      className="flex flex-col gap-1 rounded-md border border-transparent p-1.5 transition-all duration-200 hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-800 dark:hover:bg-neutral-900"
    >
      <Preview>
        <PreviewTrigger>
          <PreviewContent
            isMusicType={isMusicType}
            className={cn('aspect-[2/3]', {
              'aspect-square': isMusicTab,
              'data-[preview=true]:aspect-square': isMusicType,
            })}
          >
            <PreviewImage src={coverUrl} alt={title} />
          </PreviewContent>
        </PreviewTrigger>
      </Preview>
      <Link href={link} target="_blank" className="truncate text-sm font-medium hover:underline">
        {title}
      </Link>
      <div className="flex items-center gap-1 text-sm opacity-70">
        <span>{rating.toFixed(1)}</span>
        <span>·</span>
        <span>{dayjs(createdTime).format('MMM DD')}</span>
        {typeLabel && <span>·</span>}
        {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
      </div>
    </div>
  );
}
