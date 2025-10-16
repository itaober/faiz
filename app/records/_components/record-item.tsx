import dayjs from 'dayjs';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/badge';
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
  const [isPreview, setIsPreview] = useState(false);

  const isMusicTab = tab === 'music';
  const isMusicType = type === 'music';

  const isAspectSquare = isMusicTab || (isMusicType && isPreview);

  useEffect(() => {
    if (isPreview) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isPreview]);

  return (
    <div
      key={title}
      className="flex flex-col gap-1 rounded-md border border-transparent p-1.5 transition-all duration-200 hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-800 dark:hover:bg-neutral-900"
    >
      <div
        className={cn({
          'bg-foreground/95 fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur md:px-0':
            isPreview,
        })}
        onClick={() => setIsPreview(!isPreview)}
      >
        <div
          className={cn('relative aspect-[2/3] w-full', {
            'aspect-square': isAspectSquare,
            'max-w-lg': isPreview,
          })}
        >
          <Image
            src={coverUrl}
            alt={title}
            fill
            className={cn('rounded object-cover', {
              'rounded-none': isPreview,
            })}
          />
        </div>
      </div>
      <Link href={link} className="truncate text-sm font-medium hover:underline">
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
