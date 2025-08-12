import Image from 'next/image';
import Link from 'next/link';

import { getMetaInfo } from '@/lib/data/meta';

import ThemeToggle from './theme-toggle';

const Header = async () => {
  const metaInfo = await getMetaInfo();

  const { avatar = '' } = metaInfo ?? {};

  const navList = [
    <Link key="posts" href="/posts">
      Posts
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
          <ul className="flex items-center gap-4 md:gap-6">
            {navList.map((el, index) => (
              <li
                key={index}
                className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-200 dark:hover:text-gray-400"
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
