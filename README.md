# Faiz

Hey, I am Taober.

Requires Node.js 22.18 or newer.

## Deploy your own

Faiz is a blog runtime, not one particular blog: everything it renders lives in your own
Cloudflare R2 buckets. You need a Cloudflare account with a domain on it (images are served from a
subdomain of it) and a Vercel account.

1. **Buckets.** Log in once with `npx wrangler login`, then run with your own names:

   ```sh
   pnpm setup:cloudflare --assets-bucket example-assets --assets-domain assets.example.com \
     --folder blog --content-bucket blog-content --origin https://blog.example.com --zone-id <zone id> \
     --seed
   ```

   It creates the buckets, CORS and history cleanup, connects the domain, writes a starter
   `site.json` plus About and Lines pages (`--seed`; edit them later), and prints the environment variables
   with fresh edit keys. Re-running is safe. The zone ID is on the domain's
   Overview page in the Cloudflare dashboard.

2. **Two dashboard clicks**, which the script also lists:
   - R2 object storage → API Tokens → Manage → Create Account API token with **Object Read &
     Write** on the three buckets. Its Access Key ID and Secret Access Key go into the printed blocks.
   - Images → Transformations → your zone → **Enable for zone**, so images are resized at the edge.

3. **Deploy.** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fitaober%2Ffaiz&env=R2_ACCOUNT_ID,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_ASSETS_BUCKET,R2_CONTENT_BUCKET,NEXT_PUBLIC_ASSETS_URL,EDIT_KEY,LINK_PREVIEW_SIGNING_SECRET&envDescription=Printed%20by%20pnpm%20setup%3Acloudflare&envLink=https%3A%2F%2Fgithub.com%2Fitaober%2Ffaiz%23environment-variables)
   and paste the printed Vercel block.

4. **Sign in.** Open the site, click a page title five times to enter edit mode, and give the
   Vercel block's `EDIT_KEY` when the first save asks for it.

## Environment variables

| Variable                      | Required     | What it is                                                                                                                                                       |
| ----------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `R2_ACCOUNT_ID`               | always       | Cloudflare account ID; the R2 endpoint is `https://<id>.r2.cloudflarestorage.com`.                                                                               |
| `R2_ACCESS_KEY_ID`            | always       | Access Key ID of an R2 API token with Object Read & Write on the three buckets (content, its -dev twin, assets).                                                 |
| `R2_SECRET_ACCESS_KEY`        | always       | That token's Secret Access Key.                                                                                                                                  |
| `R2_ASSETS_BUCKET`            | always       | Public bucket for images. Several sites can share it, each in its own folder.                                                                                    |
| `R2_CONTENT_BUCKET`           | always       | Private bucket with this site's content.                                                                                                                         |
| `NEXT_PUBLIC_ASSETS_URL`      | always       | Public URL of this site's folder in the assets bucket, e.g. `https://assets.example.com/blog`. Built into the client: redeploy after changing it.                 |
| `EDIT_KEY`                    | always       | 32 random bytes, base64url. The only way to sign in for editing; changing it signs every browser out.                                                           |
| `LINK_PREVIEW_SIGNING_SECRET` | production   | Any random string — `openssl rand -base64 32`. Signs favicon URLs so `/api/link-preview/icon` can't serve as an open image proxy. Unset, previews drop favicons. |
| `NEXT_DEV_ALLOWED_ORIGINS`    | no, dev only | Extra comma-separated origins allowed to reach the dev server, on top of localhost and the machine's LAN IPs.                                                    |

On Vercel, set them for **both Production and Preview** — a preview build without them fails the
same way production would. Preview then edits the live buckets: a save there shows on the live
site within a minute. Mark `R2_SECRET_ACCESS_KEY`, `EDIT_KEY` and
`LINK_PREVIEW_SIGNING_SECRET` as **Sensitive**.

The content bucket holds the content, not the app:

```
site.json                name, bio, avatar, social, and `site`
posts/_index.json        the post index, rebuilt on every save
posts/<slug>.mdx
pages/about.mdx          and pages/lines.mdx
memos/YYYY-MM.json
records.json
_history/<key>/<time>    the version before each overwrite or delete, kept 90 days
```

Images live in the assets bucket under the folder (`blog/memos/…`, `blog/posts/…`, `blog/site/…`).
Content stores them relative to it (`memos/x.webp`), so moving the domain or folder never touches
content.

The site URL behind canonical links, Open Graph tags, `sitemap.xml` and `feed.xml` is **not** an
environment variable: it is `site` in `site.json`.

## Local development

Put the `.env.local` block from `pnpm setup:cloudflare` in `.env.local` (see `.env.example`). It points at
`<content-bucket>-dev` and `<folder>-dev` in the same assets bucket, so nothing done locally reaches
the live site. `pnpm dev` serves http://localhost:1999.

## Editing

Click a page title five times for edit mode. The first save asks for the edit key; the browser then
keeps a signed, httpOnly session cookie for 90 days. Images go from the browser straight to the
assets bucket through a short-lived signed URL. Every overwrite or delete first copies the previous
version to `_history/`, where it stays for 90 days; get it back from the R2 dashboard.

Edits never delete images, so a restored version still finds its pictures. To free the space of
images nothing mentions any more, history included:

```sh
pnpm clean:images            # dry run: what would go
pnpm clean:images --apply    # delete it
```

Like `migrate:github` below, it works on what `.env.local` points at; prefix the production values
for the live site.

## Cost

- **R2** free tier, per month: 10 GB stored, 1M writes, 10M reads; egress is free. There is **no
  hard cap** — past the free tier it bills. Set a budget alert (Manage Account → Billing → Billable
  Usage → Create budget alert) and a Usage Based Billing notification for R2 (Notifications → Add).
- **Image transformations**: 5,000 unique (image × size) per month free. On the Free plan there is
  no charge past that: new sizes fall back to the original file, so pages keep working, just
  heavier, and sizes already made keep being served.

## Moving from GitHub content

A site that kept its content on a GitHub `content` branch copies it over once, from a local checkout:

```sh
git -C ../faiz-content pull
pnpm migrate:github           # dry run: the plan, what the buckets hold, anything it cannot rewrite
pnpm migrate:github --apply   # write, then verify
```

It writes where `.env.local` points (the dev bucket and folder). For the live site, prefix the
production values; real environment variables win over `.env.local`:
`R2_CONTENT_BUCKET=faiz-content NEXT_PUBLIC_ASSETS_URL=https://assets.itaober.com/faiz pnpm migrate:github --apply`.
Re-running skips what is already there; `--overwrite` also replaces content that changed since, and
keeps the replaced version in `_history/`.
