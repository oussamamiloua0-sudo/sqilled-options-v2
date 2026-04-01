'use client';

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity, ArrowDownRight, Target } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { usePostHog } from 'posthog-js/react';

const BENCHMARKS = [
  { key: 'SPY', label: 'SPY', color: '#94A3B8' },
  { key: 'QQQ', label: 'QQQ', color: '#F59E0B' },
  { key: 'IWM', label: 'IWM', color: '#10B981' },
] as const;

type BenchmarkKey = 'SPY' | 'QQQ' | 'IWM';
type ViewMode = 'pct' | 'dollar';

const PRESETS = ['1M','3M','6M','YTD','1Y','3Y','5Y'] as const;
type Preset = typeof PRESETS[number] | 'custom';

function getStartDate(preset: Preset): string {
  const today = new Date();
  switch (preset) {
    case '1M':  { const d = new Date(today); d.setMonth(d.getMonth()-1);      return d.toISOString().slice(0,10); }
    case '3M':  { const d = new Date(today); d.setMonth(d.getMonth()-3);      return d.toISOString().slice(0,10); }
    case '6M':  { const d = new Date(today); d.setMonth(d.getMonth()-6);      return d.toISOString().slice(0,10); }
    case 'YTD': return `${today.getFullYear()}-01-01`;
    case '1Y':  { const d = new Date(today); d.setFullYear(d.getFullYear()-1); return d.toISOString().slice(0,10); }
    case '3Y':  { const d = new Date(today); d.setFullYear(d.getFullYear()-3); return d.toISOString().slice(0,10); }
    case '5Y':  { const d = new Date(today); d.setFullYear(d.getFullYear()-5); return d.toISOString().slice(0,10); }
    default:    return '2023-09-15';
  }
}

