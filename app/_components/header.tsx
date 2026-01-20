import { RssIcon } from 'lucide-react';
import Link from 'next/link';

import ThemeToggle from '@/components/theme-toggle';
import { getMetaInfo } from '@/lib/data/data';

import HeaderClient from './header-client';

const navNodes = [
  {
    key: 'lines',
    node: <Link href="/lines">Lines</Link>,
  },
  {
    key: 'memos',
    node: <Link href="/memos">Memos</Link>,
  },
  {
    key: 'posts',
    node: <Link href="/posts">Posts</Link>,
  },
  {
    key: 'records',
    node: <Link href="/records">Records</Link>,
  },
  {
    key: 'feed',
    node: (
      <Link href="/feed.xml">
        <RssIcon className="size-5" />
      </Link>
    ),
    hiddenOnMobile: true,
  },
  {
    key: 'theme-toggle',
    node: <ThemeToggle />,
  },
];

const Header = async () => {
  const metaInfo = await getMetaInfo();

  const { avatar = '' } = metaInfo ?? {};

  return <HeaderClient avatar={avatar} navNodes={navNodes} />;
};

export default Header;
