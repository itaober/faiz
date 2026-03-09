'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ANIMATION } from '@/lib/constants/animation';
import { cn } from '@/lib/utils';

import type { Tab } from '../_constants';
import { tabList } from '../_constants';

interface RecordsTabsProps {
  activeTab: Tab;
}

export default function RecordsTabs({ activeTab }: RecordsTabsProps) {
  const router = useRouter();

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
              <Link
                href={href}
                prefetch
                aria-current={isActive ? 'page' : undefined}
                className="focus-ring rounded-sm"
                onMouseEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
              >
                {tab.label}
              </Link>
              {isActive && (
                <motion.div
                  layoutId="records-active-tab"
                  className="bg-foreground absolute right-0 -bottom-1 left-0 h-0.5"
                  transition={{
                    type: 'spring',
                    stiffness: ANIMATION.spring.stiffness,
                    damping: ANIMATION.spring.damping,
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
