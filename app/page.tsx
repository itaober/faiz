import { getUser } from '@/lib/data/get-user';

export default async function Home() {
  const user = await getUser();

  if (!user) {
    return <div>Error loading user data.</div>;
  }

  return (
    <div className="grid min-h-screen grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-sans sm:p-20">
      <main className="row-start-2 flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold">{user.name}</h1>
        <p className="text-xl">{user.bio}</p>
        {user.social?.github && (
          <a
            href={user.social.github}
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
