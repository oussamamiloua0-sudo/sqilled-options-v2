'use client';

import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Play, Settings2, Activity, Eye, EyeOff, TrendingDown, DollarSign,
  Calendar, BarChart2, Clock, Trophy, AlertCircle, List, LayoutList,
} from 'lucide-react';
import { usePortfolio, Position } from '@/context/PortfolioContext';

type ViewMode = 'pct' | 'dollar';
type ResultTab = 'summary' | 'details' | 'logs';
const PRESETS = ['3M','6M','YTD','1Y','2Y','3Y'] as const;
type Preset = typeof PRESETS[number] | 'custom';

function presetToDates(preset: Preset): { start: string; end: string } {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  switch (preset) {
    case '3M':  { const d = new Date(today); d.setMonth(d.getMonth()-3);       return { start: d.toISOString().slice(0,10), end }; }
    case '6M':  { const d = new Date(today); d.setMonth(d.getMonth()-6);       return { start: d.toISOString().slice(0,10), end }; }
    case 'YTD': return { start: `${today.getFullYear()}-01-01`, end };
    case '1Y':  { const d = new Date(today); d.setFullYear(d.getFullYear()-1); return { start: d.toISOString().slice(0,10), end }; }
    case '2Y':  { const d = new Date(today); d.setFullYear(d.getFullYear()-2); return { start: d.toISOString().slice(0,10), end }; }
    case '3Y':  { const d = new Date(today); d.setFullYear(d.getFullYear()-3); return { start: d.toISOString().slice(0,10), end }; }
    default:    return { start: '2023-01-01', end };
  }
}

function fmtAxisDate(val: string): string {
  const [year, month] = val.split('-');
  if (!year || !month) return val;
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const SCENARIOS = [
  { key: 'exit25',  label: 'Close at 25%',   color: '#6366F1', shortLabel: '25%'    },
  { key: 'exit50',  label: 'Close at 50%',   color: '#F59E0B', shortLabel: '50%'    },
  { key: 'exitExp', label: 'Hold to Expiry', color: '#10B981', shortLabel: 'Expiry' },
] as const;

type ScenarioKey = 'exit25' | 'exit50' | 'exitExp';
const TICKERS = ['SPY', 'QQQ', 'IWM'] as const;

// Mock trade log — deterministic (no Math.random) to avoid SSR hydration mismatch
function buildMockTrades(scenario: ScenarioKey) {
  const months   = ['2023-01','2023-02','2023-03','2023-04','2023-05','2023-06','2023-07','2023-08','2023-09','2023-10','2023-11','2023-12','2024-01','2024-02','2024-03','2024-04','2024-05','2024-06'];
  const strikes  = [405,408,411,415,418,421,424,427,430,433,437,440,445,449,453,458,462,466];
  const premiums = [1.85,1.92,2.10,2.34,1.76,2.55,2.20,1.98,2.40,1.65,2.80,2.15,2.50,2.30,2.70,2.10,2.45,2.60];
  const daysMap  = { exit25: [9,10,11,9,12,10,8,11,13,9,10,12,11,9,10,13,11,10], exit50: [18,20,22,19,24,21,17,22,25,18,21,24,22,18,20,26,22,20], exitExp: [30,35,30,35,30,35,30,35,30,35,30,35,30,35,30,35,30,35] };
  // exitExp: assign losses at indices 4,10,16 (every ~6 trades)
  const lossSet = new Set([4,10,16]);
  return months.map((m, i) => {
    const premium   = premiums[i];
    const daysHeld  = daysMap[scenario][i];
    const closePrice = scenario === 'exit25' ? parseFloat((premium * 0.25).toFixed(2))
      : scenario === 'exit50' ? parseFloat((premium * 0.50).toFixed(2))
      : lossSet.has(i) ? parseFloat((premium * 1.2).toFixed(2)) : 0;
    const pnl = parseFloat(((premium - closePrice) * 100).toFixed(2));
    return {
      open_date:   `${m}-01`,
      expiry:      `${m}-${i % 2 === 0 ? 30 : 31}`,
      strike:      strikes[i],
      premium:     parseFloat(premium.toFixed(2)),
      close_price: closePrice,
      pnl,
      days_held:   daysHeld,
      capped:      closePrice > premium,
    };
  });
}

const MOCK_TRADE_LOG: Record<ScenarioKey, any[]> = {
  exit25:  buildMockTrades('exit25'),
  exit50:  buildMockTrades('exit50'),
  exitExp: buildMockTrades('exitExp'),
};
type Ticker = typeof TICKERS[number];

function MetricCard({ label, value, sub, color = 'text-white', icon: Icon }: {
  label: string; value: string; sub?: string; color?: string; icon: any;
}) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 shadow-sm">
      <div className="flex items-center space-x-2 mb-3">
        <Icon className="w-4 h-4 text-[var(--color-primary)]" />
        <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{label}</h3>
      </div>
      <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
      {sub && <p className="text-sm text-[var(--color-text-muted)] mt-1">{sub}</p>}
    </div>
  );
}

