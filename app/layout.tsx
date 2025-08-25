import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';

import { getMetaInfo } from '@/lib/data/meta';

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
    return { title: 'Faiz' };
  }

  return {
    title: `${authorInfo.name}'s Blog`,
    description: authorInfo?.bio,
    icons: authorInfo?.avatar,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
