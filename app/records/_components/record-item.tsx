import dayjs from 'dayjs';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/badge';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import { ANIMATION } from '@/lib/constants/animation';
import type { RecordItem } from '@/lib/data/data';
import { cn } from '@/lib/utils';

import type { Tab } from '../_constants';

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
  typeLabel,
}: IRecordItemProps) {
  const isMusicTab = tab === 'music';
  const coverSizes =
    '(max-width: 640px) calc((100vw - 4rem) / 2), (max-width: 768px) calc((100vw - 5rem) / 3), 11rem';

  return (
    <motion.div
      key={title}
      className="hover:bg-muted/45 flex flex-col gap-1 rounded-md border border-transparent p-1.5 transition-colors duration-200"
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
      <Preview>
        <PreviewTrigger ariaLabel={`Open cover preview: ${title}`} className="rounded-md">
          <div className="overflow-hidden rounded-md">
            <Image
              src={coverUrl}
              alt={title}
              width={0}
              height={0}
              sizes={coverSizes}
              className={cn('relative aspect-[2/3] w-full rounded object-cover', {
                'aspect-square': isMusicTab,
              })}
            />
          </div>
        </PreviewTrigger>
        <PreviewPortal ariaLabel={`Cover preview: ${title}`}>
          <PreviewImage src={coverUrl} alt={title} />
        </PreviewPortal>
      </Preview>
      <Link
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${title} (opens in a new tab)`}
        className="truncate text-sm font-medium hover:underline"
      >
        {title}
      </Link>
      <div className="text-muted-foreground flex items-center gap-1 text-sm">
        {rating && <span>{rating.toFixed(1)}</span>}
        {rating && <span>·</span>}
        <span>{dayjs(createdTime).format('MMM DD')}</span>
        {typeLabel && <span>·</span>}
        {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
      </div>
    </motion.div>
  );
}
