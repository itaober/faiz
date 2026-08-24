import { buildSearchDocs } from '@/lib/search/build-search-index';

// Written into the static build as /search-index.json; regenerates per deploy.
export const dynamic = 'force-static';

export async function GET() {
  const docs = await buildSearchDocs();
  return Response.json({ docs });
}
