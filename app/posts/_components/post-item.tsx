'use client';

import dayjs from 'dayjs';
import { motion } from 'motion/react';
import Link from 'next/link';

import { Badge } from '@/components/badge';
import { ANIMATION } from '@/lib/constants/animation';
import type { PostMeta } from '@/lib/data/data';

const PostItem = (props: PostMeta) => {
  const { slug, title, createdTime, tags } = props;

  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: ANIMATION.distance.small },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: ANIMATION.duration.normal }}
    >
      <Link
        href={`/posts/${slug}`}
        className="group flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-6"
      >
        <motion.span
          className="text-lg opacity-70 transition-opacity group-hover:opacity-100"
          whileHover={{ x: ANIMATION.distance.minimal }}
          transition={{
            type: 'spring',
            stiffness: ANIMATION.spring.stiffness,
            damping: ANIMATION.spring.damping,
          }}
        >
          {title}
        </motion.span>
        <div className="flex flex-wrap items-baseline gap-1.5 text-xs opacity-40 transition-opacity group-hover:opacity-70 md:text-sm">
          <time dateTime={createdTime}>{dayjs(createdTime).format('MMM DD')}</time>
          {tags.length > 0 && <span>·</span>}
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
    </motion.li>
  );
};
export default PostItem;
