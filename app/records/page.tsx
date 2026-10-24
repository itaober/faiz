import { Suspense } from 'react';

import { PAGE_META } from '@/lib/constants/seo';
import { getMetaInfo } from '@/lib/data/data';
import { buildDescription, buildPageMetadata } from '@/lib/utils/seo';

import PostTitle from '../_components/post-title';
import RecordFocusScroll from './_components/record-focus-scroll';
import { RecordsInlineComposerProvider } from './_components/records-inline-composer-context';
import RecordsList from './_components/records-list';
import { RecordsTabProvider } from './_components/records-tab';
import RecordsTabs from './_components/records-tabs';
import RecordsTitleActions from './_components/records-title-actions';
import { tabList } from './_constants';

// The tabs and list prerender as "all". When the URL asks for another tab, flag
// it before first paint so globals.css hides them until RecordsTabProvider has
// read the URL.
const tabQueryScript = `if(${JSON.stringify(
  tabList.map(tab => tab.value).filter(value => value !== 'all'),
)}.indexOf(new URLSearchParams(location.search).get('tab'))>-1)document.documentElement.dataset.recordsTabQuery=''`;

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
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inlines a static, build-time constant so it runs before the prerendered tab paints */}
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: tabQueryScript }} />
      <RecordsTabProvider>
        <RecordsTabs />
        <Suspense fallback={null}>
          <RecordsList />
        </Suspense>
      </RecordsTabProvider>
      {/* Reads searchParams on the client, so it needs its own boundary for the
          page to prerender. */}
      <Suspense fallback={null}>
        <RecordFocusScroll />
      </Suspense>
    </RecordsInlineComposerProvider>
  );
}
