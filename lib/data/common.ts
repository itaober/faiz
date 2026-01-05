import dayjs from 'dayjs';

/** GitHub Token from environment variables */
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * Generates a unique ID
 *
 * @example
 *   generateId('memo'); // => 'memo_20231211120000_a1b2c3d4'
 *   generateId(); // => '20231211120000_a1b2c3d4'
 *
 * @param prefix - Optional ID prefix
 * @returns Unique identifier in format `[prefix_]YYYYMMDDHHmmss_xxxxxxxx`
 */
export const generateId = (prefix?: string): string => {
  const now = new Date();
  const base = dayjs(now).format('YYYYMMDDHHmmss');
  /** 8-character short hash containing [0-9a-z] */
  const rand = Math.random().toString(36).slice(2, 10);
  const id = `${base}_${rand}`;
  return prefix ? `${prefix}_${id}` : id;
};

/**
 * Gets GitHub token with priority for provided token over environment variable
 *
 * @param providedToken - User-provided token, takes priority over env variable
 * @returns Valid GitHub token
 */
const getGitHubToken = (providedToken?: string) => {
  return providedToken || GITHUB_TOKEN;
};

/** GitHub API configuration options interface */
interface IGitHubApiOptions {
  owner: string;
  repo: string;
  branch?: string;
}

/** Default GitHub API configuration */
export const GIT_HUB_API_OPTIONS: IGitHubApiOptions = {
  owner: 'itaober',
  repo: 'faiz',
  branch: 'content',
};

/**
 * Builds GitHub Contents API URL
 *
 * @param path - File path within the repository
 * @param options - GitHub API configuration options
 * @returns Complete GitHub API URL
 */
const getGitHubApiUrl = (path: string, { owner, repo, branch } = GIT_HUB_API_OPTIONS) =>
  `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

/**
 * Low-level GitHub API fetch function
 *
 * @param path - File path within the repository
 * @param init - Optional fetch configuration
 * @param token - Optional GitHub token
 * @returns Fetch Response object
 * @throws Error when API request fails
 */
export const fetchGitHubApi = async (path: string, init?: RequestInit, token?: string) => {
  const url = getGitHubApiUrl(path);
  const authToken = getGitHubToken(token);

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
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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

/**
 * Fetches raw text content from a GitHub file
 *
 * @param path - File path within the repository
 * @param init - Optional fetch configuration
 * @param token - Optional GitHub token
 * @returns File text content
 */
export const fetchGitHubText = async (path: string, init?: RequestInit, token?: string) => {
  const res = await fetchGitHubApi(path, init, token);
  return res.text();
};

/**
 * Fetches JSON content from a GitHub file
 *
 * @template T - Type of the JSON data
 * @param path - File path within the repository
 * @param init - Optional fetch configuration
 * @param token - Optional GitHub token
 * @returns Parsed JSON data
 */
export const fetchGitHubJson = async <T = object>(
  path: string,
  init?: RequestInit,
  token?: string,
) => {
  const res = await fetchGitHubApi(path, init, token);
  return res.json() as Promise<T>;
};

/**
 * Fetches list of files in a GitHub directory
 *
 * @param dir - Directory path
 * @param init - Optional fetch configuration
 * @param token - Optional GitHub token
 * @returns Array of file paths in the directory
 */
export const fetchGitHubDir = async (dir: string, init?: RequestInit, token?: string) => {
  try {
    const res = await fetchGitHubApi(
      dir,
      {
        ...init,
        headers: {
          Accept: 'application/vnd.github.v3+json',
          ...init?.headers,
        },
      },
      token,
    );

    const data: { name: string; path: string; type: string }[] = await res.json();
    return data.filter(item => item.type === 'file').map(item => item.path);
  } catch (err) {
    console.error(`Failed to fetch GitHub directory ${dir}:`, err);
    return [];
  }
};

/**
 * Fetches GitHub file content with response metadata
 *
 * @param path - File path within the repository
 * @param init - Optional fetch configuration
 * @param token - Optional GitHub token
 * @returns Object containing file content, status code, and headers
 */
export const fetchGitHubFile = async (path: string, init?: RequestInit, token?: string) => {
  try {
    const res = await fetchGitHubApi(
      path,
      {
        ...init,
        headers: {
          Accept: 'application/vnd.github.v3.raw',
          ...init?.headers,
        },
      },
      token,
    );

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

/** GitHub file content metadata interface */
interface IGitHubContentMeta {
  sha?: string;
}

/**
 * Fetches GitHub file metadata (primarily for getting SHA)
 *
 * Uses Contents API URL, not raw content URL
 *
 * @param path - File path within the repository
 * @param token - Optional GitHub token
 * @returns File metadata, or null if file doesn't exist
 */
const fetchGitHubContentsMeta = async (
  path: string,
  token?: string,
): Promise<IGitHubContentMeta | null> => {
  const url = getGitHubApiUrl(path);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'faiz-blog',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }

      throw new Error(`GitHub contents meta error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { sha?: string };
    return { sha: data.sha };
  } catch (error) {
    console.error('Failed to fetch GitHub contents meta:', path, error);
    throw error;
  }
};

