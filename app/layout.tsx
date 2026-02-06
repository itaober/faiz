import './globals.css';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
import { SnowEffect } from '@/components/snow-effect';
import { ThemeScript, ThemeSync } from '@/components/theme-script';
import { getMetaInfo } from '@/lib/data/data';
import { buildDescription } from '@/lib/utils/seo';

import Header from './_components/header';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

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
    authorInfo?.avatar && authorInfo.avatar.startsWith('/') && authorInfo.site
      ? new URL(authorInfo.avatar, authorInfo.site).toString()
      : authorInfo?.avatar;

  return {
    metadataBase: siteUrl,
    title: {
      default: authorInfo.name,
      template: `%s - ${authorInfo.name}`,
    },
    description: buildDescription(authorInfo?.bio, authorInfo.name),
    icons: authorInfo?.avatar,
    authors: authorInfo?.site ? [{ name: authorInfo.name, url: authorInfo.site }] : undefined,
    alternates: {
      types: {
        'application/rss+xml': [
          {
            url: `${authorInfo?.site}/feed.xml`,
            title: 'RSS Feed',
          },
        ],
      },
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
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <ThemeScript />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeSync />
          <SnowEffect density="normal" />
          <Header />
          <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
        </ThemeProvider>
        <Toaster position="top-center" style={{ top: '10%' }} duration={2000} />
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
