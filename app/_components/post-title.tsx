'use client';

import dayjs from 'dayjs';
import { CalendarIcon, HistoryIcon } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useState } from 'react';

import { Badge } from '@/components/badge';
import { useEditMode } from '@/components/edit-mode-context';
import { useConsecutiveClicks } from '@/hooks/use-consecutive-clicks';
import type { MDXData } from '@/lib/data/mdx';
import { cn } from '@/lib/utils';

interface IPostTitleProps extends Partial<MDXData> {
  title: string;
  className?: string;
  children?: ReactNode;
}

const PostTitle = ({
  title,
  createdTime,
  updatedTime,
  tags,
  className,
  children,
}: IPostTitleProps) => {
  const { isEditMode, toggleEditMode } = useEditMode();
  const [mounted, setMounted] = useState(false);
  const metaList = [];
  const handleTitleClick = useConsecutiveClicks({
    threshold: 5,
    onTrigger: toggleEditMode,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (createdTime) {
    metaList.push({
      id: 'createdTime',
      icon: <CalendarIcon className="size-3.5" />,
      content: dayjs(createdTime).format('MMM DD, YYYY'),
    });
  }

  if (updatedTime && !dayjs(updatedTime).isSame(createdTime, 'day')) {
    metaList.push({
      id: 'updatedTime',
      icon: <HistoryIcon className="size-3.5" />,
      content: dayjs(updatedTime).format('MMM DD, YYYY'),
    });
  }

  if (tags && tags.length > 0) {
    metaList.push({
      id: 'tags',
      content: (
        <>
          {tags.map(tag => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </>
      ),
    });
  }

  return (
    <div className={cn('mb-8', className)}>
      <div className="flex items-start justify-between gap-4">
        <h1
          className="cursor-default text-4xl font-bold tracking-tight select-none"
          onClick={handleTitleClick}
        >
          {title}
        </h1>
        {mounted && isEditMode && children && (
          <div className="not-prose flex shrink-0 items-center gap-1 pt-1">{children}</div>
        )}
      </div>
      {metaList.length > 0 && (
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2">
          {metaList.map((item, index, array) => (
            <Fragment key={item.id}>
              <div className="flex items-center gap-1">
                {item.icon}
                {item.content}
              </div>
              {index < array.length - 1 && <span>·</span>}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostTitle;
