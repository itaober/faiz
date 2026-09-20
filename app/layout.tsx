import './globals.css';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

import { EditModeProvider } from '@/components/edit-mode-provider';
import { EditDockProvider } from '@/components/editing/edit-dock';
import { MotionProvider } from '@/components/motion-provider';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
import { ThemeScript } from '@/components/theme-script';
import { ThemeSync } from '@/components/theme-sync';
import { getMetaInfo } from '@/lib/data/data';
import { buildDescription, RSS_ALTERNATE_TYPES } from '@/lib/utils/seo';

import BackToTop from './_components/back-to-top';
import Header from './_components/header';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  fallback: [
    'ui-sans-serif',
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'Noto Sans',
    'sans-serif',
    'Apple Color Emoji',
    'Segoe UI Emoji',
    'Segoe UI Symbol',
    'Noto Color Emoji',
  ],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Android Chrome 108+ / Firefox 132+: shrink the layout viewport when the soft
// keyboard opens so fixed panels (drawers, edit dock) dock above it instead of
// being covered. iOS ignores interactive-widget; vaul + the tiptap toolbar's
// visualViewport tracking cover that path.
export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
  // Lets the page paint into the display cutout, and — the reason it is here —
  // makes `env(safe-area-inset-*)` report real values. Without it iOS insets the
  // standalone webview itself and every inset reads 0, so the fixed panels that
  // already guard with `max(1.25rem, env(safe-area-inset-bottom))` were silently
  // taking the 1.25rem branch and sitting under the home indicator.
  viewportFit: 'cover',
  // iOS tints the standalone status bar from this, never from the manifest's
  // theme_color. Both values are --background in globals.css, resolved to sRGB
  // because Safari will not take an oklch() here.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#121210' },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const authorInfo = await getMetaInfo();

  if (!authorInfo) {
    return {
      title: {
        default: 'Faiz',
        template: '%s - Faiz',
      },
    };
  }

  const siteUrl = authorInfo?.site ? new URL(authorInfo.site) : undefined;
  const avatarUrl =
    authorInfo?.avatar?.startsWith('/') && authorInfo.site
      ? new URL(authorInfo.avatar, authorInfo.site).toString()
      : authorInfo?.avatar;

  return {
    metadataBase: siteUrl,
    title: {
      default: authorInfo.name,
      template: `%s - ${authorInfo.name}`,
    },
    description: buildDescription(authorInfo?.bio, authorInfo.name),
    // Not the avatar: `site`'s avatar is the 3024px original, and pointing the
    // favicon at it made every visitor download 276 KB to paint 16 CSS pixels.
    // These are the same face, pre-sized in public/ alongside the manifest icons.
    icons: {
      icon: [
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    },
    authors: authorInfo?.site ? [{ name: authorInfo.name, url: authorInfo.site }] : undefined,
    alternates: {
      types: RSS_ALTERNATE_TYPES,
    },
    openGraph: {
      title: authorInfo.name,
      description: buildDescription(authorInfo?.bio, authorInfo.name),
      url: authorInfo?.site,
      siteName: authorInfo.name,
      type: 'website',
      images: avatarUrl ? [{ url: avatarUrl }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: authorInfo.name,
      description: buildDescription(authorInfo?.bio, authorInfo.name),
      images: avatarUrl ? [avatarUrl] : undefined,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <MotionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ThemeSync />
            <EditModeProvider>
              <EditDockProvider>
                <Header />
                <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
                <BackToTop />
              </EditDockProvider>
            </EditModeProvider>
          </ThemeProvider>
        </MotionProvider>
        <Toaster position="top-center" style={{ top: '10%' }} duration={2000} />
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
