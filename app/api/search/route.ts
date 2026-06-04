import { buildSearchDocs } from '@/lib/search/build-search-index';

// Cache the aggregated index; it rides the `github-content` fetch tags underneath,
// so saving content invalidates it and the next request rebuilds fresh.
export const revalidate = 300;

export async function GET() {
  const docs = await buildSearchDocs();
  return Response.json({ docs });
}