async function fetchPortfolioLine(positions: Position[], start: string, end: string): Promise<Record<string, number>> {
  if (!positions.length) return {};
  const results = await Promise.all(
    positions.map(p =>
      fetch(`/api/prices?symbol=${p.symbol}&start=${start}&end=${end}`)
        .then(r => r.json())
        .then(d => ({ symbol: p.symbol, shares: p.shares, dates: (d.dates ?? []) as string[], close: (d.close ?? []) as number[] }))
        .catch(() => ({ symbol: p.symbol, shares: p.shares, dates: [] as string[], close: [] as number[] }))
    )
  );
  const priceMap: Record<string, Record<string, number>> = {};
  for (const r of results) {
    priceMap[r.symbol] = {};
    r.dates.forEach((d, i) => { priceMap[r.symbol][d] = r.close[i]; });
  }
  const allDates = results.find(r => r.dates.length > 0)?.dates ?? [];
  const monthMap: Record<string, number> = {};
  for (const date of allDates) {
    const month = date.slice(0, 7);
    const val = positions.reduce((sum, p) => {
      const price = priceMap[p.symbol]?.[date] ?? 0;
      return sum + (price ? p.shares * price : 0);
    }, 0);
    if (val > 0) monthMap[month] = val;
  }
  const months = Object.keys(monthMap).sort();
  if (!months.length) return {};
  const base = monthMap[months[0]];
  const out: Record<string, number> = {};
  for (const m of months) out[m] = parseFloat(((monthMap[m] / base) * 100).toFixed(4));
  return out;
}

// Custom tooltip for Details bar chart
function PnLTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload;
  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-3 text-xs font-mono shadow-xl space-y-1">
      <p className="text-white font-bold">{t.open_date} → {t.expiry}</p>
      <p className="text-[var(--color-text-muted)]">Strike: <span className="text-white">${t.strike}</span></p>
      <p className="text-[var(--color-text-muted)]">Premium: <span className="text-white">${t.premium?.toFixed(2)}</span></p>
      <p className="text-[var(--color-text-muted)]">Close: <span className="text-white">${t.close_price?.toFixed(2)}</span></p>
      <p className="text-[var(--color-text-muted)]">P&amp;L: <span className={t.pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>${t.pnl?.toFixed(2)}</span></p>
      <p className="text-[var(--color-text-muted)]">Days held: <span className="text-white">{t.days_held}</span></p>
    </div>
  );
}

