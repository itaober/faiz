import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

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
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Header />
        <main className="mx-auto max-w-3xl px-6 pt-20">{children}</main>
      </body>
    </html>
  );
}
