import Image from 'next/image';
import Link from 'next/link';

import { getMetaInfo } from '@/lib/data/meta';

const Header = async () => {
  const metaInfo = await getMetaInfo();

  const { avatar = '' } = metaInfo ?? {};

  return (
    <header className="sticky top-0 z-50 w-full bg-white/30 backdrop-blur-md">
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
          <ul className="text-gray-500 hover:text-gray-700">
            <li>
              <Link href="/posts">Blog</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
