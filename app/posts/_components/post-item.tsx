import dayjs from 'dayjs';
import Link from 'next/link';

import { Badge } from '@/components/badge';
import type { MDXData } from '@/lib/data/mdx';

const PostItem = (props: MDXData) => {
  const { title, createdTime, tags } = props;

  return (
    <li>
      <Link
        href={`/posts/${title}`}
        className="group flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-6"
      >
        <span className="text-lg opacity-70 transition-opacity group-hover:opacity-100">
          {title}
        </span>

        <div className="flex flex-wrap items-baseline gap-1.5 text-xs opacity-40 transition-opacity group-hover:opacity-70 md:text-sm">
          <time dateTime={createdTime}>{dayjs(createdTime).format('MMM DD')}</time>
          <span>·</span>
          <ul className="flex flex-wrap items-center gap-1.5">
            {tags.map(tag => (
              <li key={tag}>
                <Badge variant="outline" className="text-xs">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </Link>
    </li>
  );
};
export default PostItem;
