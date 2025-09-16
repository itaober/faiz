import dayjs from 'dayjs';
import { Feed } from 'feed';
import { marked } from 'marked';

import { getPostList } from '@/lib/data/mdx';
import { getMetaInfo } from '@/lib/data/meta';

export async function GET() {
  const [metaInfo, postList] = await Promise.all([getMetaInfo(), getPostList()]);

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

  const sortedPosts = postList.sort((a, b) =>
    dayjs(b?.data.createdTime).diff(dayjs(a?.data.createdTime)),
  );

  await Promise.all(
    sortedPosts.map(async post => {
      const { title, createdTime, tags } = post.data;
      const htmlContent = await marked(post.content);

      feed.addItem({
        title,
        id: `${feedDomain}/posts/${title}`,
        link: `${feedDomain}/posts/${title}`,
        author: [
          {
            name: metaInfo?.name,
            link: feedDomain,
          },
        ],
        date: dayjs(createdTime).toDate(),
        category: tags.map(tag => ({ name: tag })),
        content: htmlContent,
      });
    }),
  );

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
