import type { MetadataRoute } from 'next';

import { getMetaInfo, getPostListInfo } from '@/lib/data/data';

const toDate = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const metaInfo = await getMetaInfo();
  const site = metaInfo?.site ? metaInfo.site.replace(/\/$/, '') : '';

  if (!site) {
    return [];
  }

  const postList = await getPostListInfo();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: site,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${site}/posts`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${site}/memos`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${site}/records`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${site}/lines`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  const postRoutes: MetadataRoute.Sitemap = (postList ?? []).map(post => ({
    url: `${site}/posts/${post.slug}`,
    lastModified: toDate(post.updatedTime) ?? toDate(post.createdTime),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...postRoutes];
}
