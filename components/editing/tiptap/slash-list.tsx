'use client';

import type { Editor, Range } from '@tiptap/core';
import type { LucideIcon } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface SlashItem {
  id: string;
  title: string;
  icon: LucideIcon;
  syntax?: string;
  run: (props: { editor: Editor; range: Range }) => void;
}

export interface SlashListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

/**
 * Compact single-line slash palette (icon · name · syntax hint). Rendered into a
 * floating element by the SlashCommand suggestion plugin; keyboard nav is driven
 * imperatively through the forwarded ref.
 */
export const SlashList = forwardRef<SlashListRef, SlashListProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (!items.length) {
          return false;
        }
        if (event.key === 'ArrowUp') {
          setSelected(current => (current + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelected(current => (current + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[selected];
          if (item) {
            command(item);
          }
          return true;
        }
        return false;
      },
    }),
    [items, selected, command],
  );

  if (!items.length) {
    return null;
  }

  return (
    <div className="fz-slash">
      <div className="fz-slash-label">Blocks</div>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className="fz-slash-item"
            data-active={index === selected || undefined}
            onMouseEnter={() => setSelected(index)}
            onMouseDown={event => event.preventDefault()}
            onClick={() => command(item)}
          >
            <span className="fz-slash-ic">
              <Icon className="size-[15px]" />
            </span>
            <span className="fz-slash-name">{item.title}</span>
            {item.syntax ? <span className="fz-slash-key">{item.syntax}</span> : null}
          </button>
        );
      })}
    </div>
  );
});

SlashList.displayName = 'SlashList';
