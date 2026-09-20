# Faiz

Hey, I am Taober.

Requires Node.js 22.18 or newer.

## Environment variables

Faiz is a blog runtime, not one particular blog: the content it renders lives in a GitHub repo read
through the Contents API, and which repo that is can be pointed anywhere.

| Variable                      | Required   | Default                | What it is                                                                                                                                                       |
| ----------------------------- | ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`                | production | —                      | Read-only token, raising the GitHub API rate limit from 60 to 5,000 requests/hour. Saving from the edit UI uses the visitor's `FAIZ_GITHUB_TOKEN` cookie instead. |
| `LINK_PREVIEW_SIGNING_SECRET` | production | —                      | Any random string — `openssl rand -base64 32`. Signs favicon URLs so `/api/link-preview/icon` can't serve as an open image proxy. Unset, previews drop favicons.  |
| `GITHUB_CONTENT`              | no         | `itaober/faiz#content` | `owner/repo#branch` to read content from; `#branch` defaults to `content`. Anything not shaped like `owner/repo` fails at startup.                                |
| `NEXT_DEV_ALLOWED_ORIGINS`    | dev only   | —                      | Extra comma-separated origins allowed to reach the dev server, on top of localhost and the machine's LAN IPs.                                                     |

On Vercel, add the two production variables as **Secret** type. Nothing else is required.

The site URL behind canonical links, Open Graph tags, `sitemap.xml` and `feed.xml` is **not** an
environment variable: it is `site` in `data/meta.json` on the content branch.
