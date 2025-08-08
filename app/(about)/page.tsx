import { MDXRemote } from 'next-mdx-remote/rsc';

import { getAboutMDX } from '@/lib/data/mdx';

export default async function About() {
  const aboutMDX = await getAboutMDX();
  const { content, data } = aboutMDX ?? {};

  return (
    <div className="max-w-4xl overflow-y-hidden">
      <div>
        <h1>{data.title}</h1>
        <article>
          <MDXRemote source={content} />
        </article>
      </div>
    </div>
  );
}
