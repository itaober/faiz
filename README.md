# Faiz

Hey, I am Taober.

## Environment

Faiz requires Node.js 22.6 or newer.

Set a private signing secret in production so link-preview favicon URLs cannot be used as an open image proxy:

```bash
LINK_PREVIEW_SIGNING_SECRET="$(openssl rand -base64 32)"
```

Without this variable, production link previews omit favicons. Development uses a local-only fallback secret.
