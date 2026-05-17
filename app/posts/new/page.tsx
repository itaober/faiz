import MotionWrapper from '@/components/motion-wrapper';

import NewPostEditorPage from './new-post-editor-page';

export const metadata = {
  title: 'New post',
};

export default function NewPostPage() {
  return (
    <MotionWrapper>
      <NewPostEditorPage />
    </MotionWrapper>
  );
}