/** Options for writing GitHub files */
interface IPutGitHubFileOptions {
  /** Base64 encoded file content */
  contentBase64: string;
  /** Git commit message */
  message: string;
}

/**
 * Creates or updates a GitHub file
 *
 * Uses Contents API URL, not raw content URL
 *
 * @param path - File path within the repository
 * @param options - Write configuration (content and commit message)
 * @param token - GitHub token (required for authentication)
 * @throws Error when API request fails
 */
export const putGitHubFile = async (
  path: string,
  options: IPutGitHubFileOptions,
  token?: string,
) => {
  const url = getGitHubApiUrl(path);

  const meta = await fetchGitHubContentsMeta(path, token);

  const body: {
    message: string;
    content: string;
    sha?: string;
    branch?: string;
  } = {
    message: options.message,
    content: options.contentBase64,
    sha: meta?.sha,
    branch: GIT_HUB_API_OPTIONS.branch,
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'faiz-blog',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Failed to put GitHub file:', path, res.status, res.statusText, errorText);
    throw new Error(`Failed to put GitHub file: ${path} - ${res.status} ${res.statusText}`);
  }
};

/**
 * Writes data as JSON to a GitHub file
 *
 * @param path - File path within the repository
 * @param data - Data to write
 * @param message - Optional Git commit message
 * @param token - GitHub token (required for authentication)
 */
export const writeGitHubJson = async (
  path: string,
  data: unknown,
  message?: string,
  token?: string,
) => {
  const json = JSON.stringify(data, null, 2);
  const contentBase64 = Buffer.from(json, 'utf8').toString('base64');

  await putGitHubFile(
    path,
    {
      contentBase64,
      message: message ?? `Update ${path}`,
    },
    token,
  );
};

/**
 * Deletes a file from the GitHub repository
 *
 * @param path - File path within the repository
 * @param message - Git commit message
 * @param token - GitHub token (required for authentication)
 * @returns True if deleted successfully, false if file doesn't exist
 * @throws Error when API request fails (except 404)
 */
export const deleteGitHubFile = async (
  path: string,
  message: string,
  token?: string,
): Promise<boolean> => {
  const url = getGitHubApiUrl(path);

  // 获取文件 SHA
  const meta = await fetchGitHubContentsMeta(path, token);

  // 文件不存在，视为已删除
  if (!meta?.sha) {
    return false;
  }

  const body = {
    message,
    sha: meta.sha,
    branch: GIT_HUB_API_OPTIONS.branch,
  };

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'faiz-blog',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // 404 表示文件已不存在
    if (res.status === 404) {
      return false;
    }
    const errorText = await res.text();
    console.error('Failed to delete GitHub file:', path, res.status, res.statusText, errorText);
    throw new Error(`Failed to delete GitHub file: ${path} - ${res.status} ${res.statusText}`);
  }

  return true;
};
