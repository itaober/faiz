import { MDXRemote } from 'next-mdx-remote/rsc';

import { getAboutMDX } from '@/lib/data/mdx';

export default async function About() {
  const aboutMDX = await getAboutMDX();

  if (!aboutMDX) {
    // TODO: Empty status
    return null;
  }

  const { content, data } = aboutMDX;

  return (
    <div className="h-[1000px] max-w-4xl overflow-y-hidden">
      <h1 className="mb-8 text-4xl font-extrabold">{data.title}</h1>
      <article className="prose dark:prose-invert">
        <MDXRemote source={content} />
      </article>
    </div>
  );
}
