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
      // Full-bleed photo has the hair running off the top edge, which a circular
      // Android mask would clip. This one is inset to sit inside the safe zone.
      {
        src: '/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
