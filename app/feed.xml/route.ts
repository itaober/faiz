import dayjs from 'dayjs';
import { Feed } from 'feed';
import { marked } from 'marked';

import { getMetaInfo } from '@/lib/data/data';
import { getPostList } from '@/lib/data/mdx';
import { getMemos } from '@/lib/data/memos';

interface FeedItem {
  title: string;
  id: string;
  link: string;
  date: Date;
  content: string;
  category?: { name: string }[];
}

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

  const feedItems: FeedItem[] = [];

  // Add posts
  for (const post of postList) {
    const { title, createdTime, tags } = post.data;
    const htmlContent = await marked(post.content);

    feedItems.push({
      title,
      id: `${feedDomain}/posts/${post.data.slug}`,
      link: `${feedDomain}/posts/${post.data.slug}`,
      date: dayjs(createdTime).toDate(),
      category: tags.map(tag => ({ name: tag })),
      content: htmlContent,
    });
  }

  // Add memos: yesterday and before, grouped by date, merge all content per day
  if (memoList && memoList.length > 0) {
    const today = dayjs().format('YYYY-MM-DD');

    // Group memos by date (exclude today)
    const memosByDate = new Map<string, typeof memoList>();
    for (const memo of memoList) {
      const dateStr = dayjs(memo.createdTime).format('YYYY-MM-DD');
      if (dateStr >= today) continue; // Skip today's memos

      if (!memosByDate.has(dateStr)) {
        memosByDate.set(dateStr, []);
      }
      memosByDate.get(dateStr)!.push(memo);
    }

    // Create feed item for each date
    for (const [dateStr, memos] of memosByDate) {
      // Sort by time ascending and merge content
      const sortedMemos = memos.sort((a, b) => dayjs(a.createdTime).diff(dayjs(b.createdTime)));

      const mergedContent = await Promise.all(
        sortedMemos.map(async memo => {
          const time = dayjs(memo.createdTime).format('HH:mm');
          const htmlContent = await marked(memo.content);
          return `<p><strong>${time}</strong></p>${htmlContent}`;
        }),
      );

      feedItems.push({
        title: `Memos #${dateStr}`,
        id: `${feedDomain}/memos#${dateStr}`,
        link: `${feedDomain}/memos`,
        date: dayjs(dateStr).toDate(),
        category: [{ name: 'memo' }],
        content: mergedContent.join('<hr/>'),
      });
    }
  }

  // Sort all items by date descending
  feedItems.sort((a, b) => b.date.getTime() - a.date.getTime());

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
