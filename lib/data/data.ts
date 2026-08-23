import { cachedResource, fetchGitHubJson } from './common';
import { MetaSchema, PostListSchema, RecordsSchema } from './schemas';

export * from './schemas';

const META_PATH = 'data/meta.json';
const RECORDS_PATH = 'data/records.json';

export const getMetaInfo = cachedResource(
  'meta',
  async () => MetaSchema.parse(await fetchGitHubJson(META_PATH)),
  null,
);

export const getRecordsInfo = cachedResource(
  'records',
  async () => RecordsSchema.parse(await fetchGitHubJson(RECORDS_PATH)),
  null,
);

export const getPostListInfo = cachedResource(
  'post list',
  async () => PostListSchema.parse(await fetchGitHubJson('data/posts.json')),
  null,
);
