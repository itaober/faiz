'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { ANIMATION } from '@/lib/constants/animation';

const getHref = (key: string): string => {
  switch (key) {
    case 'lines':
      return '/lines';
    case 'memos':
      return '/memos';
    case 'posts':
      return '/posts';
    case 'records':
      return '/records';
    case 'feed':
      return '/feed.xml';
    default:
      return '/';
  }
};

interface IHeaderClientProps {
  avatar: string;
  navNodes: {
    key: string;
    node: ReactNode;
    hiddenOnMobile?: boolean;
    href?: string;
  }[];
}

export default function HeaderClient({ avatar, navNodes }: IHeaderClientProps) {
  const pathname = usePathname();

  const isActive = (key: string): boolean => {
    const href = getHref(key);
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="bg-background/70 sticky top-0 z-10 w-full backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
        <Link href="/">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: ANIMATION.duration.slow, ease: ANIMATION.ease.out }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Image
              src={avatar}
              alt="avatar"
              width={48}
              height={48}
              className="rounded-full select-none"
            />
          </motion.div>
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="group flex items-center gap-4 md:gap-6">
            {navNodes.map((el, index) => {
              const active = isActive(el.key);
              return (
                <motion.li
                  key={el.key}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: active ? 1 : 0.7,
                    y: 0,
                  }}
                  transition={{
                    delay: index * ANIMATION.stagger.fast + 0.2,
                    duration: ANIMATION.duration.normal,
                  }}
                  whileHover={{
                    y: -ANIMATION.distance.minimal,
                    transition: { duration: ANIMATION.duration.fast },
                  }}
                >
                  {el.node}
                </motion.li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
