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
    <nav>
      <ul className="flex items-center gap-6 overflow-x-auto pb-2">
        {tabList.map(tab => {
          const isActive = activeTab === tab.value;
          const href = tab.value === 'all' ? '/records' : `/records?tab=${tab.value}`;

          return (
            <li
              key={tab.value}
              className={cn(
                'relative opacity-70 transition-opacity hover:opacity-100 active:opacity-100',
                {
                  'font-medium opacity-100': isActive,
                },
              )}
            >
              <Link
                href={href}
                prefetch
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
