import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { getAuthorInfo } from '@/lib/data/meta';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const authorInfo = await getAuthorInfo();

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
