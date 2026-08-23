# Faiz

Hey, I am Taober.

## Architecture

Static core + a minimal write-path worker, deployed on Cloudflare:

- Visitors get a fully static site: `next build` runs with `output: 'export'`,
  prerendering every page from a checkout of the `content` branch
  (`CONTENT_DIR`). Images ship as static files at their original
  `/api/image/assets/…` URLs plus width variants under `/images/w{width}/…`;
  hover previews for external links are precomputed into `/link-previews.json`.
- In-page editing stays live: the tiptap editors call `POST /api/edit/*` on a
  Cloudflare Worker (`worker/`), which writes to the `content` branch through
  the GitHub Contents API with the author's PAT (httpOnly cookie, set via
  `/api/edit-token`). The worker holds no secrets. It also serves not-yet-built
  images and link previews as fallbacks.
- Every push to `main` or `content` — editor saves included, since each save is
  a real commit — triggers `.github/workflows/deploy.yml`: checkout both
  branches → static build → image variants → link previews → `wrangler deploy`.
  Publish latency is the build, roughly 2–4 minutes.

## Development

Requires Node.js 22.18+ and pnpm.

```bash
pnpm dev          # Next dev server on :1999 (reads content via the GitHub API)
pnpm dev:worker   # write-path worker on :8787; dev rewrites proxy /api/* to it
```

Run both for editing: saves, image uploads, the edit-token drawer and
link-preview fallbacks all go through the worker. Optional `.env.local`:
`GITHUB_TOKEN` (higher API read quota in dev), `GITHUB_CONTENT_BRANCH`
(point dev at a test content branch — also `.dev.vars` for the worker).

## Static build & preview

```bash
git fetch origin content && git worktree add /tmp/faiz-content origin/content
CONTENT_DIR=/tmp/faiz-content pnpm build
CONTENT_DIR=/tmp/faiz-content node scripts/build-image-variants.mjs
CONTENT_DIR=/tmp/faiz-content node scripts/build-link-previews.mjs
pnpm preview   # serves out/ + the worker, like production
```

## Deploy (one-time setup)

1. Repo secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit) and
   `CLOUDFLARE_ACCOUNT_ID`.
2. The `content` branch needs its own trigger shim — push-event workflows only
   run from files on the pushed ref. Commit this as
   `.github/workflows/trigger-deploy.yml` on `content`:

   ```yaml
   name: Trigger deploy
   on:
     push:
       branches: [content]
   permissions:
     actions: write
   jobs:
     trigger:
       runs-on: ubuntu-latest
       steps:
         - run: gh workflow run deploy.yml --ref main -R "$GITHUB_REPOSITORY"
           env:
             GH_TOKEN: ${{ github.token }}
   ```

3. Cutover, once the workers.dev preview checks out: add the custom domain to
   `wrangler.jsonc` (`"routes": [{ "pattern": "www.taober.blog",
   "custom_domain": true }]`), remove the old `www` DNS record if it blocks the
   route, and enable Cloudflare Web Analytics on the zone (auto-injection —
   no code).
