import { Suspense } from 'react';

import { PAGE_META } from '@/lib/constants/seo';
import { buildPageMetadata } from '@/lib/utils/seo';

import PostTitle from '../_components/post-title';
import PostsListServer from './_components/posts-list-server';
import PostsTitleActions from './_components/posts-title-actions';

export const metadata = buildPageMetadata(PAGE_META.posts);

export default async function PostsPage() {
  return (
    <>
      <PostTitle title="Posts">
        <PostsTitleActions />
      </PostTitle>
      <Suspense fallback={null}>
        <PostsListServer />
      </Suspense>
    </>
  );
}
