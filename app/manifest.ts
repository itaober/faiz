import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Pins the app's identity independently of start_url. Without it browsers
    // derive the identity from start_url, so moving the blog to another domain
    // or changing the entry path registers as a different app and installed
    // copies stop receiving updates.
    id: '/',
    name: "Taober's Faiz",
    short_name: 'Faiz',
    description: 'Hey, I am Taober.',
    lang: 'zh-CN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // --background in globals.css. The previous values predated the current
    // palette, so the splash screen flashed a slightly different beige than the
    // page it handed over to.
    background_color: '#f8f9f6',
    theme_color: '#f8f9f6',
    // Halftone renders of the About page's portrait, so the installed app looks
    // like the site rather than like a cropped selfie. Regenerate with
    // `node scripts/generate-icons.mjs <cutout.png>`.
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      // The portrait runs the full height of the square, so a circular Android
      // mask would clip it. This one is scaled down to clear the safe zone.
      {
        src: '/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
