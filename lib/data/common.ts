// ================================
// GitHub Token & Base URLs
// ================================
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface IGetGitHubBaseUrlOptions {
  username: string;
  repo: string;
  branch?: string;
}

const getGitHubBaseUrl = ({ username, repo, branch = 'main' }: IGetGitHubBaseUrlOptions) =>
  `https://raw.githubusercontent.com/${username}/${repo}/${branch}`;

export const GITHUB_RAW_BASE_URL = getGitHubBaseUrl({
  username: 'itaober',
  repo: 'faiz',
  branch: 'main',
});

// ================================
// GitHub API URL Generator
// ================================
const genGitHubApiUrl = (
  path: string,
  { username, repo, branch = 'main' }: IGetGitHubBaseUrlOptions,
) => `https://api.github.com/repos/${username}/${repo}/contents/${path}?ref=${branch}`;

// ================================
// Low-level Fetch Functions
// ================================
const fetchGitHubRaw = async (path: string, init?: RequestInit) => {
  const url = `${GITHUB_RAW_BASE_URL}/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    ...init,
    next: {
      revalidate: 5 * 60,
      ...init?.next,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }
  return res;
};

const fetchGitHubApi = async (path: string, init?: RequestInit) => {
  const url = genGitHubApiUrl(path, { username: 'itaober', repo: 'faiz', branch: 'main' });
  const res = await fetch(url, {
    ...init,
    next: {
      revalidate: 5 * 60,
      ...init?.next,
    },
    headers: {
      ...init?.headers,
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }
  return res;
};

// ================================
// Convenience Fetch Wrappers
// ================================
export const fetchGitHubText = (path: string, init?: RequestInit) =>
  fetchGitHubRaw(path, init).then(res => res.text());

export const fetchGitHubJson = <T = object>(path: string, init?: RequestInit) =>
  fetchGitHubRaw(path, init).then(res => res.json() as Promise<T>);

// ================================
// GitHub Directory Listing
// ================================
export const fetchGitHubDir = async (dir: string, init?: RequestInit) => {
  try {
    const res = await fetchGitHubApi(dir, init);

    const data: { name: string; path: string; type: string }[] = await res.json();
    return data.filter(item => item.type === 'file').map(item => item.path);
  } catch (err) {
    console.error(`Failed to fetch GitHub directory ${dir}:`, err);
    return [];
  }
};
