import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Providers } from '@/components/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'sqilled Options',
  description: 'Options analytics tool for portfolio performance and covered call overlay simulation.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="font-sans antialiased bg-[var(--color-background)] text-[var(--color-text-main)] overflow-hidden h-screen flex flex-col md:flex-row">
        <Providers>
          <Sidebar />
          <main className="flex-1 overflow-y-auto flex flex-col">
            <div className="flex-1 p-8">
              {children}
            </div>
            <footer className="py-4 text-center text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
              For educational purposes only. Not financial advice.
            </footer>
          </main>
        </Providers>
      </body>
    </html>
  );
}
