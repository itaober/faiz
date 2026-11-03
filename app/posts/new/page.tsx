import { redirect } from 'next/navigation';

import MotionWrapper from '@/components/motion-wrapper';
import { hasContentEditToken } from '@/lib/server/content-edit-token';

import NewPostEditorPage from './new-post-editor-page';

export const metadata = {
  title: 'New post',
};

export default async function NewPostPage() {
  // Without a token the list never offers "New post", so this only turns visitors away.
  if (!(await hasContentEditToken())) {
    redirect('/posts');
  }

  return (
    <MotionWrapper>
      <NewPostEditorPage />
    </MotionWrapper>
  );
}
