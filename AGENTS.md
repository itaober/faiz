# Repository Guidelines

## Project Overview

Faiz is a Next.js App Router site with React, TypeScript, and Tailwind CSS. The app uses MDX for content and ships static assets from `public/`.

## Project Structure & Module Organization

- `app/` — route segments, layouts, and pages (App Router). API handlers live in `app/api/`.
- `app/_components/` and `components/` — shared UI components.
- `hooks/` — custom React hooks.
- `lib/` — utilities, data helpers, and shared types.
- `public/` — static assets served at `/`.
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`.

## Build, Test, and Development Commands

Use `pnpm` (preferred by hooks and scripts).

- `pnpm dev` — start the dev server on port 1999.
- `pnpm build` — create a production build.
- `pnpm start` — run the production server after a build.
- `pnpm lint` — run Next.js ESLint checks.
- `pnpm lint:fix` — auto-fix lint issues.
- `pnpm format` — format code with Prettier.

## Coding Style & Naming Conventions

- Formatting is enforced by Prettier (`.prettierrc.mjs`). Run `pnpm format` before committing.
- Linting uses a shared ESLint config (`@itaober/eslint-config`). Fix issues with `pnpm lint:fix`.
- File naming: components and hooks use kebab-case (e.g., `components/theme-toggle.tsx`, `hooks/use-image-upload.ts`).
- Hooks should be prefixed with `use-`. Imports can use the `@/*` alias from the repo root.
- Follow the KISS (Keep It Simple) principle because simple, direct solutions are easier to maintain and review.

## Testing Guidelines

There is no test runner configured yet (no `test` script or test files). If you add tests, document the command in this file and keep naming consistent (e.g., `*.test.tsx`).

## Commit & Pull Request Guidelines

- Commit messages follow Conventional Commits (e.g., `feat: add memo pagination`, `fix: handle empty feed`), enforced by commitlint.
- PRs should include a short summary, testing notes (e.g., `pnpm lint`), and screenshots for UI changes.
- Link related issues if applicable and call out any follow-up work.

## Configuration & Secrets

Local secrets live in `.env`. Do not commit real credentials; use placeholders or document required keys in the README if new ones are introduced.
