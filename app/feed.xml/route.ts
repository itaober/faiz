import dayjs from 'dayjs';
import { Feed } from 'feed';
import { marked } from 'marked';

import { getMetaInfo } from '@/lib/data/data';
import { getPostList } from '@/lib/data/mdx';
import { getMemos } from '@/lib/data/memos';

interface IFeedItem {
  title: string;
  id: string;
  link: string;
  date: Date;
  content: string;
  category?: { name: string }[];
}

type PostList = NonNullable<Awaited<ReturnType<typeof getPostList>>>;
type MemoList = NonNullable<Awaited<ReturnType<typeof getMemos>>>;

const createPostFeedItems = async (postList: PostList, feedDomain: string): Promise<IFeedItem[]> =>
  Promise.all(
    postList.map(async post => {
      const { title, createdTime, tags } = post.data;
      const htmlContent = await marked(post.content);

      return {
        title,
        id: `${feedDomain}/posts/${post.data.slug}`,
        link: `${feedDomain}/posts/${post.data.slug}`,
        date: dayjs(createdTime).toDate(),
        category: tags.map(tag => ({ name: tag })),
        content: htmlContent,
      };
    }),
  );

const groupMemosByDate = (memoList: MemoList, today: string) => {
  const memosByDate = new Map<string, MemoList>();

  for (const memo of memoList) {
    const dateStr = dayjs(memo.createdTime).format('YYYY-MM-DD');
    if (dateStr >= today) continue;

    const memos = memosByDate.get(dateStr);
    if (memos) {
      memos.push(memo);
    } else {
      memosByDate.set(dateStr, [memo]);
    }
  }

  return Array.from(memosByDate.entries());
};

const createMemoFeedItems = async (
  memoList: MemoList,
  feedDomain: string,
): Promise<IFeedItem[]> => {
  if (memoList.length === 0) {
    return [];
  }

  const today = dayjs().format('YYYY-MM-DD');

  return Promise.all(
    groupMemosByDate(memoList, today).map(async ([dateStr, memos]) => {
      const sortedMemos = [...memos].sort((a, b) =>
        dayjs(a.createdTime).diff(dayjs(b.createdTime)),
      );

      const mergedContent = await Promise.all(
        sortedMemos.map(async memo => {
          const time = dayjs(memo.createdTime).format('HH:mm');
          const htmlContent = await marked(memo.content);
          return `<p><strong>${time}</strong></p>${htmlContent}`;
        }),
      );

      return {
        title: `Memos #${dateStr}`,
        id: `${feedDomain}/memos#${dateStr}`,
        link: `${feedDomain}/memos`,
        date: dayjs(dateStr).add(1, 'day').startOf('day').toDate(),
        category: [{ name: 'memo' }],
        content: mergedContent.join('<hr/>'),
      };
    }),
  );
};

export async function GET() {
  const [metaInfo, postList, memoList] = await Promise.all([
    getMetaInfo(),
    getPostList(),
    getMemos(),
  ]);

  if (!metaInfo || !metaInfo.site || !postList) {
    return new Response('Internal Server Error', { status: 500 });
  }

  const feedDomain = metaInfo.site;

  const avatarUrl = metaInfo?.avatar?.startsWith('/')
    ? `${feedDomain}${metaInfo.avatar}`
    : metaInfo?.avatar;

  const feed = new Feed({
    title: metaInfo?.name,
    description: metaInfo?.bio,
    id: feedDomain,
    link: feedDomain,
    language: 'en',
    image: avatarUrl,
    favicon: avatarUrl,
    copyright: `All rights reserved ${dayjs().format('YYYY')}, ${metaInfo?.name}.`,
    author: {
      name: metaInfo?.name,
      link: feedDomain,
    },
  });

  const [postFeedItems, memoFeedItems] = await Promise.all([
    createPostFeedItems(postList, feedDomain),
    createMemoFeedItems(memoList ?? [], feedDomain),
  ]);

  const feedItems = [...postFeedItems, ...memoFeedItems].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  // Add items to feed
  for (const item of feedItems) {
    feed.addItem({
      ...item,
      author: [{ name: metaInfo?.name, link: feedDomain }],
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
