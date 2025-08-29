// ================================
// GitHub Token & Base URLs
// ================================
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface IGitHubApiOptions {
  username: string;
  repo: string;
  branch?: string;
}

const GIT_HUB_API_OPTIONS: IGitHubApiOptions = {
  username: 'itaober',
  repo: 'faiz',
  branch: 'content',
};

const getGitHubApiUrl = (path: string, { username, repo, branch } = GIT_HUB_API_OPTIONS) =>
  `https://api.github.com/repos/${username}/${repo}/contents/${path}?ref=${branch}`;

// ================================
// Low-level Fetch Functions
// ================================
const fetchGitHubApi = async (path: string, init?: RequestInit) => {
  const url = getGitHubApiUrl(path);

  try {
    const res = await fetch(url, {
      ...init,
      next: {
        revalidate: 5 * 60,
        ...init?.next,
      },
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'faiz-blog',
        ...init?.headers,
        ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    return res;
  } catch (error) {
    console.error('Failed to fetch:', path, error);
    throw error;
  }
};

// ================================
// Convenience Fetch Wrappers
// ================================
export const fetchGitHubText = async (path: string, init?: RequestInit) => {
  const res = await fetchGitHubApi(path, init);
  return res.text();
};

export const fetchGitHubJson = async <T = object>(path: string, init?: RequestInit) => {
  const res = await fetchGitHubApi(path, init);
  return res.json() as Promise<T>;
};

// ================================
// GitHub Directory Listing
// ================================
export const fetchGitHubDir = async (dir: string, init?: RequestInit) => {
  try {
    const res = await fetchGitHubApi(dir, {
      ...init,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...init?.headers,
      },
    });

    const data: { name: string; path: string; type: string }[] = await res.json();
    return data.filter(item => item.type === 'file').map(item => item.path);
  } catch (err) {
    console.error(`Failed to fetch GitHub directory ${dir}:`, err);
    return [];
  }
};

// ================================
// File Content Fetching
// ================================
export const fetchGitHubFile = async (path: string, init?: RequestInit) => {
  try {
    const res = await fetchGitHubApi(path, {
      ...init,
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        ...init?.headers,
      },
    });

    return {
      content: await res.text(),
      status: res.status,
      headers: res.headers,
    };
  } catch (error) {
    console.error(`Failed to fetch GitHub file ${path}:`, error);
    throw error;
  }
};
