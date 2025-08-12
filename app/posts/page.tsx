import dayjs from 'dayjs';
import Link from 'next/link';

import { getPostList } from '@/lib/data/mdx';

export default async function PostsPage() {
  const postList = await getPostList();

  const groupedPostsByYear = postList.reduce(
    (acc, post) => {
      const year = dayjs(post.createdTime).format('YYYY');
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(post);
      return acc;
    },
    {} as Record<string, typeof postList>,
  );

  const sortedPostsByYear = Object.entries(groupedPostsByYear).sort(
    (a, b) => Number(b[0]) - Number(a[0]),
  );

  return (
    <div className="max-w-4xl overflow-y-hidden">
      <h1 className="mb-8 text-4xl font-extrabold">Posts</h1>
      <article>
        {sortedPostsByYear.map(([year, posts]) => {
          return (
            <section key={year} className="mb-6">
              <h2 className="mb-2 text-2xl font-bold">{year}</h2>
              <ul className="flex flex-col gap-2">
                {posts.map(post => (
                  <li key={post.title}>
                    <Link href={`/posts/${post.title}`}>
                      <span>{post.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </article>
    </div>
  );
}
