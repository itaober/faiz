import { Suspense } from 'react';

import { PAGE_META } from '@/lib/constants/seo';
import { getMetaInfo } from '@/lib/data/data';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import PostTitle from '../_components/post-title';
import RecordsList from './_components/records-list';
import RecordsTabs from './_components/records-tabs';
import { type Tab, tabList } from './_constants';

export async function generateMetadata() {
  const metaInfo = await getMetaInfo();
  const description = buildDescription(metaInfo?.bio, PAGE_META.records.descriptionFallback);
  return buildPageMetadata({
    title: PAGE_META.records.title,
    description,
    canonical: PAGE_META.records.canonical,
  });
}

interface RecordsPageProps {
  searchParams?: Promise<{
    tab?: string;
  }>;
}

const normalizeTab = (value: string | undefined): Tab => {
  if (!value) {
    return 'all';
  }
  const matched = tabList.find(tab => tab.value === value);
  return matched?.value ?? 'all';
};

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const resolvedSearchParams = await searchParams;
  const activeTab = normalizeTab(resolvedSearchParams?.tab);

  return (
    <>
      <PostTitle title="Records" />
      <RecordsTabs activeTab={activeTab} />
      <Suspense fallback={null}>
        <RecordsList activeTab={activeTab} />
      </Suspense>
    </>
  );
}
