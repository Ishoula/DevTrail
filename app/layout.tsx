import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { SpeedInsights } from "@vercel/speed-insights/next";
import Loading from './loading';
import React, { Suspense } from 'react';
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DevTrail - Developer Productivity Dashboard',
  description: 'Track your development productivity with projects, tasks, and GitHub analytics',
 
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <Suspense fallback={<Loading />}>
            {children}
          </Suspense>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
