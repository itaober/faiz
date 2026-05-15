'use client';

import { motion } from 'motion/react';

import PostItem from '@/app/posts/_components/post-item';
import { ANIMATION } from '@/lib/constants/animation';
import type { PostMeta } from '@/lib/data/data';

interface IPostsListProps {
  sortedPostsByYear: [string, PostMeta[]][];
}

export default function PostsList({ sortedPostsByYear }: IPostsListProps) {
  return (
    <motion.article
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: ANIMATION.stagger.slow,
          },
        },
      }}
    >
      {sortedPostsByYear.map(([groupTitle, posts]) => {
        return (
          <motion.section
            key={groupTitle}
            variants={{
              hidden: { opacity: 0, y: ANIMATION.distance.normal },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: ANIMATION.duration.slow }}
          >
            <h2 className="mb-2 text-2xl font-bold">{groupTitle}</h2>
            <motion.ul
              className="flex flex-col gap-6 md:gap-4"
              variants={{
                visible: { transition: { staggerChildren: ANIMATION.stagger.fast } },
              }}
            >
              {posts.map(post => (
                <PostItem key={post.slug} {...post} />
              ))}
            </motion.ul>
          </motion.section>
        );
      })}
    </motion.article>
  );
}
