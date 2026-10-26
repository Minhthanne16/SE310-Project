import type { Metadata } from 'next';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'SE310 Products',
  description: 'Product management',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
