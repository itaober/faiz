'use client';

import { motion } from 'motion/react';
import { useSearchParams } from 'next/navigation';

import { ANIMATION } from '@/lib/constants/animation';
import { cn } from '@/lib/utils';

import { normalizeTab, tabList } from '../_constants';

export default function RecordsTabs() {
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams.get('tab'));

  return (
    <nav aria-label="Record categories">
      <ul className="flex items-center gap-6 overflow-x-auto pb-2">
        {tabList.map(tab => {
          const isActive = activeTab === tab.value;
          const href = tab.value === 'all' ? '/records' : `/records?tab=${tab.value}`;

          return (
            <li
              key={tab.value}
              className={cn(
                'text-muted-foreground hover:text-foreground active:text-foreground relative transition-colors',
                {
                  'text-foreground font-medium': isActive,
                },
              )}
            >
              {/* Shallow history update: filtering is client-side, so a server
                  round-trip (and its scroll-to-top + suspense flash) is never
                  needed. Modified clicks keep native new-tab behavior. */}
              <a
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className="focus-ring -mx-1 inline-block rounded-sm px-1 py-1.5"
                onClick={event => {
                  if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  event.preventDefault();
                  window.history.pushState(null, '', href);
                }}
              >
                {tab.label}
              </a>
              {isActive && (
                <motion.div
                  layoutId="records-active-tab"
                  className="bg-foreground absolute right-0 bottom-0 left-0 h-0.5 rounded-full"
                  transition={{
                    type: 'spring',
                    stiffness: ANIMATION.spring.stiffness,
                    damping: ANIMATION.spring.damping,
                  }}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
