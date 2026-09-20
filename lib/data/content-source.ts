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
 * Required rather than defaulted. A default would have to name somebody's blog,
 * and anyone deploying Faiz without noticing the variable would publish a copy
 * of that person's posts under their own domain.
 *
 * Lives apart from `common.ts` so the tests can import it without pulling in
 * `next/cache`.
 */
export const parseContentSource = (value: string | undefined): IGitHubApiOptions => {
  const [, owner, repo, branch] = /^([\w.-]+)\/([\w.-]+)(?:#([\w./-]+))?$/.exec(value ?? '') ?? [];
  if (!owner || !repo) {
    throw new Error(
      `GITHUB_CONTENT must name the repo holding this blog's content as "owner/repo#branch" (#branch defaults to "content"); got ${
        value === undefined ? 'no value at all' : `"${value}"`
      }`,
    );
  }
  return { owner, repo, branch: branch || 'content' };
};
