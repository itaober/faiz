import dayjs from 'dayjs';
import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/badge';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
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
      {/* Cover */}
      <Preview>
        <PreviewTrigger>
          <Image
            src={coverUrl}
            alt={title}
            width={0}
            height={0}
            sizes="100%"
            className={cn('relative aspect-[2/3] w-full rounded object-cover', {
              'aspect-square': isMusicTab,
            })}
          />
        </PreviewTrigger>
        <PreviewPortal>
          <PreviewImage
            src={coverUrl}
            alt={title}
            className={cn({
              'aspect-[2/3]': !isMusicType,
              'aspect-square': isMusicType,
            })}
          />
        </PreviewPortal>
      </Preview>
      {/* Title */}
      <Link href={link} target="_blank" className="truncate text-sm font-medium hover:underline">
        {title}
      </Link>
      {/* Other info */}
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
