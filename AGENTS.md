# Repository Guidelines

## Project Overview

Faiz is a Next.js App Router site with React, TypeScript, and Tailwind CSS. Production is a fully static export (`output: 'export'`) served from Cloudflare Workers static assets; the in-page editing write path runs in a small Cloudflare Worker (`worker/`). Content lives in the `content` git branch and is read from a `CONTENT_DIR` checkout at build time (GitHub API at dev time). See README for the architecture and deploy runbook.

## Project Structure & Module Organization

- `app/` — route segments, layouts, and pages (App Router). No runtime API routes — dynamic endpoints live in the worker.
- `worker/` — Cloudflare Worker: `/api/edit/*` write endpoints, edit-token cookie, image + link-preview fallbacks. Type-checked by `worker/tsconfig.json` (workerd globals, no DOM).
- `app/_components/` and `components/` — shared UI components.
- `hooks/` — custom React hooks.
- `lib/` — utilities, data helpers, and shared types. `lib/data/github.ts` is the Next-free GitHub transport shared with the worker; `lib/data/common.ts` is the app-side read layer (CONTENT_DIR vs API).
- `scripts/` — build-time generators (image variants, link previews), run after `next build`.
- `public/` — static assets served at `/`.
- Root configs: `next.config.ts`, `wrangler.jsonc`, `tsconfig.json`, `biome.jsonc`, `postcss.config.mjs`.

## Build, Test, and Development Commands

Use `pnpm` (preferred by hooks and scripts).

- `pnpm dev` — start the dev server on port 1999.
- `pnpm dev:worker` — start the worker on port 8787 (dev rewrites proxy `/api/*` to it; required for editing).
- `CONTENT_DIR=… pnpm build` — static export into `out/` from a content-branch checkout.
- `pnpm preview` — serve `out/` + the worker locally via wrangler, like production.
- `pnpm lint` — run Biome lint + format checks.
- `pnpm lint:fix` — auto-fix lint and formatting issues.
- `pnpm format` — format code with Biome.
- `pnpm test` — run the lightweight Node assertion tests in `tests/*.test.mjs`.
- `pnpm exec tsc -p worker --noEmit` — type-check the worker (CI runs it too).

## Coding Style & Naming Conventions

- Formatting and linting are both handled by Biome (`biome.jsonc`). Run `pnpm lint:fix` before committing.
- Suppress a rule with `// biome-ignore lint/<group>/<rule>: <reason>` — the reason is required.
- File naming: components and hooks use kebab-case (e.g., `components/theme-toggle.tsx`, `hooks/use-image-upload.ts`).
- Hooks should be prefixed with `use-`. Imports can use the `@/*` alias from the repo root.
- Follow the KISS (Keep It Simple) principle because simple, direct solutions are easier to maintain and review.

## Testing Guidelines

Lightweight regression tests live in `tests/*.test.mjs` and run with `pnpm test`. If you add a broader test runner later, document the command here and keep naming consistent (e.g., `*.test.tsx`).

## Commit & Pull Request Guidelines

- Commit messages follow Conventional Commits (e.g., `feat: add memo pagination`, `fix: handle empty feed`), enforced by commitlint.
- PRs should include a short summary, testing notes (e.g., `pnpm lint`), and screenshots for UI changes.
- Link related issues if applicable and call out any follow-up work.

## Configuration & Secrets

Local secrets live in `.env`. Do not commit real credentials; use placeholders or document required keys in the README if new ones are introduced.
