import { Suspense } from 'react';

import { PAGE_META } from '@/lib/constants/seo';
import { buildPageMetadata } from '@/lib/utils/seo';

import PostTitle from '../_components/post-title';
import PostsListServer from './_components/posts-list-server';

export const metadata = buildPageMetadata(PAGE_META.posts);

export default async function PostsPage() {
  return (
    <>
      <PostTitle title="Posts" />
      <Suspense fallback={null}>
        <PostsListServer />
      </Suspense>
    </>
  );
}
