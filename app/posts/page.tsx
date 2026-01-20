import dayjs from 'dayjs';

import MotionWrapper from '@/components/motion-wrapper';
import { getPostListInfo } from '@/lib/data/data';

import PostsList from './_components/posts-list';

const PINNED_KEY = 'Pinned';

export const metadata = {
  title: 'Posts',
};

export default async function PostsPage() {
  const postList = await getPostListInfo();

  const groupedPostsByYear = (postList || []).reduce(
    (acc, post) => {
      if (post.pinned) {
        acc[PINNED_KEY] = [...(acc[PINNED_KEY] || []), post];
        return acc;
      }

      const year = dayjs(post.createdTime).format('YYYY');
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(post);
      return acc;
    },
    {} as Record<string, NonNullable<typeof postList>>,
  );

  const sortedPostsByYear = Object.entries(groupedPostsByYear).sort((a, b) => {
    if (a[0] === PINNED_KEY) {
      return -1;
    }
    if (b[0] === PINNED_KEY) {
      return 1;
    }
    return Number(b[0]) - Number(a[0]);
  });

  return (
    <MotionWrapper>
      <h1 className="mb-8 text-4xl font-extrabold">Posts</h1>
      <PostsList sortedPostsByYear={sortedPostsByYear} />
    </MotionWrapper>
  );
}
