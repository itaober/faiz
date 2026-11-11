import { redirect } from 'next/navigation';

import MotionWrapper from '@/components/motion-wrapper';
import { hasEditSession } from '@/lib/server/edit-session';

import NewPostEditorPage from './new-post-editor-page';

export const metadata = {
  title: 'New post',
};

export default async function NewPostPage() {
  // Signed-out visitors are never offered "New post", so this only turns them away.
  if (!(await hasEditSession())) {
    redirect('/posts');
  }

  return (
    <MotionWrapper>
      <NewPostEditorPage />
    </MotionWrapper>
  );
}
