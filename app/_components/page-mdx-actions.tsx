'use client';

import { PencilIcon } from 'lucide-react';

interface IPageMdxActionsProps {
  page: 'about' | 'lines';
  onEdit: () => void;
}

export default function PageMdxActions({ page, onEdit }: IPageMdxActionsProps) {
  return (
    <button
      type="button"
      onClick={event => {
        event.currentTarget.blur();
        onEdit();
      }}
      className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
      aria-label={`Edit ${page}`}
    >
      <PencilIcon className="size-4" />
    </button>
  );
}
