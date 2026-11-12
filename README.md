# Faiz

Taober's blog ([blog.itaober.com](https://blog.itaober.com)). The app holds no content, so anyone
can run their own copy on their own Cloudflare R2 buckets.

Next.js 16, React 19, Tailwind CSS 4, MDX; hosted on Vercel. Needs Node.js 22.18+ and pnpm.

## Storage

| What                                      | Where                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Posts, pages, memos, records, `site.json` | Private content bucket                                                                  |
| Images                                    | Public assets bucket on a custom domain, under the site's folder, resized by Cloudflare |
| Old versions                              | `_history/<key>/<time>` in the content bucket, deleted after 90 days                    |
| Local dev                                 | `<content-bucket>-dev` and `<folder>-dev`, so local edits never reach the live site     |

Content keys: `site.json`, `posts/_index.json` (post list), `posts/<slug>.mdx`, `pages/about.mdx`,
`pages/lines.mdx`, `memos/YYYY-MM.json`, `records.json`. The site URL (canonical links, sitemap,
feed) is `site` in `site.json`, not an env var.

## Set up

```sh
pnpm install
npx wrangler login
pnpm setup:cloudflare --assets-bucket example-assets --assets-domain assets.example.com \
  --folder blog --content-bucket blog-content --origin https://blog.example.com \
  --zone-id <zone-id> --seed
```

| Flag               | What                                                  | Default (this blog)        |
| ------------------ | ----------------------------------------------------- | -------------------------- |
| `--assets-bucket`  | Images bucket; several sites can share it             | `itaober-assets`           |
| `--assets-domain`  | Its custom domain                                     | `assets.itaober.com`       |
| `--folder`         | This site's folder in it                              | `faiz`                     |
| `--content-bucket` | This site's content bucket                            | `faiz-content`             |
| `--origin`         | Site URL for the starter `site.json`                  | `https://blog.itaober.com` |
| `--zone-id`        | Zone of the assets domain, to connect it              | none                       |
| `--account-id`     | Only if your login sees several accounts              | the only one               |
| `--seed`           | Write starter `site.json`, About and Lines if missing | off                        |

It creates the buckets (content, content `-dev`, assets), CORS, history expiry and domain, then
prints a `.env.local` block and a Vercel block with fresh edit keys. Safe to re-run; keep the
`EDIT_KEY`s you already use. Then, in the Cloudflare dashboard (the script prints these too):

1. R2 object storage → API Tokens → Manage → Create Account API token, **Object Read & Write** on
   the three buckets. Put its Access Key ID and Secret Access Key into both blocks.
2. Images → Transformations → the assets domain's zone → **Enable for zone**.

Paste the `.env.local` block into `.env.local` and run `pnpm dev` (http://localhost:1999).

## Environment variables

How to generate each value: [`.env.example`](.env.example).

| Variable                                   | Required      | What                                                                  |
| ------------------------------------------ | ------------- | --------------------------------------------------------------------- |
| `R2_ACCOUNT_ID`                            | yes           | Cloudflare account ID                                                 |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | yes           | The R2 API token                                                      |
| `R2_ASSETS_BUCKET`, `R2_CONTENT_BUCKET`    | yes           | Bucket names                                                          |
| `NEXT_PUBLIC_ASSETS_URL`                   | yes, at build | `https://<assets-domain>/<folder>`; redeploy after changing it        |
| `EDIT_KEY`                                 | yes           | Edit sign-in key; changing it signs every browser out                 |
| `LINK_PREVIEW_SIGNING_SECRET`              | production    | Signs link-preview favicon URLs; without it previews have no favicons |
| `NEXT_DEV_ALLOWED_ORIGINS`                 | no            | Dev only: extra origins allowed to reach the dev server               |

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fitaober%2Ffaiz&env=R2_ACCOUNT_ID,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_ASSETS_BUCKET,R2_CONTENT_BUCKET,NEXT_PUBLIC_ASSETS_URL,EDIT_KEY,LINK_PREVIEW_SIGNING_SECRET&envDescription=Printed%20by%20pnpm%20setup%3Acloudflare&envLink=https%3A%2F%2Fgithub.com%2Fitaober%2Ffaiz%23environment-variables)

- Paste the Vercel block for **both Production and Preview**; mark `R2_SECRET_ACCESS_KEY`,
  `EDIT_KEY` and `LINK_PREVIEW_SIGNING_SECRET` as Sensitive.
- Previews use the live buckets: a save on a preview shows on the live site within a minute.

## Edit

- Click a page title five times for edit mode. The first save asks for `EDIT_KEY`; the browser
  then stays signed in for 90 days.
- Every overwrite or delete first copies the old version to `_history/<key>/<time>`.
- **Roll back a file:** in the R2 dashboard, download its version from `_history/<key>/` and
  upload it as `<key>`. If a rolled-back post's title, tags, date or pin differ, save it once in
  edit mode so the post list matches.
- **Restore a deleted post:** upload its MDX as `posts/<slug>.mdx`, then add its entry (from a
  `_history/` copy of `posts/_index.json`) back into the current `posts/_index.json`, in date
  order. Keep every other entry; never replace the whole index with an old copy.

## Clean up images

Edits never delete images. This deletes those no content or `_history/` copy mentions any more:

```sh
pnpm clean:images           # dry run, on .env.local (dev)
pnpm clean:images --apply   # delete

# Live site: real env vars override .env.local
R2_CONTENT_BUCKET=faiz-content NEXT_PUBLIC_ASSETS_URL=https://assets.itaober.com/faiz pnpm clean:images
```

## Cost

- **R2:** free up to 10 GB stored, 1M writes and 10M reads a month; egress is free. Past that it
  bills, with no hard cap: set a budget alert (Manage Account → Billing → Billable Usage → Create
  budget alert) and a Usage Based Billing notification for R2 (Notifications → Add).
- **Image transformations:** 5,000 unique (image × width) a month free. Past that the Free plan
  doesn't charge: new sizes fall back to the original file, sizes already made keep working.
