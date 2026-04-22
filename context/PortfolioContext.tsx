'use client';

import { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react';

const useBrowserLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type Position = {
  id: number;
  symbol: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  currentPrice: number;
};

const defaultPositions: Position[] = [
  { id: 1, symbol: 'AAPL', shares: 150, entryPrice: 175.50, entryDate: '2023-11-15', currentPrice: 189.30 },
  { id: 2, symbol: 'MSFT', shares: 80,  entryPrice: 350.20, entryDate: '2023-10-02', currentPrice: 405.15 },
  { id: 3, symbol: 'NVDA', shares: 45,  entryPrice: 480.00, entryDate: '2023-12-01', currentPrice: 720.50 },
  { id: 4, symbol: 'AMZN', shares: 200, entryPrice: 135.00, entryDate: '2023-09-15', currentPrice: 175.00 },
];

const STORAGE_KEY = 'sqilled_portfolio';

function loadFromStorage(): Position[] {
  if (typeof window === 'undefined') return defaultPositions;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultPositions;
}

function saveToStorage(positions: Position[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)); } catch {}
}

type PortfolioContextType = {
  positions: Position[];
  setPositions: (positions: Position[]) => void;
};

const PortfolioContext = createContext<PortfolioContextType>({
  positions: defaultPositions,
  setPositions: () => {},
});

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [positions, setPositionsState] = useState<Position[]>(defaultPositions);

  useBrowserLayoutEffect(() => {
    setPositionsState(loadFromStorage());
  }, []);

  const setPositions = (next: Position[]) => {
    setPositionsState(next);
    saveToStorage(next);
  };

  return (
    <PortfolioContext.Provider value={{ positions, setPositions }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  return useContext(PortfolioContext);
}
