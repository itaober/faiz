import { PAGE_META } from '@/lib/constants/seo';
import { getMetaInfo, getRecordsInfo } from '@/lib/data/data';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import { RecordsClient } from './_components/records-client';

export async function generateMetadata() {
  const metaInfo = await getMetaInfo();
  const description = buildDescription(metaInfo?.bio, PAGE_META.records.descriptionFallback);
  return buildPageMetadata({
    title: PAGE_META.records.title,
    description,
    canonical: PAGE_META.records.canonical,
  });
}

export default async function RecordsPage() {
  const records = await getRecordsInfo();

  return <RecordsClient records={records} />;
}