export default function OverlayPage() {
  const { positions } = usePortfolio();
  const [ticker, setTicker]         = useState<Ticker>('SPY');
  const [delta, setDelta]           = useState(0.25);
  const [dte, setDte]               = useState<30 | 45 | 60>(45);
  const [startDate, setStartDate]   = useState('2023-01-01');
  const [endDate, setEndDate]       = useState('2024-06-30');
  const [showScenarios, setShowScenarios] = useState(true);
  const [viewMode, setViewMode]     = useState<ViewMode>('pct');
  const [datePreset, setDatePreset] = useState<Preset>('custom');
  const [isSimulating, setIsSimulating]   = useState(false);
  const [hasSimulated, setHasSimulated]   = useState(false);
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('exit50');
  const [error, setError]           = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>('summary');

  const [showPortfolio, setShowPortfolio] = useState(true);
  const [portfolioLine, setPortfolioLine] = useState<Record<string, number>>({});

  // Real data from API
  const [chartData, setChartData]     = useState<any[]>([]);
  const [riskTable, setRiskTable]     = useState<any[]>([]);
  const [statsData, setStatsData]     = useState<Record<string, any>>({});
  const [bestScenario, setBestScenario] = useState<ScenarioKey>('exit50');
  const [tradeLog, setTradeLog]       = useState<Record<ScenarioKey, any[]>>(MOCK_TRADE_LOG);

  const handleSimulate = async () => {
    setIsSimulating(true);
    setError(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker, delta, dte, start: startDate, end: endDate }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();

      // Build chart data — zip dates + values
      const { dates, exit25, exit50, exitExp } = data.curves;
      const chart = dates.map((d: string, i: number) => ({
        month: d.slice(0, 7),
        exit25:  exit25[i],
        exit50:  exit50[i],
        exitExp: exitExp[i],
      }));
      setChartData(chart);
      setRiskTable(data.risk_table);
      setStatsData(data.stats);
      setTradeLog(data.trade_log ?? MOCK_TRADE_LOG);

      // Best scenario by total_return
      const best = data.risk_table.reduce((a: any, b: any) =>
        a.total_return > b.total_return ? a : b
      );
      setBestScenario(best.key as ScenarioKey);
      setHasSimulated(true);
      setShowScenarios(true);

      // Fetch base portfolio curve in parallel
      const portLine = await fetchPortfolioLine(positions, startDate, endDate);
      setPortfolioLine(portLine);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const activeStats = statsData[activeScenario] ?? {};
  const activeRisk  = riskTable.find(r => r.key === activeScenario) ?? {};
  const activeLog   = tradeLog[activeScenario] ?? [];

  const RESULT_TABS: { key: ResultTab; label: string; icon: any }[] = [
    { key: 'summary', label: 'Summary',  icon: BarChart2  },
    { key: 'details', label: 'Details',  icon: LayoutList },
    { key: 'logs',    label: 'Trade Log', icon: List      },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Covered Call Overlay</h1>
        <p className="text-[var(--color-text-muted)] mt-1">Simulate systematic call selling on your portfolio</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Controls ── */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm h-fit space-y-6">
          <div className="flex items-center space-x-2">
            <Settings2 className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-xl font-semibold text-white">Strategy Parameters</h2>
          </div>

          {/* Ticker */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider block mb-2">Underlying</label>
            <div className="flex space-x-2">
              {TICKERS.map(t => (
                <button key={t} onClick={() => setTicker(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-mono font-bold transition-colors ${
                    ticker === t
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Date Range</label>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map(p => (
                <button key={p} onClick={() => {
                  setDatePreset(p);
                  const { start, end } = presetToDates(p);
                  setStartDate(start);
                  setEndDate(end);
                }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                    datePreset === p
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                  }`}>{p}</button>
              ))}
              <button onClick={() => setDatePreset('custom')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                  datePreset === 'custom'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                }`}>Custom</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Start</p>
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setDatePreset('custom'); }}
                  className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">End</p>
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setDatePreset('custom'); }}
                  className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]" />
              </div>
            </div>
          </div>

          {/* Delta slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Target Delta</label>
              <span className="text-white font-mono text-sm">{Math.round(delta * 100)}</span>
            </div>
            <input type="range" min="0.17" max="0.30" step="0.01" value={delta}
              onChange={e => setDelta(parseFloat(e.target.value))}
              className="w-full h-2 bg-[var(--color-surface-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]" />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1 font-mono">
              <span>17Δ</span><span>30Δ</span>
            </div>
          </div>

          {/* DTE */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider block mb-2">Days to Expiration</label>
            <div className="flex space-x-2">
              {([30, 45, 60] as const).map(d => (
                <button key={d} onClick={() => setDte(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-mono font-bold transition-colors ${
                    dte === d
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                  }`}
                >{d}d</button>
              ))}
            </div>
          </div>

          <button onClick={handleSimulate} disabled={isSimulating}
            className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl font-medium transition-all ${
              isSimulating
                ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-lg shadow-[var(--color-primary)]/20'
            }`}
          >
            {isSimulating
              ? <><div className="w-5 h-5 border-2 border-[var(--color-text-muted)] border-t-transparent rounded-full animate-spin" /><span>Running...</span></>
              : <><Play className="w-5 h-5 fill-current" /><span>Run Simulation</span></>
            }
          </button>

          {error && (
            <div className="flex items-start space-x-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {hasSimulated && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Exit Scenarios</p>
              {SCENARIOS.map(s => (
                <div key={s.key} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="rounded-full" style={{ backgroundColor: s.color, width: 20, height: 3 }} />
                    <span className="text-sm text-white">{s.label}</span>
                  </div>
                  {s.key === bestScenario && (
                    <span className="flex items-center space-x-1 text-xs font-medium text-amber-400">
                      <Trophy className="w-3 h-3" /><span>Best</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Results ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Result tab switcher */}
          <div className="flex space-x-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-1 w-fit">
            {RESULT_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveResultTab(key)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeResultTab === key
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* ── Summary tab ── */}
          {activeResultTab === 'summary' && (
            <>
              {/* Performance chart */}
              <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm relative overflow-hidden">
                {!hasSimulated && (
                  <div className="absolute inset-0 z-10 bg-[var(--color-background)]/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center">
                      <Activity className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4 opacity-50" />
                      <p className="text-[var(--color-text-muted)] font-medium">Run simulation to view results</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-white">Performance Comparison</h2>
                  <div className="flex items-center gap-3">
                    <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-medium">
                      <button onClick={() => setViewMode('pct')}
                        className={`px-3 py-1.5 transition-colors ${viewMode === 'pct' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}>
                        Returns %
                      </button>
                      <button onClick={() => setViewMode('dollar')}
                        className={`px-3 py-1.5 transition-colors ${viewMode === 'dollar' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}>
                        Growth of $10k
                      </button>
                    </div>
                    <button onClick={() => setShowPortfolio(!showPortfolio)}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        showPortfolio
                          ? 'border-[#94A3B8] text-[#94A3B8] bg-[#94A3B8]/10'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[#94A3B8] hover:text-[#94A3B8]'
                      }`}
                    >
                      {showPortfolio ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      <span>Base Portfolio</span>
                    </button>
                    <button onClick={() => setShowScenarios(!showScenarios)}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        showScenarios
                          ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                      }`}
                    >
                      {showScenarios ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      <span>{showScenarios ? 'Scenarios On' : 'Scenarios Off'}</span>
                    </button>
                  </div>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData.map(d => {
                        const portRaw = portfolioLine[d.month];
                        return {
                          ...d,
                          exit25:    viewMode === 'pct' ? parseFloat((d.exit25  - 100).toFixed(2)) : parseFloat((d.exit25  * 100).toFixed(2)),
                          exit50:    viewMode === 'pct' ? parseFloat((d.exit50  - 100).toFixed(2)) : parseFloat((d.exit50  * 100).toFixed(2)),
                          exitExp:   viewMode === 'pct' ? parseFloat((d.exitExp - 100).toFixed(2)) : parseFloat((d.exitExp * 100).toFixed(2)),
                          portfolio: portRaw !== undefined
                            ? (viewMode === 'pct' ? parseFloat((portRaw - 100).toFixed(2)) : parseFloat((portRaw * 100).toFixed(2)))
                            : undefined,
                        };
                      })}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="month" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={fmtAxisDate} />
                      <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false}
                        tickFormatter={v => viewMode === 'pct' ? `${v >= 0 ? '+' : ''}${v.toFixed(0)}%` : `$${(v/1000).toFixed(1)}k`}
                        domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}
                        formatter={(value: any) => [viewMode === 'pct' ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%` : `$${Number(value).toLocaleString()}`, undefined]}
                        labelFormatter={(val: any) => fmtAxisDate(String(val))}
                      />
                      {showPortfolio && (
                        <Line type="monotone" dataKey="portfolio" name="Base Portfolio" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
                      )}
                      {showScenarios && SCENARIOS.map(s => (
                        <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Risk comparison */}
              <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 relative overflow-hidden">
                {!hasSimulated && <div className="absolute inset-0 z-10 bg-[var(--color-background)]/80 backdrop-blur-sm" />}
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Risk Comparison</p>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div className="text-[var(--color-text-muted)] font-medium space-y-3 pt-6">
                    <p>Max Drawdown</p>
                    <p>Total Return</p>
                    <p>Sharpe Ratio</p>
                  </div>
                  {SCENARIOS.map(s => {
                    const r = riskTable.find(x => x.key === s.key) ?? {};
                    const isBest = s.key === bestScenario;
                    return (
                      <div key={s.key} className={`text-center space-y-1 rounded-xl p-2 ${isBest ? 'bg-amber-500/10 border border-amber-500/30' : ''}`}>
                        <div className="flex items-center justify-center space-x-1 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <p className="text-xs font-medium" style={{ color: s.color }}>{s.shortLabel}</p>
                          {isBest && <Trophy className="w-3 h-3 text-amber-400" />}
                        </div>
                        <p className={`font-mono font-bold ${(r.max_drawdown ?? 0) > 10 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                          -{(r.max_drawdown ?? 0).toFixed(1)}%
                        </p>
                        <p className={`font-mono font-bold ${(r.total_return ?? 0) >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          {(r.total_return ?? 0) >= 0 ? '+' : ''}{(r.total_return ?? 0).toFixed(1)}%
                        </p>
                        <p className="font-mono font-bold" style={{ color: s.color }}>
                          {(r.sharpe ?? 0).toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trade stats */}
              <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 relative overflow-hidden">
                {!hasSimulated && <div className="absolute inset-0 z-10 bg-[var(--color-background)]/80 backdrop-blur-sm" />}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Trade Statistics</p>
                  <div className="flex space-x-1">
                    {SCENARIOS.map(s => (
                      <button key={s.key} onClick={() => setActiveScenario(s.key as ScenarioKey)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          activeScenario === s.key ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'
                        }`}
                        style={activeScenario === s.key ? { backgroundColor: s.color } : {}}
                      >{s.shortLabel}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricCard label="No. of Trades"  value={`${activeStats.num_trades ?? 0}`}  sub={`${activeStats.win_rate ?? 0}% win rate`} icon={BarChart2} />
                  <MetricCard label="Avg Premium"    value={`$${(activeStats.avg_premium ?? 0).toFixed(0)}`} sub="per trade" color="text-[var(--color-success)]" icon={DollarSign} />
                  <MetricCard label="Avg P&L"        value={`$${(activeStats.avg_pnl ?? 0).toFixed(0)}`}    sub="per trade" color={activeStats.avg_pnl >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'} icon={TrendingDown} />
                  <MetricCard label="Total P&L"      value={`$${(activeStats.total_pnl ?? 0).toFixed(0)}`}  sub="collected" color="text-[var(--color-success)]" icon={DollarSign} />
                  <MetricCard label="Avg Days Held"  value={`${activeStats.avg_days_held ?? 0}d`}           sub="per trade" icon={Clock} />
                  <MetricCard label="Win Rate"       value={`${activeStats.win_rate ?? 0}%`}                sub="profitable trades" color="text-[var(--color-success)]" icon={Calendar} />
                </div>
              </div>
            </>
          )}

          {/* ── Details tab — horizontal P&L bar chart per trade ── */}
          {activeResultTab === 'details' && (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-semibold text-white">P&amp;L per Trade</h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Each bar = one covered call cycle, sorted chronologically</p>
                </div>
                <div className="flex space-x-1">
                  {SCENARIOS.map(s => (
                    <button key={s.key} onClick={() => setActiveScenario(s.key as ScenarioKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeScenario === s.key ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'
                      }`}
                      style={activeScenario === s.key ? { backgroundColor: s.color } : {}}
                    >{s.shortLabel}</button>
                  ))}
                </div>
              </div>

              {activeLog.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)] text-sm">
                  No trade data available
                </div>
              ) : (
                <>
                  {/* Summary row */}
                  <div className="flex space-x-6 mb-4 text-sm font-mono">
                    <span className="text-[var(--color-text-muted)]">
                      Trades: <span className="text-white font-bold">{activeLog.length}</span>
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      Winners: <span className="text-[var(--color-success)] font-bold">
                        {activeLog.filter((t: any) => t.pnl >= 0).length}
                      </span>
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      Losers: <span className="text-[var(--color-danger)] font-bold">
                        {activeLog.filter((t: any) => t.pnl < 0).length}
                      </span>
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      Total P&amp;L: <span className={`font-bold ${activeLog.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                        ${activeLog.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0).toFixed(0)}
                      </span>
                    </span>
                  </div>

                  <div style={{ height: Math.max(300, activeLog.length * 28) }} className="w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={activeLog}
                        margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
                        barSize={16}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                        <XAxis
                          type="number"
                          stroke="#94A3B8"
                          tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={v => `$${v >= 0 ? '+' : ''}${v.toFixed(0)}`}
                        />
                        <YAxis
                          type="category"
                          dataKey="open_date"
                          stroke="#94A3B8"
                          tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                          axisLine={false}
                          tickLine={false}
                          width={76}
                        />
                        <Tooltip content={<PnLTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <ReferenceLine x={0} stroke="#475569" strokeWidth={1} />
                        <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                          {activeLog.map((entry: any, i: number) => (
                            <Cell
                              key={i}
                              fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'}
                              fillOpacity={0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Logs tab — full trade table ── */}
          {activeResultTab === 'logs' && (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-semibold text-white">Trade Log</h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">All trades for selected scenario</p>
                </div>
                <div className="flex space-x-1">
                  {SCENARIOS.map(s => (
                    <button key={s.key} onClick={() => setActiveScenario(s.key as ScenarioKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeScenario === s.key ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'
                      }`}
                      style={activeScenario === s.key ? { backgroundColor: s.color } : {}}
                    >{s.shortLabel}</button>
                  ))}
                </div>
              </div>

              {activeLog.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)] text-sm">
                  No trade data available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        {['Open Date', 'Expiry', 'Strike', 'Premium', 'Close Px', 'P&L', 'Days', 'Capped'].map(h => (
                          <th key={h} className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider pb-3 pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {activeLog.map((t: any, i: number) => (
                        <tr key={i} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                          <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{t.open_date}</td>
                          <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{t.expiry}</td>
                          <td className="py-2.5 pr-4 text-white">${Number(t.strike).toFixed(2)}</td>
                          <td className="py-2.5 pr-4 text-[var(--color-success)]">${Number(t.premium).toFixed(2)}</td>
                          <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">${Number(t.close_price).toFixed(2)}</td>
                          <td className={`py-2.5 pr-4 font-bold ${t.pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                            {t.pnl >= 0 ? '+' : ''}${Number(t.pnl).toFixed(2)}
                          </td>
                          <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{t.days_held}d</td>
                          <td className="py-2.5 pr-4">
                            {t.capped
                              ? <span className="text-amber-400 text-xs bg-amber-400/10 px-2 py-0.5 rounded-full">Capped</span>
                              : <span className="text-[var(--color-text-muted)] text-xs">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[var(--color-border)]">
                        <td colSpan={5} className="pt-3 text-xs text-[var(--color-text-muted)] font-sans">
                          {activeLog.length} trades · {activeLog.filter((t: any) => t.pnl >= 0).length} winners · {activeLog.filter((t: any) => t.pnl < 0).length} losers
                        </td>
                        <td className={`pt-3 font-bold ${activeLog.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          {activeLog.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) >= 0 ? '+' : ''}
                          ${activeLog.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0).toFixed(2)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
