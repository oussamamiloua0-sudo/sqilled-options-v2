'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react';

const TICKERS = ['SPY', 'QQQ', 'IWM'] as const;
type Ticker = typeof TICKERS[number];

export default function IvRegimePage() {
  const [ticker, setTicker]       = useState<Ticker>('SPY');
  const [loading, setLoading]     = useState(true);
  const [currentIv, setCurrentIv] = useState(0);
  const [percentile, setPercentile] = useState(0);
  const [regime, setRegime]       = useState('Normal');
  const [history, setHistory]     = useState<{ date: string; iv: number }[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/iv-regime?symbol=${ticker}`)
      .then(r => r.json())
      .then(data => {
        setCurrentIv(data.current_iv ?? 0);
        setPercentile(data.percentile ?? 0);
        setRegime(data.regime ?? 'Normal');
        setHistory(data.history ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  let regimeColor = 'text-[var(--color-primary)]';
  let regimeBg    = 'bg-[var(--color-primary)]/10';
  let RegimeIcon  = Info;

  if (percentile < 25) {
    regimeColor = 'text-[var(--color-text-muted)]'; regimeBg = 'bg-[var(--color-text-muted)]/10'; RegimeIcon = TrendingDown;
  } else if (percentile > 80) {
    regimeColor = 'text-[var(--color-danger)]';     regimeBg = 'bg-[var(--color-danger)]/10';     RegimeIcon = AlertTriangle;
  } else if (percentile > 60) {
    regimeColor = 'text-[var(--color-accent)]';     regimeBg = 'bg-[var(--color-accent)]/10';     RegimeIcon = TrendingUp;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">IV Regime</h1>
          <p className="text-[var(--color-text-muted)] mt-1">Implied Volatility Context</p>
        </div>
        <div className="flex space-x-2">
          {TICKERS.map(t => (
            <button key={t} onClick={() => setTicker(t)}
              className={`px-4 py-2 rounded-lg text-sm font-mono font-bold transition-colors ${
                ticker === t
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
              }`}
            >{t}</button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Regime Card */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 shadow-sm flex flex-col items-center justify-center text-center">
            <div className={`p-4 rounded-full ${regimeBg} ${regimeColor} mb-6`}>
              <RegimeIcon className="w-12 h-12" />
            </div>
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Current Signal</h2>
            <p className={`text-4xl font-bold tracking-tight ${regimeColor}`}>{regime}</p>
            <div className="w-full mt-10 space-y-6">
              <div className="flex justify-between items-end border-b border-[var(--color-border)] pb-4">
                <span className="text-[var(--color-text-muted)] font-medium">{ticker} IV30</span>
                <span className="text-2xl font-mono text-white">{currentIv.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-end border-b border-[var(--color-border)] pb-4">
                <span className="text-[var(--color-text-muted)] font-medium">IV Rank (1Y)</span>
                <span className="text-2xl font-mono text-white">{percentile}%</span>
              </div>
            </div>
          </div>

          {/* Gauge */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 shadow-sm flex flex-col">
            <h2 className="text-xl font-semibold text-white mb-8">IV Percentile Gauge</h2>
            <div className="flex-1 flex flex-col justify-center relative">
              <div className="relative h-4 bg-[var(--color-surface-hover)] rounded-full overflow-hidden mb-6">
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--color-text-muted)] via-[var(--color-primary)] to-[var(--color-danger)]" style={{ width: '100%' }} />
                <div className="absolute top-0 h-full bg-[var(--color-surface)] border-l-2 border-white transition-all duration-1000 ease-out"
                  style={{ left: `${percentile}%`, width: `${100 - percentile}%` }} />
              </div>
              <div className="flex justify-between text-xs font-mono text-[var(--color-text-muted)] mb-8">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
              <div className="text-center mt-auto">
                <p className="text-sm text-[var(--color-text-muted)] mb-2">
                  IV is higher than <strong className="text-white font-mono">{percentile}%</strong> of the past year.
                </p>
                <p className="text-xs text-[var(--color-text-muted)]/70">
                  {regime === 'Low'      && 'Consider buying premium (long options).'}
                  {regime === 'Normal'   && 'Standard systematic strategies apply.'}
                  {regime === 'High'     && 'Favorable environment for selling premium.'}
                  {regime === 'Elevated' && 'Favorable environment for selling premium.'}
                  {regime === 'Spike'    && 'High risk/reward. Proceed with caution.'}
                </p>
              </div>
            </div>
          </div>

          {/* Historical Chart */}
          <div className="lg:col-span-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Historical IV — Last 12 Months</h2>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-[var(--color-primary)]" />
                <span className="text-[var(--color-text-muted)]">IV %</span>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12, fontFamily: 'var(--font-mono)' }} tickMargin={10} axisLine={false} />
                  <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12, fontFamily: 'var(--font-mono)' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}
                    formatter={(value: any) => [`${value}%`, 'IV']} />
                  <ReferenceLine y={20} stroke="#94A3B8" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={30} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="iv" name="IV" stroke="var(--color-primary)" strokeWidth={3}
                    dot={{ r: 4, fill: 'var(--color-surface)', stroke: 'var(--color-primary)', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: 'var(--color-primary)', stroke: '#0B1120', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
