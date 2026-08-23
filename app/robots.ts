import type { MetadataRoute } from 'next';

import { getMetaInfo } from '@/lib/data/data';

// Written into the static build; regenerates per deploy.
export const dynamic = 'force-static';

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
