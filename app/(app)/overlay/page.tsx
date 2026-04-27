'use client';

import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Play, Settings2, Activity, Eye, EyeOff, TrendingDown, DollarSign,
  Calendar, BarChart2, Clock, Trophy, AlertCircle, List, LayoutList, Grid3X3,
} from 'lucide-react';
import { usePortfolio, Position } from '@/context/PortfolioContext';
import { usePostHog } from 'posthog-js/react';

type ViewMode = 'pct' | 'dollar';
type ResultTab = 'summary' | 'details' | 'logs' | 'grid';
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

// Returns tick values spaced by ~every N months depending on range length
function getAxisTicks(data: { month: string }[]): string[] {
  if (!data.length) return [];
  const n = data.length;
  // step: show ~8 ticks max regardless of range
  const step = Math.max(1, Math.ceil(n / 8));
  return data.filter((_, i) => i % step === 0).map(d => d.month);
}

const SCENARIOS = [
  { key: 'exit25',  label: 'Close at 25%',   color: '#6366F1', shortLabel: '25%'    },
  { key: 'exit50',  label: 'Close at 50%',   color: '#F59E0B', shortLabel: '50%'    },
  { key: 'exitExp', label: 'Hold to Expiry', color: '#10B981', shortLabel: 'Expiry' },
  { key: 'roll15',  label: 'Roll at 15 DTE', color: '#EC4899', shortLabel: 'Roll15' },
] as const;

type ScenarioKey = 'exit25' | 'exit50' | 'exitExp' | 'roll15';
const TICKERS = ['SPY', 'QQQ', 'IWM'] as const;

