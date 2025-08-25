import dayjs from 'dayjs';
import { CalendarIcon, RefreshCwIcon } from 'lucide-react';
import { Fragment } from 'react';

import { Badge } from '@/components/badge';
import type { MDXData } from '@/lib/data/mdx';
import { cn } from '@/lib/utils';

interface IPostTitleProps extends Partial<MDXData> {
  title: string;
  className?: string;
}

const PostTitle = ({ title, createdTime, updatedTime, tags, className }: IPostTitleProps) => {
  const metaList = [];

  if (createdTime) {
    metaList.push({
      id: 'createdTime',
      icon: <CalendarIcon className="size-3.5" />,
      content: dayjs(createdTime).format('MMM DD, YYYY'),
    });
  }

  if (updatedTime) {
    metaList.push({
      id: 'updatedTime',
      icon: <RefreshCwIcon className="size-3.5" />,
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
      {/* Title */}
      <h1 className="text-4xl font-extrabold">{title}</h1>
      {/* Meta */}
      {metaList.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 opacity-50">
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
