import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Interview Memory',
  description: 'Notion-powered spaced interview practice',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff9800"><circle cx="12" cy="12" r="10"/><path stroke="%23131313" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" d="M8 12h8M9 8v8M15 8v8"/><circle cx="9" cy="12" r="1" fill="%23131313"/><circle cx="15" cy="12" r="1" fill="%23131313"/></svg>',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
