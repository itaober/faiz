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
        className="group flex flex-col items-start gap-1 md:flex-row md:items-baseline md:gap-6"
      >
        <span className="text-lg opacity-80 transition-opacity group-hover:opacity-100">
          {title}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 opacity-50 transition-opacity group-hover:opacity-70">
          <span className="text-sm">{dayjs(createdTime).format('MMM DD')}</span>
          <span className="text-sm">·</span>
          <ul className="flex flex-wrap items-center gap-1.5">
            {tags.map(tag => (
              <li key={tag}>
                <Badge variant="outline">{tag}</Badge>
              </li>
            ))}
          </ul>
        </span>
      </Link>
    </li>
  );
};
export default PostItem;
