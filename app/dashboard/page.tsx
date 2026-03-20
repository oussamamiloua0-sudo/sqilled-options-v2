'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase, Layers, Activity, TrendingUp, TrendingDown,
  AlertTriangle, Info, ArrowRight, DollarSign, BarChart2, Shield,
} from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

/* ── IV Regime fetch ─────────────────────────────────── */
type IvData = {
  current_iv: number;
  percentile: number;
  regime: string;
  history: { date: string; iv: number }[];
};

function useIvRegime(symbol: string) {
  const [data, setData] = useState<IvData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/iv-regime?symbol=${symbol}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol]);
  return { data, loading };
}

/* ── Helpers ─────────────────────────────────────────── */
function regimeMeta(percentile: number) {
  if (percentile < 25) return { color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-text-muted)]/10', border: 'border-[var(--color-text-muted)]/30', Icon: TrendingDown,  label: 'Low' };
  if (percentile > 80) return { color: 'text-[var(--color-danger)]',     bg: 'bg-[var(--color-danger)]/10',     border: 'border-[var(--color-danger)]/30',     Icon: AlertTriangle, label: 'High' };
  if (percentile > 60) return { color: 'text-[var(--color-accent)]',     bg: 'bg-[var(--color-accent)]/10',     border: 'border-[var(--color-accent)]/30',     Icon: TrendingUp,    label: 'Elevated' };
  return                      { color: 'text-[var(--color-success)]',    bg: 'bg-[var(--color-success)]/10',    border: 'border-[var(--color-success)]/30',    Icon: Info,          label: 'Normal' };
}

function fmt$(n: number) {
  return n >= 0
    ? `+$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `-$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── Dashboard ───────────────────────────────────────── */
export default function DashboardPage() {
  const { positions } = usePortfolio();
  const { data: ivSpy, loading: ivLoading } = useIvRegime('SPY');

  /* Portfolio summary */
  const totalValue  = positions.reduce((s, p) => s + (p.currentPrice ?? p.entryPrice) * p.shares, 0);
  const totalCost   = positions.reduce((s, p) => s + p.entryPrice * p.shares, 0);
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const winners     = positions.filter(p => (p.currentPrice ?? p.entryPrice) > p.entryPrice).length;

  /* Regime */
  const iv      = ivSpy;
  const meta    = iv ? regimeMeta(iv.percentile) : null;
  const RegIcon = meta?.Icon ?? Info;

  const quickLinks = [
    { label: 'Portfolio',            sub: 'Manage positions',        href: '/portfolio',  Icon: Briefcase,  color: 'text-[var(--color-primary)]',  bg: 'bg-[var(--color-primary)]/10'  },
    { label: 'Covered Call Overlay', sub: 'Run simulation',          href: '/overlay',    Icon: Layers,     color: 'text-[var(--color-accent)]',   bg: 'bg-[var(--color-accent)]/10'   },
    { label: 'Analytics',            sub: 'Portfolio vs benchmark',  href: '/analytics',  Icon: BarChart2,  color: 'text-[var(--color-success)]',  bg: 'bg-[var(--color-success)]/10'  },
    { label: 'IV Regime',            sub: 'Options market context',  href: '/iv-regime',  Icon: Activity,   color: 'text-[var(--color-danger)]',   bg: 'bg-[var(--color-danger)]/10'   },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-[var(--color-text-muted)] mt-1">Your options strategy command center</p>
      </header>

      {/* Top row: portfolio stats + IV card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Portfolio value */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 space-y-1">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm font-medium uppercase tracking-wider">
            <DollarSign className="w-4 h-4" /> Portfolio Value
          </div>
          <div className="text-3xl font-bold text-white">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-sm font-semibold ${totalPnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {fmt$(totalPnl)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
          </div>
        </div>

        {/* Positions summary */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 space-y-1">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm font-medium uppercase tracking-wider">
            <Briefcase className="w-4 h-4" /> Positions
          </div>
          <div className="text-3xl font-bold text-white">{positions.length}</div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {positions.length > 0
              ? <><span className="text-[var(--color-success)]">{winners} winning</span> · {positions.length - winners} losing</>
              : 'No positions yet'}
          </div>
        </div>

        {/* IV Regime */}
        <div className={`bg-[var(--color-surface)] rounded-2xl border p-6 space-y-1 ${meta?.border ?? 'border-[var(--color-border)]'}`}>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm font-medium uppercase tracking-wider">
            <Shield className="w-4 h-4" /> SPY IV Regime
          </div>
          {ivLoading ? (
            <div className="text-[var(--color-text-muted)] text-sm pt-2">Loading…</div>
          ) : iv ? (
            <>
              <div className={`text-3xl font-bold ${meta?.color}`}>{iv.current_iv.toFixed(1)}%</div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta?.bg} ${meta?.color}`}>
                  <RegIcon className="w-3 h-3" /> {meta?.label}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{iv.percentile.toFixed(0)}th percentile</span>
              </div>
            </>
          ) : (
            <div className="text-[var(--color-text-muted)] text-sm pt-2">Unavailable</div>
          )}
        </div>
      </div>

      {/* IV history mini chart */}
      {iv && iv.history.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold">SPY Implied Volatility — 12 months</h2>
              <p className="text-[var(--color-text-muted)] text-sm">Monthly ATM IV</p>
            </div>
            <Link href="/iv-regime" className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline">
              Full view <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={iv.history} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [`${(v as number).toFixed(1)}%`, 'IV']}
              />
              <Line type="monotone" dataKey="iv" stroke="#F56C49" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-white font-semibold mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map(({ label, sub, href, Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5
                hover:border-[var(--color-primary)]/50 transition-colors group flex flex-col gap-3"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <div className="text-white font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">{label}</div>
                <div className="text-[var(--color-text-muted)] text-xs mt-0.5">{sub}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors mt-auto" />
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
