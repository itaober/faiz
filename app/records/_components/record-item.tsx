import dayjs from 'dayjs';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/badge';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import { ANIMATION } from '@/lib/constants/animation';
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
    <motion.div
      key={title}
      className="flex flex-col gap-1 rounded-md border border-transparent p-1.5 transition-colors duration-200 hover:bg-neutral-50 dark:hover:bg-neutral-900"
      variants={{
        hidden: { opacity: 0, y: ANIMATION.distance.small },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: ANIMATION.duration.normal }}
      whileHover={{
        y: -ANIMATION.distance.minimal,
        transition: { duration: ANIMATION.duration.fast },
      }}
    >
      {/* Cover */}
      <Preview>
        <PreviewTrigger>
          <div className="overflow-hidden rounded-md">
            <Image
              src={coverUrl}
              alt={title}
              width={0}
              height={0}
              sizes="100vw"
              className={cn('relative aspect-[2/3] w-full rounded object-cover', {
                'aspect-square': isMusicTab,
              })}
            />
          </div>
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
        {rating && <span>{rating.toFixed(1)}</span>}
        {rating && <span>·</span>}
        <span>{dayjs(createdTime).format('MMM DD')}</span>
        {typeLabel && <span>·</span>}
        {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
      </div>
    </motion.div>
  );
}
