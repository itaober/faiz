import dayjs from 'dayjs';

import { getPostList } from '@/lib/data/mdx';

import PostItem from './_components/post-item';

const PINNED_KEY = 'Pinned';

export const metadata = {
  title: 'Posts',
};

export default async function PostsPage() {
  const postList = await getPostList();

  const groupedPostsByYear = postList.reduce(
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
    {} as Record<string, typeof postList>,
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
    <div className="max-w-4xl overflow-y-hidden">
      <h1 className="mb-8 text-4xl font-extrabold">Posts</h1>
      <article className="space-y-8">
        {sortedPostsByYear.map(([groupTitle, posts]) => {
          return (
            <section key={groupTitle}>
              <h2 className="mb-2 text-2xl font-bold">{groupTitle}</h2>
              <ul className="flex flex-col gap-6 md:gap-4">
                {posts.map(post => (
                  <PostItem key={post.title} {...post} />
                ))}
              </ul>
            </section>
          );
        })}
      </article>
    </div>
  );
}
