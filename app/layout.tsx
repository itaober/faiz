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

  return {
    title: {
      default: authorInfo.name,
      template: `%s - ${authorInfo.name}`,
    },
    description: authorInfo?.bio,
    icons: authorInfo?.avatar,
    alternates: {
      canonical: authorInfo?.site,
      types: {
        'application/rss+xml': [
          {
            url: `${authorInfo?.site}/feed.xml`,
            title: 'RSS Feed',
          },
        ],
      },
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
