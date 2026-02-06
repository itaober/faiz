import type { MetadataRoute } from 'next';

import { getMetaInfo } from '@/lib/data/data';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const metaInfo = await getMetaInfo();
  const site = metaInfo?.site ? metaInfo.site.replace(/\/$/, '') : '';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: site ? `${site}/sitemap.xml` : undefined,
  };
}
