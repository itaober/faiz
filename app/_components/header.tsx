import { RssIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import ThemeToggle from '@/components/theme-toggle';
import { getMetaInfo } from '@/lib/data/data';
import { cn } from '@/lib/utils';

const Header = async () => {
  const metaInfo = await getMetaInfo();

  const { avatar = '' } = metaInfo ?? {};

  const navList = [
    <Link key="lines" href="/lines">
      Lines
    </Link>,
    <Link key="posts" href="/posts">
      Posts
    </Link>,
    <Link key="records" href="/records">
      Records
    </Link>,
    <Link key="feed" href="/feed.xml">
      <RssIcon className="size-5" />
    </Link>,
    <ThemeToggle key="theme-toggle" />,
  ];

  return (
    <header className="bg-background/60 sticky top-0 z-50 w-full backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Image
            src={avatar}
            alt="avatar"
            width={48}
            height={48}
            className="rounded-full select-none"
          />
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="group flex items-center gap-4 md:gap-6">
            {navList.map((el, index) => (
              <li
                key={index}
                className={cn(
                  'flex items-center justify-center opacity-70 transition-opacity hover:opacity-100 active:opacity-100',
                  {
                    'hidden md:inline-flex': el.key === 'feed',
                  },
                )}
              >
                {el}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
