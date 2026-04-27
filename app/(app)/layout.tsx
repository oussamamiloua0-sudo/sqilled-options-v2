import { Sidebar } from '@/components/Sidebar';
import { Providers } from '@/components/Providers';
import { PostHogIdentify } from '@/components/PostHogIdentify';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <PostHogIdentify />
      <div className="overflow-hidden h-screen flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 p-8">
            {children}
          </div>
          <footer className="py-4 text-center text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
            For educational purposes only. Not financial advice.
          </footer>
        </main>
      </div>
    </Providers>
  );
}
