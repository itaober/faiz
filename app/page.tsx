import { getAuthorInfo } from '@/lib/data/meta';

export default async function Home() {
  const authorInfo = await getAuthorInfo();

  if (!authorInfo) {
    return <div>Error loading authorInfo data.</div>;
  }

  return (
    <div className="grid min-h-screen grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-sans sm:p-20">
      <main className="row-start-2 flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold">{authorInfo.name}</h1>
        <p className="text-xl">{authorInfo.bio}</p>
        {authorInfo.social?.github && (
          <a
            href={authorInfo.social.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            GitHub
          </a>
        )}
      </main>
    </div>
  );
}
