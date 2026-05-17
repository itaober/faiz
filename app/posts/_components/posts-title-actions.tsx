'use client';

import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PostsTitleActions() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={event => {
        event.currentTarget.blur();
        router.push('/posts/new');
      }}
      className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-md transition-colors md:size-8"
      aria-label="Add post"
    >
      <PlusIcon className="size-4" />
    </button>
  );
}