function fmtAxisDate(val: string): string {
  const [year, month] = val.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function maxDrawdown(values: number[]): number {
  let peak = values[0], maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function annualizedVol(values: number[]): number {
  if (values.length < 2) return 0;
  const returns = values.slice(1).map((v, i) => (v - values[i]) / values[i]);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function sharpe(values: number[]): number {
  if (values.length < 2) return 0;
  const returns = values.slice(1).map((v, i) => (v - values[i]) / values[i]);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return ((mean - 0.05 / 252) / std) * Math.sqrt(252);
}

export default function AnalyticsPage() {
  const { positions } = usePortfolio();
  const posthog = usePostHog();
  const [benchmark, setBenchmark] = useState<BenchmarkKey>('SPY');

  const handleBenchmarkChange = (b: BenchmarkKey) => {
    setBenchmark(b);
    posthog?.capture('benchmark_compared', { benchmark: b });
  };
  const [viewMode, setViewMode]   = useState<ViewMode>('pct');
  const [preset, setPreset]       = useState<Preset>('1Y');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');

  const [rawData, setRawData] = useState<{ date: string; portfolio: number; SPY: number; QQQ: number; IWM: number }[]>([]);
  const [metrics, setMetrics] = useState({ totalReturn: 0, vol: 0, maxDD: 0, sharpeRatio: 0 });
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const fetchData = useCallback(async (startDate: string, endDate: string, currentPositions: typeof positions) => {
    setLoading(true);
    const fetchPrices = (symbol: string) =>
      fetch(`/api/prices?symbol=${symbol}&start=${startDate}&end=${endDate}`)
        .then(r => r.json())
        .then(d => ({ symbol, dates: (d.dates ?? []) as string[], close: (d.close ?? []) as number[] }))
        .catch(() => ({ symbol, dates: [], close: [] }));

    const results = await Promise.all([
      ...currentPositions.map(p => fetchPrices(p.symbol)),
      fetchPrices('SPY'), fetchPrices('QQQ'), fetchPrices('IWM'),
    ]);

    const spyData = results.find(r => r.symbol === 'SPY')!;
    const allDates = spyData.dates;
    if (!allDates.length) { setLoading(false); return; }

    const priceMap: Record<string, Record<string, number>> = {};
    for (const r of results) {
      priceMap[r.symbol] = {};
      r.dates.forEach((d, i) => { priceMap[r.symbol][d] = r.close[i]; });
    }

    const fill = (symbol: string, dates: string[]) => {
      let last = 0;
      return dates.map(d => { if (priceMap[symbol]?.[d]) last = priceMap[symbol][d]; return last; });
    };

    const portfolioValues = allDates.map(d =>
      currentPositions.reduce((sum, p) => {
        const price = priceMap[p.symbol]?.[d] ?? 0;
        return sum + (price ? p.shares * price : 0);
      }, 0)
    );

    const firstValidIdx = allDates.findIndex(d => currentPositions.every(p => priceMap[p.symbol]?.[d]));
    if (firstValidIdx < 0) { setLoading(false); return; }

    const slicedDates    = allDates.slice(firstValidIdx);
    const slicedPortfolio = portfolioValues.slice(firstValidIdx);
    const startValue     = slicedPortfolio[0];

    const spyFilled = fill('SPY', slicedDates);
    const qqqFilled = fill('QQQ', slicedDates);
    const iwmFilled = fill('IWM', slicedDates);

    const rows = slicedDates.map((date, i) => ({
      date: date.slice(0, 7),
      portfolio: slicedPortfolio[i],
      SPY: spyFilled[i],
      QQQ: qqqFilled[i],
      IWM: iwmFilled[i],
    }));

    // Sample monthly
    const sampled: typeof rows = [];
    let lastMonth = '';
    for (const row of rows) {
      if (row.date !== lastMonth) { sampled.push(row); lastMonth = row.date; }
    }
    if (rows.length && sampled[sampled.length - 1].date !== rows[rows.length - 1].date) {
      sampled.push(rows[rows.length - 1]);
    }

    setRawData(sampled);
    const costBasis = currentPositions.reduce((sum, p) => sum + p.shares * p.entryPrice, 0);
    const currentValue = slicedPortfolio[slicedPortfolio.length - 1];
    const totalReturn = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;
    setMetrics({
      totalReturn: parseFloat(totalReturn.toFixed(1)),
      vol: parseFloat(annualizedVol(slicedPortfolio).toFixed(1)),
      maxDD: parseFloat(maxDrawdown(slicedPortfolio).toFixed(1)),
      sharpeRatio: parseFloat(sharpe(slicedPortfolio).toFixed(2)),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const start = preset === 'custom' ? (customStart || getStartDate('1Y')) : getStartDate(preset);
    const end   = preset === 'custom' ? (customEnd || today) : today;
    fetchData(start, end, positions);
  }, [preset, positions, fetchData]);

  // Transform rawData based on viewMode
  const chartData = (() => {
    if (!rawData.length) return [];
    const s = rawData[0];
    return rawData.map(row => ({
      date: row.date,
      portfolio: viewMode === 'pct'
        ? parseFloat(((row.portfolio / s.portfolio - 1) * 100).toFixed(2))
        : parseFloat(((row.portfolio / s.portfolio) * 10000).toFixed(2)),
      SPY: viewMode === 'pct'
        ? parseFloat(((row.SPY / s.SPY - 1) * 100).toFixed(2))
        : parseFloat(((row.SPY / s.SPY) * 10000).toFixed(2)),
      QQQ: viewMode === 'pct'
        ? parseFloat(((row.QQQ / s.QQQ - 1) * 100).toFixed(2))
        : parseFloat(((row.QQQ / s.QQQ) * 10000).toFixed(2)),
      IWM: viewMode === 'pct'
        ? parseFloat(((row.IWM / s.IWM - 1) * 100).toFixed(2))
        : parseFloat(((row.IWM / s.IWM) * 10000).toFixed(2)),
    }));
  })();

  const benchmarkMeta = BENCHMARKS.find(b => b.key === benchmark)!;
  const metricCards = [
    { title: 'Total Return',          value: `${metrics.totalReturn >= 0 ? '+' : ''}${metrics.totalReturn}%`, icon: TrendingUp,     color: metrics.totalReturn >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]', bg: 'bg-[var(--color-success)]/10' },
    { title: 'Annualized Volatility', value: `${metrics.vol}%`,                                                icon: Activity,      color: 'text-[var(--color-primary)]',  bg: 'bg-[var(--color-primary)]/10' },
    { title: 'Max Drawdown',          value: `-${metrics.maxDD}%`,                                             icon: ArrowDownRight, color: 'text-[var(--color-danger)]',   bg: 'bg-[var(--color-danger)]/10'  },
    { title: 'Sharpe Ratio',          value: String(metrics.sharpeRatio),                                      icon: Target,        color: 'text-[var(--color-accent)]',   bg: 'bg-[var(--color-accent)]/10'  },
  ];

  const yFormatter = (v: number) =>
    viewMode === 'pct' ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : `$${(v / 1000).toFixed(1)}k`;

  const tooltipFormatter = (value: any) =>
    viewMode === 'pct' ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%` : `$${Number(value).toLocaleString()}`;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Performance Analytics</h1>
        <p className="text-[var(--color-text-muted)] mt-1">Portfolio vs Benchmark</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm hover:border-[var(--color-primary)]/50 transition-colors group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{metric.title}</h3>
                <div className={`p-2 rounded-lg ${metric.bg} ${metric.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className={`text-3xl font-mono font-bold ${metric.color}`}>
                {loading ? '—' : metric.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm">
        {/* Chart header row */}
        <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-sm font-medium">
            <button onClick={() => setViewMode('pct')}
              className={`px-4 py-2 transition-colors ${viewMode === 'pct' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}>
              Returns %
            </button>
            <button onClick={() => setViewMode('dollar')}
              className={`px-4 py-2 transition-colors ${viewMode === 'dollar' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}>
              Growth of $10k
            </button>
          </div>

          {/* Date presets */}
          <div className="flex items-center gap-1 flex-wrap">
            {PRESETS.map(p => (
              <button key={p} onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                  preset === p
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                }`}>{p}</button>
            ))}
            <button onClick={() => setPreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                preset === 'custom'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
              }`}>Custom</button>
          </div>

          {/* Benchmark selector */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-3 text-sm font-medium">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[var(--color-primary)]" />
                <span className="text-white">Portfolio</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: benchmarkMeta.color }} />
                <span className="text-[var(--color-text-muted)]">{benchmark}</span>
              </div>
            </div>
            <div className="flex space-x-1">
              {BENCHMARKS.map(b => (
                <button key={b.key} onClick={() => handleBenchmarkChange(b.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                    benchmark === b.key ? 'text-white' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                  }`}
                  style={benchmark === b.key ? { backgroundColor: b.color } : {}}
                >{b.key}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom date inputs */}
        {preset === 'custom' && (
          <div className="flex items-center gap-3 mb-4">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]" />
            <span className="text-[var(--color-text-muted)] text-sm">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]" />
            <button onClick={() => fetchData(customStart || getStartDate('1Y'), customEnd || today, positions)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors">
              Apply
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12, fontFamily: 'var(--font-mono)' }} tickMargin={10} axisLine={false} tickFormatter={fmtAxisDate} />
                <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12, fontFamily: 'var(--font-mono)' }} tickFormatter={yFormatter} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={(value: any) => [tooltipFormatter(value), undefined]}
                  labelFormatter={(val: any) => fmtAxisDate(String(val))}
                  labelStyle={{ color: '#94A3B8', marginBottom: '8px' }}
                />
                <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="var(--color-primary)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'var(--color-primary)', stroke: '#0B1120', strokeWidth: 2 }} />
                <Line type="monotone" dataKey={benchmark} name={benchmark} stroke={benchmarkMeta.color} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 6, fill: benchmarkMeta.color, stroke: '#0B1120', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
