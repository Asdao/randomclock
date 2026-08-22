import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'time in',
  description: 'A quiet place to mark time.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
