'use client';

import { PortfolioProvider } from '@/context/PortfolioContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <PortfolioProvider>{children}</PortfolioProvider>;
}
