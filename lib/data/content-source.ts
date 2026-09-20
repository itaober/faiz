/** GitHub API configuration options interface */
export interface IGitHubApiOptions {
  owner: string;
  repo: string;
  branch?: string;
}

/**
 * Parses `owner/repo#branch`, the whole content source in one variable: Faiz is
 * a blog runtime, so the repo changes per deployment, not just its branch. The
 * branch may be omitted. Validated here, at the single place it is set — owner
 * and repo go straight into the GitHub API path.
 *
 * Lives apart from `common.ts` so the tests can import it without pulling in
 * `next/cache`.
 */
export const parseContentSource = (value: string): IGitHubApiOptions => {
  const [, owner, repo, branch] = /^([\w.-]+)\/([\w.-]+)(?:#([\w./-]+))?$/.exec(value) ?? [];
  if (!owner || !repo) {
    throw new Error(`GITHUB_CONTENT must look like "owner/repo#branch", got "${value}"`);
  }
  return { owner, repo, branch: branch || 'content' };
};