// Mock trade log — deterministic (no Math.random) to avoid SSR hydration mismatch
function buildMockTrades(scenario: ScenarioKey) {
  const months   = ['2023-01','2023-02','2023-03','2023-04','2023-05','2023-06','2023-07','2023-08','2023-09','2023-10','2023-11','2023-12','2024-01','2024-02','2024-03','2024-04','2024-05','2024-06'];
  const strikes  = [405,408,411,415,418,421,424,427,430,433,437,440,445,449,453,458,462,466];
  const premiums = [1.85,1.92,2.10,2.34,1.76,2.55,2.20,1.98,2.40,1.65,2.80,2.15,2.50,2.30,2.70,2.10,2.45,2.60];
  const daysMap  = { exit25: [9,10,11,9,12,10,8,11,13,9,10,12,11,9,10,13,11,10], exit50: [18,20,22,19,24,21,17,22,25,18,21,24,22,18,20,26,22,20], exitExp: [30,35,30,35,30,35,30,35,30,35,30,35,30,35,30,35,30,35], roll15: [15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15] };
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
  roll15:  buildMockTrades('exitExp'),
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
  const hasShare = t.share_pnl != null;
  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-3 text-xs font-mono shadow-xl space-y-1">
      <p className="text-white font-bold">{t.open_date} → {t.close_date ?? t.expiry}</p>
      <p className="text-[var(--color-text-muted)]">Strike: <span className="text-white">${t.strike}</span></p>
      <p className="text-[var(--color-text-muted)]">Premium: <span className="text-white">${Number(t.premium_usd ?? (t.premium * 100)).toFixed(2)}</span></p>
      <p className="text-[var(--color-text-muted)]">Days held: <span className="text-white">{t.days_held}</span></p>
      <div className="border-t border-[#334155] my-1" />
      <p className="text-[var(--color-text-muted)]">Option P&amp;L: <span className={t.option_pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{t.option_pnl >= 0 ? '+' : ''}${Number(t.option_pnl).toFixed(2)}</span></p>
      {hasShare && <p className="text-[var(--color-text-muted)]">Equity P&amp;L: <span className={t.share_pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{t.share_pnl >= 0 ? '+' : ''}${Number(t.share_pnl).toFixed(2)} <span className="text-[var(--color-text-muted)]">(SPY {t.spy_entry?.toFixed(2)} → {t.spy_exit?.toFixed(2)})</span></span></p>}
      {hasShare && <p className="text-[var(--color-text-muted)] font-bold">Total P&amp;L: <span className={t.total_pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{t.total_pnl >= 0 ? '+' : ''}${Number(t.total_pnl).toFixed(2)}</span></p>}
    </div>
  );
}

export default function OverlayPage() {
  const { positions } = usePortfolio();
  const [ticker, setTicker]         = useState<Ticker>('SPY');
  const [delta, setDelta]           = useState(0.25);
  const [dte, setDte]               = useState<30 | 45 | 60>(45);
  const [startDate, setStartDate]   = useState('2023-01-01');
  const [endDate, setEndDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [showScenarios, setShowScenarios] = useState(true);
  const [viewMode, setViewMode]     = useState<ViewMode>('pct');
  const [datePreset, setDatePreset] = useState<Preset>('custom');
  const [isSimulating, setIsSimulating]   = useState(false);
  const posthog = usePostHog();
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
  const [tradeLog, setTradeLog]       = useState<Partial<Record<ScenarioKey, any[]>>>(MOCK_TRADE_LOG);

  // Grid compare state
  const [isRunningGrid, setIsRunningGrid] = useState(false);
  const [gridData, setGridData]           = useState<any[]>([]);
  const [gridError, setGridError]         = useState<string | null>(null);
  const [gridFilterScenario, setGridFilterScenario] = useState('all');
  const [gridFilterDelta, setGridFilterDelta]       = useState('all');
  const [gridFilterDte, setGridFilterDte]           = useState('all');
  const [gridSelectedRow, setGridSelectedRow]       = useState<any | null>(null);
  const [gridSortKey, setGridSortKey]               = useState<string>('totalPnl');
  const [gridSortDir, setGridSortDir]               = useState<'asc' | 'desc'>('desc');
  const [logSortKey, setLogSortKey]                 = useState<string>('open_date');
  const [logSortDir, setLogSortDir]                 = useState<'asc' | 'desc'>('asc');
  const [strategy, setStrategy]                     = useState<'cc' | 'csp'>('cc');

  // Combo drill-down: re-run simulation when grid row is clicked
  const [comboChartData, setComboChartData]   = useState<any[]>([]);
  const [comboStatsData, setComboStatsData]   = useState<Record<string, any>>({});
  const [comboTradeLog, setComboTradeLog]     = useState<Partial<Record<ScenarioKey, any[]>>>({});
  const [comboRiskTable, setComboRiskTable]   = useState<any[]>([]);
  const [isLoadingCombo, setIsLoadingCombo]   = useState(false);

  const handleGridSort = (key: string) => {
    if (gridSortKey === key) {
      setGridSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setGridSortKey(key);
      setGridSortDir('desc');
    }
  };

  const handleLogSort = (key: string) => {
    if (logSortKey === key) {
      setLogSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setLogSortKey(key);
      setLogSortDir('desc');
    }
  };

  const handleGridRowClick = async (row: any) => {
    // Deselect
    if (gridSelectedRow?.combo === row.combo && gridSelectedRow?.scenarioKey === row.scenarioKey) {
      setGridSelectedRow(null);
      setComboChartData([]);
      setComboStatsData({});
      setComboTradeLog({});
      setComboRiskTable([]);
      return;
    }
    setGridSelectedRow(row);
    setIsLoadingCombo(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker, delta: row.delta, dte: row.dte, start: startDate, end: endDate, strategy }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const { dates, exit25, exit50, exitExp, roll15 } = data.curves;
      setComboChartData(dates.map((d: string, i: number) => ({
        month: d.slice(0, 7), exit25: exit25[i], exit50: exit50[i], exitExp: exitExp[i], roll15: roll15?.[i] ?? null,
      })));
      setComboStatsData(data.stats ?? {});
      setComboTradeLog(data.trade_log ?? {});
      setComboRiskTable(data.risk_table ?? []);
    } catch (_) {} finally {
      setIsLoadingCombo(false);
    }
  };

  const downloadLogCSV = () => {
    const headers = strategy === 'csp'
      ? ['Open Date','Expiry','Strike','Premium ($)','Close Px ($)','Option P&L ($)','Option %','Days']
      : ['Open Date','Expiry','Strike','Premium ($)','Close Px ($)','Option P&L ($)','Option %','Equity P&L ($)','Equity %','Total P&L ($)','Total %','Days'];
    const rows = activeLog.map((t: any) => {
      const premUsd  = Number(t.premium_usd ?? t.premium * 100);
      const closePx  = Number(t.close_price) * 100;
      const spyBase  = t.spy_entry ? t.spy_entry * 100 : null;
      const optPct   = premUsd > 0 ? `${(Number(t.option_pnl) / premUsd * 100).toFixed(1)}%` : '';
      const sharePct = spyBase && t.share_pnl != null ? `${(Number(t.share_pnl) / spyBase * 100).toFixed(1)}%` : '';
      const totalPct = spyBase && t.total_pnl != null ? `${(Number(t.total_pnl) / spyBase * 100).toFixed(1)}%` : '';
      if (strategy === 'csp') {
        return [t.open_date, t.expiry, Number(t.strike).toFixed(2), premUsd.toFixed(2), closePx.toFixed(2), Number(t.option_pnl).toFixed(2), optPct, t.days_held];
      }
      return [
        t.open_date, t.expiry, Number(t.strike).toFixed(2), premUsd.toFixed(2),
        closePx.toFixed(2),
        Number(t.option_pnl).toFixed(2), optPct,
        t.share_pnl != null ? Number(t.share_pnl).toFixed(2) : '', sharePct,
        t.total_pnl != null ? Number(t.total_pnl).toFixed(2) : '', totalPct,
        t.days_held,
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade_log_${ticker}_${activeScenario}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    setError(null);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateRangeMonths = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));

    // First simulation milestone
    const simKey = 'sqilled_has_simulated';
    const isFirst = !localStorage.getItem(simKey);
    if (isFirst) {
      localStorage.setItem(simKey, '1');
      posthog?.capture('first_simulation', { symbol: ticker, delta, dte });
    }

    posthog?.capture('simulation_run', {
      symbol: ticker,
      delta,
      dte,
      start: startDate,
      end: endDate,
      date_range_months: dateRangeMonths,
      is_first: isFirst,
    });

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker, delta, dte, start: startDate, end: endDate, strategy }),
      });
      if (!res.ok) {
        posthog?.capture('api_error', { endpoint: '/api/simulate', status_code: res.status });
        const err = await res.json();
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();

      // Build chart data — zip dates + values
      const { dates, exit25, exit50, exitExp, roll15 } = data.curves;
      const chart = dates.map((d: string, i: number) => ({
        month: d.slice(0, 7),
        exit25:  exit25[i],
        exit50:  exit50[i],
        exitExp: exitExp[i],
        roll15:  roll15?.[i] ?? null,
      }));
      setChartData(chart);
      setRiskTable(data.risk_table);
      setStatsData(data.stats);
      setTradeLog(data.trade_log ?? {});

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

      // Auto-run grid after simulation
      handleRunGrid();
    } catch (e: any) {
      setError(e.message);
      posthog?.capture('simulation_failed', { symbol: ticker, delta, dte, error: e.message });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRunGrid = async () => {
    setIsRunningGrid(true);
    setGridError(null);
    setGridData([]);
    setGridSelectedRow(null);
    try {
      const res = await fetch('/api/grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker, start: startDate, end: endDate, strategy }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      // Flatten grid × scenarios into rows
      const SCENARIO_LABELS: Record<string, string> = {
        exit25: '25% Profit', exit50: '50% Profit', exitExp: 'Hold to Expiry', roll15: 'Roll at 15 DTE',
      };
      const rows: any[] = [];
      for (const cell of data.grid ?? []) {
        for (const [sKey, sLabel] of Object.entries(SCENARIO_LABELS)) {
          const s = cell[sKey];
          if (!s) continue;
          const dd = Math.abs(s.max_drawdown ?? 0);  // percentage
          const tr = s.total_return ?? 0;             // percentage
          rows.push({
            combo:        `${Math.round((cell.delta ?? 0) * 100)}d_${cell.dte}DTE`,
            delta:        cell.delta,
            dte:          cell.dte,
            scenarioKey:  sKey,
            scenario:     sLabel,
            trades:       s.num_trades ?? 0,
            winRate:      s.win_rate ?? 0,
            totalPnl:        s.total_pnl ?? 0,
            totalOptionPnl:  s.total_option_pnl ?? null,
            totalSharePnl:   s.total_share_pnl ?? null,
            totalCombinedPnl: s.total_combined_pnl ?? null,
            avgPerTrade:     s.avg_pnl ?? 0,
            avgCredit:       s.avg_premium ?? 0,
            maxDrawdown:     dd,
            efficiency:      dd > 0 ? parseFloat((tr / dd).toFixed(2)) : null,
            yearlyPnl:       s.yearly_pnl ?? {},
          });
        }
      }
      rows.sort((a, b) => b.totalPnl - a.totalPnl);
      setGridData(rows);
    } catch (e: any) {
      setGridError(e.message);
    } finally {
      setIsRunningGrid(false);
    }
  };

  // When a grid combo is selected, use its simulation results for chart/stats/tradelog
  const hasCombo      = comboChartData.length > 0;
  const displayChart  = hasCombo ? comboChartData  : chartData;
  const displayStats  = hasCombo ? comboStatsData  : statsData;
  const displayLog    = hasCombo ? comboTradeLog   : tradeLog;
  const displayRisk   = hasCombo ? comboRiskTable  : riskTable;

  const activeStats = displayStats[activeScenario] ?? {};
  const activeRisk  = displayRisk.find((r: any) => r.key === activeScenario) ?? {};
  const simLog    = displayLog[activeScenario];
  const activeLog = (Array.isArray(simLog) && simLog.length > 0)
    ? simLog
    : MOCK_TRADE_LOG[activeScenario];

  const RESULT_TABS: { key: ResultTab; label: string; icon: any }[] = [
    { key: 'summary', label: 'Summary',   icon: BarChart2  },
    { key: 'details', label: 'Details',   icon: LayoutList },
    { key: 'logs',    label: 'Trade Log', icon: List       },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Options Overlay</h1>
        <p className="text-[var(--color-text-muted)] mt-1">
          {strategy === 'cc' ? 'Simulate systematic covered call selling on your portfolio' : 'Simulate systematic cash-secured put selling'}
        </p>
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
            <input type="range" min="0.17" max="0.50" step="0.01" value={delta}
              onChange={e => setDelta(parseFloat(e.target.value))}
              className="w-full h-2 bg-[var(--color-surface-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]" />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1 font-mono">
              <span>17Δ</span><span>50Δ</span>
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

          {/* Strategy selector */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider block mb-2">Strategy</label>
            <div className="flex space-x-2">
              <button onClick={() => { setStrategy('cc'); setHasSimulated(false); setChartData([]); setGridData([]); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  strategy === 'cc'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                }`}
              >Covered Call</button>
              <button onClick={() => { setStrategy('csp'); setHasSimulated(false); setChartData([]); setGridData([]); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  strategy === 'csp'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                }`}
              >Cash-Secured Put</button>
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
                onClick={() => { setActiveResultTab(key); posthog?.capture('simulation_result_tab_viewed', { tab: key, has_simulated: hasSimulated, symbol: ticker }); }}
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
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-white">Performance Comparison</h2>
                    {hasCombo && (
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30">
                        {gridSelectedRow?.combo} · {gridSelectedRow?.scenario}
                      </span>
                    )}
                    {isLoadingCombo && <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />}
                  </div>
                  <div className="flex items-center gap-3">
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
                      data={(() => {
                        const portBase = displayChart.length > 0 ? portfolioLine[displayChart[0].month] : undefined;
                        return displayChart.map(d => {
                          const portRaw = portfolioLine[d.month];
                          const portNorm = portRaw !== undefined && portBase
                            ? parseFloat(((portRaw / portBase - 1) * 100).toFixed(2))
                            : undefined;
                          return {
                            ...d,
                            exit25:    parseFloat((d.exit25  - 100).toFixed(2)),
                            exit50:    parseFloat((d.exit50  - 100).toFixed(2)),
                            exitExp:   parseFloat((d.exitExp - 100).toFixed(2)),
                            portfolio: portNorm,
                          };
                        });
                      })()}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="month" ticks={getAxisTicks(displayChart)} stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={fmtAxisDate} />
                      <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false}
                        tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                        domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}
                        formatter={(value: any) => [`${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`, undefined]}
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

                {/* P&L breakdown bar */}
                {hasSimulated && activeStats.total_option_pnl != null && (() => {
                  const hasEquity = activeStats.total_share_pnl != null;
                  const totalVal  = activeStats.total_combined_pnl ?? activeStats.total_option_pnl;
                  return (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center gap-6 font-mono text-sm">
                      <span className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-semibold">P&L Breakdown</span>
                      <span className="text-[var(--color-text-muted)]">Option P&L: <span className={activeStats.total_option_pnl >= 0 ? 'text-[var(--color-success)] font-bold' : 'text-[var(--color-danger)] font-bold'}>{activeStats.total_option_pnl >= 0 ? '+' : ''}${Number(activeStats.total_option_pnl).toLocaleString()}</span></span>
                      {hasEquity && <span className="text-[var(--color-text-muted)]">Equity P&L: <span className={activeStats.total_share_pnl >= 0 ? 'text-[var(--color-success)] font-bold' : 'text-[var(--color-danger)] font-bold'}>{activeStats.total_share_pnl >= 0 ? '+' : ''}${Number(activeStats.total_share_pnl).toLocaleString()}</span></span>}
                      <span className="text-[var(--color-text-muted)]">Total: <span className={totalVal >= 0 ? 'text-[var(--color-success)] font-bold text-base' : 'text-[var(--color-danger)] font-bold text-base'}>{totalVal >= 0 ? '+' : ''}${Number(totalVal).toLocaleString()}</span></span>
                    </div>
                  );
                })()}
              </div>

              {/* Strategy Grid — inline in Summary */}
              {(() => {
                const GRID_SCENARIOS = [
                  { key: 'exit25',  label: 'S1 — 25% Profit',    shortLabel: '25% Profit'    },
                  { key: 'exit50',  label: 'S2 — 50% Profit',    shortLabel: '50% Profit'    },
                  { key: 'exitExp', label: 'S3 — Hold to Expiry', shortLabel: 'Hold to Expiry' },
                  { key: 'roll15',  label: 'S4 — Roll at 15 DTE', shortLabel: 'Roll 15 DTE'   },
                ];
                const activeGridScenario = gridFilterScenario === 'all' ? 'exit50' : gridFilterScenario;
                const visibleRows = [...gridData.filter(r => r.scenarioKey === activeGridScenario)].sort((a, b) => {
                  const av = a[gridSortKey] ?? 0;
                  const bv = b[gridSortKey] ?? 0;
                  return gridSortDir === 'asc' ? av - bv : bv - av;
                });
                const best = visibleRows.length ? visibleRows.reduce((a, b) => b.totalPnl > a.totalPnl ? b : a) : null;
                const GRID_COLS: { label: string; key: string }[] = [
                  { label: 'Combo',         key: 'combo' },
                  { label: 'Trades',        key: 'trades' },
                  { label: 'Win %',         key: 'winRate' },
                  { label: 'Total P&L',     key: 'totalPnl' },
                  { label: 'Avg/Trade',     key: 'avgPerTrade' },
                  { label: 'Avg Credit',    key: 'avgCredit' },
                  { label: 'Max Drawdown',  key: 'maxDrawdown' },
                  { label: 'Efficiency',    key: 'efficiency' },
                ];
                return (
                  <div className="space-y-5">

                    {/* Header */}
                    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h2 className="text-xl font-semibold text-white">Strategy Grid</h2>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            All delta × DTE combos for {ticker} · {startDate} → {endDate}
                          </p>
                        </div>
                        {isRunningGrid && (
                          <div className="flex items-center space-x-2 text-[var(--color-text-muted)] text-sm">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Running grid…</span>
                          </div>
                        )}
                      </div>
                      {gridError && (
                        <div className="mt-3 flex items-center space-x-2 text-[var(--color-danger)] text-sm bg-[var(--color-danger)]/10 rounded-lg px-3 py-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{gridError}</span>
                        </div>
                      )}
                    </div>

                    {/* Loading state */}
                    {!gridData.length && isRunningGrid && (
                      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] flex items-center justify-center h-48">
                        <div className="text-center">
                          <span className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mb-3" />
                          <p className="text-[var(--color-text-muted)] text-sm">Running all combinations…</p>
                        </div>
                      </div>
                    )}

                    {/* Pre-simulation empty state */}
                    {!gridData.length && !isRunningGrid && !gridError && (
                      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] flex items-center justify-center h-48">
                        <div className="text-center">
                          <Grid3X3 className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
                          <p className="text-[var(--color-text-muted)] text-sm">Run a simulation to see all combinations</p>
                        </div>
                      </div>
                    )}

                    {gridData.length > 0 && (
                      <>
                        {/* Scenario selector buttons */}
                        <div className="flex space-x-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-1 w-fit">
                          {GRID_SCENARIOS.map(s => (
                            <button
                              key={s.key}
                              onClick={() => { setGridFilterScenario(s.key); setGridSelectedRow(null); }}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeGridScenario === s.key
                                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                  : 'text-[var(--color-text-muted)] hover:text-white'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>

                        {/* Table */}
                        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[var(--color-border)] bg-[#1a2535]">
                                  {GRID_COLS.map(col => (
                                    <th key={col.key}
                                      onClick={() => handleGridSort(col.key)}
                                      className="text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3 cursor-pointer select-none hover:text-white transition-colors"
                                    >
                                      <span className="flex items-center gap-1">
                                        {col.label}
                                        {gridSortKey === col.key
                                          ? <span className="text-[var(--color-primary)]">{gridSortDir === 'desc' ? '↓' : '↑'}</span>
                                          : <span className="opacity-30">↕</span>
                                        }
                                      </span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--color-border)]">
                                {visibleRows.map((r, i) => {
                                  const isSelected = gridSelectedRow?.combo === r.combo && gridSelectedRow?.scenarioKey === r.scenarioKey;
                                  const isBest = best?.combo === r.combo;
                                  return (
                                    <tr
                                      key={i}
                                      onClick={() => handleGridRowClick(r)}
                                      className={`cursor-pointer transition-colors ${
                                        isSelected
                                          ? 'bg-[var(--color-primary)]/10'
                                          : isBest
                                          ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                          : 'hover:bg-[var(--color-surface-hover)]'
                                      }`}
                                    >
                                      <td className="px-4 py-3">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-mono font-bold text-white">{r.combo}</span>
                                          {isBest && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-white">{r.trades}</td>
                                      <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.winRate >= 90 ? 'bg-emerald-500/20 text-emerald-400' : r.winRate >= 70 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                          {r.winRate.toFixed(1)}%
                                        </span>
                                      </td>
                                      <td className={`px-4 py-3 font-mono font-bold ${r.totalPnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                                        {r.totalPnl >= 0 ? '+' : ''}${r.totalPnl.toFixed(0)}
                                      </td>
                                      <td className={`px-4 py-3 font-mono ${r.avgPerTrade >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                                        {r.avgPerTrade >= 0 ? '+' : ''}${r.avgPerTrade.toFixed(0)}
                                      </td>
                                      <td className="px-4 py-3 font-mono text-white">${r.avgCredit.toFixed(0)}</td>
                                      <td className={`px-4 py-3 font-mono ${r.maxDrawdown > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                                        {r.maxDrawdown > 0 ? `-${r.maxDrawdown.toFixed(1)}%` : 'none'}
                                      </td>
                                      <td className="px-4 py-3 font-mono">
                                        {r.efficiency === null
                                          ? <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">∞ no DD</span>
                                          : <span className={r.efficiency >= 1 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{r.efficiency.toFixed(2)}x</span>
                                        }
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] px-4 py-2 border-t border-[var(--color-border)]">
                            Click a row to see breakdown ↓
                          </p>
                        </div>

                        {/* Row detail panel */}
                        {gridSelectedRow && (() => {
                          const r = gridSelectedRow;
                          const yp: Record<string, number> = r.yearlyPnl ?? {};
                          const years = Object.keys(yp).sort();
                          const annualData = years.map(yr => ({ year: yr, pnl: yp[yr] }));
                          return (
                            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-primary)]/30 p-5 space-y-5">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-white">
                                  {r.combo} &nbsp;·&nbsp; {r.scenario}
                                </p>
                                <button onClick={() => setGridSelectedRow(null)} className="text-xs text-[var(--color-text-muted)] hover:text-white">✕ close</button>
                              </div>
                              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                {[
                                  { label: 'Win Rate',      value: `${r.winRate.toFixed(1)}%`,              color: r.winRate >= 80 ? 'text-[var(--color-success)]' : 'text-amber-400' },
                                  { label: 'Total P&L',     value: `${r.totalPnl >= 0 ? '+' : ''}$${r.totalPnl.toFixed(0)}`, color: r.totalPnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]' },
                                  { label: 'Avg P&L/Trade', value: `${r.avgPerTrade >= 0 ? '+' : ''}$${r.avgPerTrade.toFixed(0)}`, color: r.avgPerTrade >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]' },
                                  { label: 'Avg Credit',    value: `$${r.avgCredit.toFixed(0)}`,             color: 'text-white' },
                                  { label: 'Max Drawdown',  value: r.maxDrawdown > 0 ? `-${r.maxDrawdown.toFixed(1)}%` : 'None', color: r.maxDrawdown > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]' },
                                  { label: 'Efficiency',    value: r.efficiency === null ? '∞' : `${r.efficiency.toFixed(2)}x`, color: (r.efficiency === null || r.efficiency >= 1) ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]' },
                                ].map(m => (
                                  <div key={m.label} className="bg-[var(--color-background)] rounded-xl p-3 text-center">
                                    <p className="text-xs text-[var(--color-text-muted)] mb-1">{m.label}</p>
                                    <p className={`text-lg font-mono font-bold ${m.color}`}>{m.value}</p>
                                  </div>
                                ))}
                              </div>
                              {(r.totalOptionPnl != null || r.totalSharePnl != null) && (
                                <div className="flex flex-wrap items-center gap-6 font-mono text-sm pt-2 border-t border-[var(--color-border)]">
                                  <span className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-semibold">P&L Breakdown</span>
                                  <span className="text-[var(--color-text-muted)]">Option P&L: <span className={r.totalOptionPnl >= 0 ? 'text-[var(--color-success)] font-bold' : 'text-[var(--color-danger)] font-bold'}>{r.totalOptionPnl >= 0 ? '+' : ''}${Number(r.totalOptionPnl).toLocaleString()}</span></span>
                                  <span className="text-[var(--color-text-muted)]">Equity P&L: <span className={r.totalSharePnl >= 0 ? 'text-[var(--color-success)] font-bold' : 'text-[var(--color-danger)] font-bold'}>{r.totalSharePnl >= 0 ? '+' : ''}${Number(r.totalSharePnl).toLocaleString()}</span></span>
                                  <span className="text-[var(--color-text-muted)]">Total: <span className={r.totalCombinedPnl >= 0 ? 'text-[var(--color-success)] font-bold text-base' : 'text-[var(--color-danger)] font-bold text-base'}>{r.totalCombinedPnl >= 0 ? '+' : ''}${Number(r.totalCombinedPnl).toLocaleString()}</span></span>
                                </div>
                              )}
                              {annualData.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Annual P&amp;L</p>
                                  <div className="h-[180px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={annualData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="year" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false}
                                          tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}`} />
                                        <Tooltip
                                          contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px' }}
                                          formatter={(v: any) => [`${Number(v) >= 0 ? '+' : ''}$${Number(v).toFixed(2)}`, 'P&L']}
                                        />
                                        <ReferenceLine y={0} stroke="#475569" />
                                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                          {annualData.map((entry, i) => (
                                            <Cell key={i} fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'} />
                                          ))}
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Key takeaways */}
                        {best && (
                          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center space-x-2">
                              <Trophy className="w-4 h-4 text-amber-400" />
                              <p className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Key Takeaways</p>
                            </div>
                            <p className="text-white text-sm leading-relaxed">
                              <span className="font-bold text-amber-300">{best.combo}</span> is the best performing combination at{' '}
                              <span className="font-bold">{best.scenario.toLowerCase()}</span> — earning{' '}
                              <span className="font-bold text-[var(--color-success)]">${best.totalPnl.toFixed(0)} total</span> with a{' '}
                              <span className="font-bold">{best.winRate.toFixed(1)}% win rate</span> across {best.trades} trades.{' '}
                              {best.maxDrawdown === 0
                                ? 'Zero drawdown — every trade closed profitable.'
                                : `Max drawdown was ${best.maxDrawdown.toFixed(1)}%.`
                              }
                              {best.efficiency !== null && best.efficiency >= 2
                                ? ` Efficiency of ${best.efficiency.toFixed(1)}x means the strategy earned ${best.efficiency.toFixed(1)}× more than its worst loss.`
                                : ''
                              }
                            </p>
                            {(() => {
                              const highestWin = visibleRows.reduce((a, b) => b.winRate > a.winRate ? b : a);
                              const noDD = visibleRows.filter(r => r.maxDrawdown === 0);
                              return (
                                <ul className="space-y-1 text-xs text-[var(--color-text-muted)]">
                                  <li>• <span className="text-white font-medium">Highest win rate:</span> {highestWin.combo} at {highestWin.winRate.toFixed(1)}%</li>
                                  {noDD.length > 0 && (
                                    <li>• <span className="text-white font-medium">Zero drawdown:</span> {noDD.map(r => r.combo).join(', ')}</li>
                                  )}
                                  <li>• <span className="text-white font-medium">Scenario:</span> {GRID_SCENARIOS.find(s => s.key === activeGridScenario)?.label}</li>
                                </ul>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
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
                  {(() => {
                    const totalOpt   = activeLog.reduce((s: number, t: any) => s + (t.option_pnl ?? t.pnl ?? 0), 0);
                    const totalShare = activeLog.reduce((s: number, t: any) => s + (t.share_pnl ?? 0), 0);
                    const totalComb  = activeLog.reduce((s: number, t: any) => s + (t.total_pnl ?? t.pnl ?? 0), 0);
                    const hasShare   = activeLog.some((t: any) => t.share_pnl != null);
                    return (
                      <div className="flex flex-wrap gap-4 mb-4 text-sm font-mono">
                        <span className="text-[var(--color-text-muted)]">Trades: <span className="text-white font-bold">{activeLog.length}</span></span>
                        <span className="text-[var(--color-text-muted)]">Winners: <span className="text-[var(--color-success)] font-bold">{activeLog.filter((t: any) => t.pnl >= 0).length}</span></span>
                        <span className="text-[var(--color-text-muted)]">Losers: <span className="text-[var(--color-danger)] font-bold">{activeLog.filter((t: any) => t.pnl < 0).length}</span></span>
                        <span className="text-[var(--color-text-muted)]">Option P&amp;L: <span className={`font-bold ${totalOpt >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{totalOpt >= 0 ? '+' : ''}${totalOpt.toFixed(0)}</span></span>
                        {hasShare && <span className="text-[var(--color-text-muted)]">Equity P&amp;L: <span className={`font-bold ${totalShare >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{totalShare >= 0 ? '+' : ''}${totalShare.toFixed(0)}</span></span>}
                        {hasShare && <span className="text-[var(--color-text-muted)]">Total: <span className={`font-bold ${totalComb >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{totalComb >= 0 ? '+' : ''}${totalComb.toFixed(0)}</span></span>}
                      </div>
                    );
                  })()}

                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#10B981',opacity:0.9}} /> Option P&L (solid)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#10B981',opacity:0.45}} /> Equity P&L (faded)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#EF4444',opacity:0.9}} /> Loss</span>
                  </div>

                  <div style={{ height: Math.max(300, activeLog.length * 36) }} className="w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={activeLog}
                        margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
                        barSize={10}
                        barGap={2}
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
                        {/* Option P&L bar */}
                        <Bar dataKey="option_pnl" name="Option P&L" radius={[0, 3, 3, 0]}>
                          {activeLog.map((entry: any, i: number) => (
                            <Cell key={i} fill={entry.option_pnl >= 0 ? '#10B981' : '#EF4444'} fillOpacity={0.9} />
                          ))}
                        </Bar>
                        {/* Equity P&L bar */}
                        <Bar dataKey="share_pnl" name="Equity P&L" radius={[0, 3, 3, 0]}>
                          {activeLog.map((entry: any, i: number) => (
                            <Cell key={i} fill={entry.share_pnl >= 0 ? '#10B981' : '#EF4444'} fillOpacity={0.45} />
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
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Trade Log</h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">All trades for selected scenario</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
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
                  <button onClick={downloadLogCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-white transition-colors"
                  >
                    ↓ CSV
                  </button>
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
                        {([
                          { label: 'Open Date',  key: 'open_date'   },
                          { label: 'Expiry',     key: 'expiry'      },
                          { label: 'Strike',     key: 'strike'      },
                          { label: 'Premium',    key: 'premium_usd' },
                          { label: 'Close Px',   key: 'close_price' },
                          { label: 'Option P&L', key: 'option_pnl'  },
                          { label: 'Option %',   key: '_optPct'     },
                          { label: 'Equity P&L', key: 'share_pnl'   },
                          { label: 'Equity %',   key: '_sharePct'   },
                          { label: 'Total P&L',  key: 'total_pnl'   },
                          { label: 'Total %',    key: '_totalPct'   },
                          { label: 'Days',       key: 'days_held'   },
                        ] as {label:string;key:string}[]).map(col => (
                          <th key={col.key} onClick={() => handleLogSort(col.key)}
                            className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider pb-3 pr-4 cursor-pointer select-none hover:text-white transition-colors">
                            <span className="flex items-center gap-1">
                              {col.label}
                              {logSortKey === col.key
                                ? <span className="text-[var(--color-primary)]">{logSortDir === 'desc' ? '↓' : '↑'}</span>
                                : <span className="opacity-20">↕</span>}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {[...activeLog].sort((a: any, b: any) => {
                        const premA = Number(a.premium_usd ?? a.premium * 100);
                        const premB = Number(b.premium_usd ?? b.premium * 100);
                        const spyA  = a.spy_entry ? a.spy_entry * 100 : null;
                        const spyB  = b.spy_entry ? b.spy_entry * 100 : null;
                        const getVal = (t: any, prem: number, spyBase: number | null, key: string): any => {
                          if (key === '_optPct')   return prem > 0 ? Number(t.option_pnl) / prem : 0;
                          if (key === '_sharePct')  return spyBase && t.share_pnl != null ? Number(t.share_pnl) / spyBase : 0;
                          if (key === '_totalPct')  return spyBase && t.total_pnl != null ? Number(t.total_pnl) / spyBase : 0;
                          const v = t[key];
                          return typeof v === 'string' ? v : Number(v ?? 0);
                        };
                        const av = getVal(a, premA, spyA, logSortKey);
                        const bv = getVal(b, premB, spyB, logSortKey);
                        if (typeof av === 'string') return logSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                        return logSortDir === 'asc' ? av - bv : bv - av;
                      }).map((t: any, i: number) => {
                        const premUsd   = Number(t.premium_usd ?? t.premium * 100);
                        const spyBase   = t.spy_entry ? t.spy_entry * 100 : null;
                        const optPct    = premUsd > 0 ? (Number(t.option_pnl) / premUsd * 100) : null;
                        const sharePct  = spyBase && t.share_pnl != null ? (Number(t.share_pnl) / spyBase * 100) : null;
                        const totalPct  = spyBase && t.total_pnl != null ? (Number(t.total_pnl) / spyBase * 100) : null;
                        const pctFmt    = (v: number | null) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
                        const pctColor  = (v: number | null) => v == null ? 'text-[var(--color-text-muted)]' : v >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]';
                        return (
                        <tr key={i} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                          <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{t.open_date}</td>
                          <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{t.expiry}</td>
                          <td className="py-2.5 pr-4 text-white">${Number(t.strike).toFixed(2)}</td>
                          <td className="py-2.5 pr-4 text-[var(--color-success)]">${premUsd.toFixed(2)}</td>
                          <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">${Number(t.close_price).toFixed(2)}</td>
                          <td className={`py-2.5 pr-4 font-bold ${t.option_pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                            {t.option_pnl >= 0 ? '+' : ''}${Number(t.option_pnl).toFixed(2)}
                          </td>
                          <td className={`py-2.5 pr-4 font-bold ${pctColor(optPct)}`}>{pctFmt(optPct)}</td>
                          <td className={`py-2.5 pr-4 font-bold ${t.share_pnl == null ? 'text-[var(--color-text-muted)]' : t.share_pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                            {t.share_pnl == null ? '—' : `${t.share_pnl >= 0 ? '+' : ''}$${Number(t.share_pnl).toFixed(2)}`}
                          </td>
                          <td className={`py-2.5 pr-4 font-bold ${pctColor(sharePct)}`}>{pctFmt(sharePct)}</td>
                          <td className={`py-2.5 pr-4 font-bold ${t.total_pnl == null ? 'text-[var(--color-text-muted)]' : t.total_pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                            {t.total_pnl == null ? '—' : `${t.total_pnl >= 0 ? '+' : ''}$${Number(t.total_pnl).toFixed(2)}`}
                          </td>
                          <td className={`py-2.5 pr-4 font-bold ${pctColor(totalPct)}`}>{pctFmt(totalPct)}</td>
                          <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{t.days_held}d</td>
                        </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[var(--color-border)]">
                        <td colSpan={5} className="pt-3 text-xs text-[var(--color-text-muted)] font-sans">
                          {activeLog.length} trades · {activeLog.filter((t: any) => t.pnl >= 0).length} winners · {activeLog.filter((t: any) => t.pnl < 0).length} losers
                        </td>
                        {(() => {
                          const totalOpt   = activeLog.reduce((s: number, t: any) => s + (t.option_pnl ?? t.pnl ?? 0), 0);
                          const totalShare = activeLog.reduce((s: number, t: any) => s + (t.share_pnl ?? 0), 0);
                          const totalComb  = activeLog.reduce((s: number, t: any) => s + (t.total_pnl ?? t.pnl ?? 0), 0);
                          const hasShare   = activeLog.some((t: any) => t.share_pnl != null);
                          return (<>
                            <td className={`pt-3 font-bold ${totalOpt >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                              {totalOpt >= 0 ? '+' : ''}${totalOpt.toFixed(2)}
                            </td>
                            <td className={`pt-3 font-bold ${!hasShare ? 'text-[var(--color-text-muted)]' : totalShare >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                              {hasShare ? `${totalShare >= 0 ? '+' : ''}$${totalShare.toFixed(2)}` : '—'}
                            </td>
                            <td className={`pt-3 font-bold ${!hasShare ? 'text-[var(--color-text-muted)]' : totalComb >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                              {hasShare ? `${totalComb >= 0 ? '+' : ''}$${totalComb.toFixed(2)}` : '—'}
                            </td>
                            <td />
                          </>);
                        })()}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Grid tab ── */}
        </div>
      </div>
    </div>
  );
}
