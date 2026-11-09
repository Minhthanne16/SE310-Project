import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import '../src/index.css';

// Phông theo docs/DESIGN.md: Be Vietnam Pro cho giao diện, JetBrains Mono chỉ cho mã, route, tên tệp.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'QLKLTN',
  description: 'Quản lý khóa luận tốt nghiệp',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${jetBrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
