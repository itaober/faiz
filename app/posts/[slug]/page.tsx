import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';

import { getPostMDX } from '@/lib/data/mdx';

interface IPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PostPage({ params }: IPostPageProps) {
  const { slug } = await params;

  const post = await getPostMDX(decodeURIComponent(slug));

  if (!post) {
    notFound();
  }

  const { content, data } = post;

  return (
    <article className="max-w-4xl overflow-y-hidden">
      <h1 className="mb-8 text-4xl font-extrabold">{data.title}</h1>
      <article className="prose dark:prose-invert">
        <MDXRemote source={content} />
      </article>
    </article>
  );
}
