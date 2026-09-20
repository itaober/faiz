# Faiz

Hey, I am Taober.

Requires Node.js 22.18 or newer.

## Environment variables

Faiz is a blog runtime, not one particular blog: the content it renders lives in a GitHub repo read
through the Contents API, and `GITHUB_CONTENT` says which one. It has no default — a default would
have to name somebody's blog, and deploying Faiz without noticing the variable would republish that
person's posts under your own domain.

| Variable                      | Required     | What it is                                                                                                                                                        |
| ----------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_CONTENT`              | always       | `owner/repo#branch` to read content from; `#branch` defaults to `content`. Anything else fails at startup rather than reaching GitHub.                            |
| `GITHUB_TOKEN`                | production   | Read-only token, raising the GitHub API rate limit from 60 to 5,000 requests/hour. Saving from the edit UI uses the visitor's `FAIZ_GITHUB_TOKEN` cookie instead. |
| `LINK_PREVIEW_SIGNING_SECRET` | production   | Any random string — `openssl rand -base64 32`. Signs favicon URLs so `/api/link-preview/icon` can't serve as an open image proxy. Unset, previews drop favicons.  |
| `NEXT_DEV_ALLOWED_ORIGINS`    | no, dev only | Extra comma-separated origins allowed to reach the dev server, on top of localhost and the machine's LAN IPs.                                                     |

On Vercel, set `GITHUB_CONTENT` for **both Production and Preview** — a preview build without it
fails the same way production would. Add `GITHUB_TOKEN` and `LINK_PREVIEW_SIGNING_SECRET` as
**Secret** type.

The branch named by `GITHUB_CONTENT` holds the content, not the app:

```
data/meta.json                 name, bio, avatar, social, and `site`
data/posts.json                the post index
data/posts/*.mdx
data/memos/memos-YYYYMM.json
data/records.json
assets/**                      images referenced by the above
```

The site URL behind canonical links, Open Graph tags, `sitemap.xml` and `feed.xml` is **not** an
environment variable: it is `site` in `data/meta.json`.
