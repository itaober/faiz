import { RssIcon } from 'lucide-react';
import Link from 'next/link';

import SearchEntry from '@/components/search/search-entry';
import ThemeToggle from '@/components/theme-toggle';
import { getMetaInfo } from '@/lib/data/data';

import HeaderClient from './header-client';

const navNodes = [
  {
    key: 'lines',
    href: '/lines',
    node: (
      <Link href="/lines" className="focus-ring -mx-1 inline-block rounded-sm px-1 py-1.5">
        Lines
      </Link>
    ),
  },
  {
    key: 'memos',
    href: '/memos',
    node: (
      <Link href="/memos" className="focus-ring -mx-1 inline-block rounded-sm px-1 py-1.5">
        Memos
      </Link>
    ),
  },
  {
    key: 'posts',
    href: '/posts',
    node: (
      <Link href="/posts" className="focus-ring -mx-1 inline-block rounded-sm px-1 py-1.5">
        Posts
      </Link>
    ),
  },
  {
    key: 'records',
    href: '/records',
    node: (
      <Link href="/records" className="focus-ring -mx-1 inline-block rounded-sm px-1 py-1.5">
        Records
      </Link>
    ),
  },
  {
    key: 'feed',
    href: '/feed.xml',
    node: (
      <Link
        href="/feed.xml"
        aria-label="RSS feed"
        className="focus-ring icon-button size-7 text-current"
      >
        <RssIcon className="size-5" />
      </Link>
    ),
    hiddenOnMobile: true,
  },
  {
    key: 'search',
    node: <SearchEntry />,
  },
  {
    key: 'theme-toggle',
    node: <ThemeToggle />,
  },
];

const Header = async () => {
  const metaInfo = await getMetaInfo();

  const { avatar = '', name } = metaInfo ?? {};
  const avatarAlt = name ? `${name} avatar` : 'Site avatar';

  return <HeaderClient avatar={avatar} avatarAlt={avatarAlt} navNodes={navNodes} />;
};

export default Header;
