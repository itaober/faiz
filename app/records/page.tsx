import { Suspense } from 'react';

import { PAGE_META } from '@/lib/constants/seo';
import { getMetaInfo } from '@/lib/data/data';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import PostTitle from '../_components/post-title';
import RecordFocusScroll from './_components/record-focus-scroll';
import { RecordsInlineComposerProvider } from './_components/records-inline-composer-context';
import RecordsList from './_components/records-list';
import RecordsTabs from './_components/records-tabs';
import RecordsTitleActions from './_components/records-title-actions';

export async function generateMetadata() {
  const metaInfo = await getMetaInfo();
  const description = buildDescription(metaInfo?.bio, PAGE_META.records.descriptionFallback);
  return buildPageMetadata({
    title: PAGE_META.records.title,
    description,
    canonical: PAGE_META.records.canonical,
  });
}

export default function RecordsPage() {
  return (
    <RecordsInlineComposerProvider>
      <PostTitle title="Records">
        <RecordsTitleActions />
      </PostTitle>
      {/* RecordsTabs and RecordFocusScroll read searchParams on the client, so
          each needs its own boundary for the page to prerender. */}
      <Suspense fallback={null}>
        <RecordsTabs />
      </Suspense>
      <Suspense fallback={null}>
        <RecordsList />
      </Suspense>
      <Suspense fallback={null}>
        <RecordFocusScroll />
      </Suspense>
    </RecordsInlineComposerProvider>
  );
}
