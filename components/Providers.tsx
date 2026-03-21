'use client';

import { Suspense } from 'react';
import { PortfolioProvider } from '@/context/PortfolioContext';
import { PostHogProvider } from '@/components/PostHogProvider';
import { PostHogPageView } from '@/components/PostHogPageView';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <PortfolioProvider>
        <Suspense fallback={null}>
          <PostHogPageView />
        </Suspense>
        {children}
      </PortfolioProvider>
    </PostHogProvider>
  );
}
