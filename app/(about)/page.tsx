import { getMetaInfo } from '@/lib/data/meta';

export default async function About() {
  const metaInfo = await getMetaInfo();

  if (!metaInfo) {
    return <div>Error loading metaInfo data.</div>;
  }

  return (
    <div className="">
      <main className="row-start-2 flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold">{metaInfo.name}</h1>
        <p className="text-xl">{metaInfo.bio}</p>
        {metaInfo.social?.github && (
          <a
            href={metaInfo.social.github}
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
