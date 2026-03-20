'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

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

type PortfolioContextType = {
  positions: Position[];
  setPositions: (positions: Position[]) => void;
};

const PortfolioContext = createContext<PortfolioContextType>({
  positions: defaultPositions,
  setPositions: () => {},
});

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<Position[]>(defaultPositions);
  return (
    <PortfolioContext.Provider value={{ positions, setPositions }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  return useContext(PortfolioContext);
}
