'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, X, Loader2, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { usePostHog } from 'posthog-js/react';

const emptyForm = { symbol: '', shares: '', entryPrice: '', entryDate: '', currentPrice: '' };

// Map return % to a red→amber→green color
function returnColor(pct: number): string {
  const clamped = Math.max(-15, Math.min(15, pct));
  const hue = clamped < 0
    ? 0 + (clamped / -15) * 0   // stays red when negative
    : (clamped / 15) * 120;     // 0° red → 120° green
  const sat = 70;
  const lit = clamped < 0 ? 45 : 38;
  if (clamped < -5)  return '#991B1B';
  if (clamped < 0)   return '#EF4444';
  if (clamped === 0) return '#F59E0B';
  if (clamped < 5)   return '#10B981';
  return '#059669';
}

type SortKey = 'symbol' | 'shares' | 'entryPrice' | 'currentPrice' | 'value' | 'returnPct';
type SortDir = 'asc' | 'desc';

async function fetchClose(symbol: string, date: string): Promise<number | null> {
  try {
    const dayAfter = new Date(new Date(date).getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const res = await fetch(`/api/prices?symbol=${symbol}&start=${date}&end=${dayAfter}`);
    const data = await res.json();
    if (data.close?.length) return data.close[0];
  } catch {}
  return null;
}

async function fetchLatestClose(symbol: string): Promise<number | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const res = await fetch(`/api/prices?symbol=${symbol}&start=${weekAgo}&end=${today}`);
    const data = await res.json();
    if (data.close?.length) return data.close[data.close.length - 1];
  } catch {}
  return null;
}

export default function PortfolioPage() {
  const { positions, setPositions } = usePortfolio();
  const posthog = usePostHog();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Refresh current prices on mount so Portfolio returns stay live
  useEffect(() => {
    if (!positions.length) return;
    Promise.all(positions.map(async p => {
      const latest = await fetchLatestClose(p.symbol);
      return latest !== null ? { ...p, currentPrice: latest } : p;
    })).then(updated => setPositions(updated));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTickerInput = (value: string) => {
    setForm(f => ({ ...f, symbol: value }));
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {}
      setSearchLoading(false);
    }, 250);
  };

  const selectTicker = async (symbol: string) => {
    setShowSuggestions(false);
    setForm(f => ({ ...f, symbol }));
    posthog?.capture('ticker_searched', { symbol });
    setFetchingPrice(true);
    const entryDate = form.entryDate;
    const [latest, entry] = await Promise.all([
      fetchLatestClose(symbol),
      entryDate ? fetchClose(symbol, entryDate) : Promise.resolve(null),
    ]);
    setForm(f => ({
      ...f,
      symbol,
      currentPrice: latest !== null ? String(latest) : f.currentPrice,
      entryPrice:   entry  !== null ? String(entry)  : f.entryPrice,
    }));
    setFetchingPrice(false);
  };

  const handleEntryDateChange = async (date: string) => {
    setForm(f => ({ ...f, entryDate: date }));
    if (!form.symbol || !date) return;
    setFetchingPrice(true);
    const price = await fetchClose(form.symbol, date);
    if (price !== null) setForm(f => ({ ...f, entryDate: date, entryPrice: String(price) }));
    setFetchingPrice(false);
  };

  // Sort logic
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedPositions = [...positions].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;
    if (sortKey === 'symbol') { aVal = a.symbol; bVal = b.symbol; }
    else if (sortKey === 'shares') { aVal = a.shares; bVal = b.shares; }
    else if (sortKey === 'entryPrice') { aVal = a.entryPrice; bVal = b.entryPrice; }
    else if (sortKey === 'currentPrice') { aVal = a.currentPrice; bVal = b.currentPrice; }
    else if (sortKey === 'value') { aVal = a.shares * a.currentPrice; bVal = b.shares * b.currentPrice; }
    else { aVal = (a.currentPrice - a.entryPrice) / a.entryPrice; bVal = (b.currentPrice - b.entryPrice) / b.entryPrice; }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalValue = positions.reduce((sum, pos) => sum + pos.shares * pos.currentPrice, 0);
  const totalCost  = positions.reduce((sum, pos) => sum + pos.shares * pos.entryPrice, 0);
  const totalPnL   = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Derived data for Option D visuals
  const positionsWithCalc = positions.map(pos => ({
    ...pos,
    value: pos.shares * pos.currentPrice,
    returnPct: ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100,
    allocPct: totalValue > 0 ? (pos.shares * pos.currentPrice / totalValue) * 100 : 0,
  }));
  const perfData = [...positionsWithCalc].sort((a, b) => b.returnPct - a.returnPct);

  const removePosition = (id: number) => {
    const pos = positions.find(p => p.id === id);
    posthog?.capture('position_deleted', { symbol: pos?.symbol });
    setPositions(positions.filter(p => p.id !== id));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (id: number) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    setEditingId(id);
    setForm({
      symbol: pos.symbol,
      shares: String(pos.shares),
      entryPrice: String(pos.entryPrice),
      entryDate: pos.entryDate,
      currentPrice: String(pos.currentPrice),
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.symbol || !form.shares || !form.entryPrice || !form.currentPrice) {
      setError('Please fill in all required fields.');
      return;
    }
    if (editingId !== null) {
      posthog?.capture('position_edited', { symbol: form.symbol.toUpperCase().trim(), shares: parseFloat(form.shares) });
      setPositions(positions.map(p => p.id === editingId ? {
        ...p,
        symbol: form.symbol.toUpperCase().trim(),
        shares: parseFloat(form.shares),
        entryPrice: parseFloat(form.entryPrice),
        entryDate: form.entryDate || p.entryDate,
        currentPrice: parseFloat(form.currentPrice),
      } : p));
    } else {
      posthog?.capture('position_added', {
        symbol: form.symbol.toUpperCase().trim(),
        shares: parseFloat(form.shares),
        entry_price: parseFloat(form.entryPrice),
      });
      setPositions([...positions, {
        id: Date.now(),
        symbol: form.symbol.toUpperCase().trim(),
        shares: parseFloat(form.shares),
        entryPrice: parseFloat(form.entryPrice),
        entryDate: form.entryDate || new Date().toISOString().split('T')[0],
        currentPrice: parseFloat(form.currentPrice),
      }]);
    }
    setForm(emptyForm);
    setError('');
    setShowModal(false);
    setEditingId(null);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 text-[var(--color-primary)] inline" />
      : <ChevronDown className="w-3 h-3 ml-1 text-[var(--color-primary)] inline" />;
  };

  const thClass = "p-4 font-semibold cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap";

  const numField = (label: string, key: 'shares' | 'entryPrice' | 'currentPrice', placeholder: string) => (
    <div>
      <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          placeholder={placeholder}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
        />
        {(key === 'currentPrice' || key === 'entryPrice') && fetchingPrice && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-primary)] animate-spin" />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Portfolio</h1>
          <p className="text-[var(--color-text-muted)] mt-1">Manage your current holdings</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Total Value</p>
          <p className="text-4xl font-mono text-white mt-1">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
          <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Positions</h2>
            <button
              onClick={openAdd}
              className="flex items-center space-x-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Position</span>
            </button>
          </div>

          {/* Heatmap strip */}
          {positionsWithCalc.length > 0 && (
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Allocation · colored by return
              </p>
              <div className="flex w-full h-10 rounded-lg overflow-hidden gap-0.5">
                {positionsWithCalc.map(pos => (
                  <button
                    key={pos.id}
                    onClick={() => setHighlightId(id => id === pos.id ? null : pos.id)}
                    title={`${pos.symbol}: ${pos.returnPct >= 0 ? '+' : ''}${pos.returnPct.toFixed(2)}% · ${pos.allocPct.toFixed(1)}%`}
                    style={{ width: `${pos.allocPct}%`, backgroundColor: returnColor(pos.returnPct) }}
                    className={`flex flex-col items-center justify-center transition-opacity hover:opacity-90 min-w-[32px]
                      ${highlightId === pos.id ? 'ring-2 ring-white/50' : ''}`}
                  >
                    <span className="text-white text-[10px] font-bold leading-none">{pos.symbol}</span>
                    <span className="text-white/80 text-[9px] leading-none mt-0.5">
                      {pos.returnPct >= 0 ? '+' : ''}{pos.returnPct.toFixed(1)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-hover)]/50 text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <th className={`${thClass} text-left`} onClick={() => handleSort('symbol')}>
                    Symbol<SortIcon col="symbol" />
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('shares')}>
                    Shares<SortIcon col="shares" />
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('entryPrice')}>
                    Entry Price<SortIcon col="entryPrice" />
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('currentPrice')}>
                    Current Price<SortIcon col="currentPrice" />
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('value')}>
                    Total Value<SortIcon col="value" />
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('returnPct')}>
                    Return<SortIcon col="returnPct" />
                  </th>
                  <th className="p-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {sortedPositions.map((pos) => {
                  const value = pos.shares * pos.currentPrice;
                  const returnPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                  const isPositive = returnPct >= 0;
                  return (
                    <tr key={pos.id} className={`transition-colors ${highlightId === pos.id ? 'bg-white/5' : 'hover:bg-[var(--color-surface-hover)]/30'}`}>
                      <td className="p-4 font-bold text-white">{pos.symbol}</td>
                      <td className="p-4 text-right font-mono">{pos.shares}</td>
                      <td className="p-4 text-right font-mono">${pos.entryPrice.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono">${pos.currentPrice.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={`p-4 text-right font-mono font-medium ${isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                        {isPositive ? '+' : ''}{returnPct.toFixed(2)}%
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => openEdit(pos.id)}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors p-2 rounded-md hover:bg-[var(--color-primary)]/10"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removePosition(pos.id)}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-2 rounded-md hover:bg-[var(--color-danger)]/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 text-sm font-semibold">
                  <td className="p-4 text-[var(--color-text-muted)] uppercase tracking-wider text-xs" colSpan={4}>
                    Total P&amp;L
                  </td>
                  <td className="p-4 text-right font-mono text-white">
                    ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`p-4 text-right font-mono ${totalPnL >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    <span className="block">{totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-xs opacity-75">{totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm flex flex-col">
          <h2 className="text-xl font-semibold text-white mb-1">Performance</h2>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-6">Return by position</p>

          {/* Horizontal bar chart sorted by return */}
          <div className="flex-1 space-y-3">
            {perfData.map(pos => (
              <div key={pos.id} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">{pos.symbol}</span>
                  <span className={`text-sm font-mono font-semibold ${pos.returnPct >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {pos.returnPct >= 0 ? '+' : ''}{pos.returnPct.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.abs(pos.returnPct) / Math.max(...perfData.map(p => Math.abs(p.returnPct)), 1) * 100)}%`,
                      backgroundColor: returnColor(pos.returnPct),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Allocation legend */}
          <div className="mt-6 pt-5 border-t border-[var(--color-border)] space-y-2">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">Allocation</p>
            {positionsWithCalc.map(pos => (
              <div key={pos.id} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: returnColor(pos.returnPct) }} />
                <span className="text-sm font-medium text-white">{pos.symbol}</span>
                <div className="flex-1 mx-2 h-1 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pos.allocPct}%`, backgroundColor: returnColor(pos.returnPct) }} />
                </div>
                <span className="text-xs font-mono text-[var(--color-text-muted)]">{pos.allocPct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{editingId !== null ? 'Edit Position' : 'Add Position'}</h3>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-[var(--color-text-muted)] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Ticker with autocomplete — disabled when editing */}
              <div ref={suggestionsRef} className="relative">
                <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Ticker Symbol *</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. AAPL"
                    value={form.symbol}
                    onChange={e => editingId === null ? handleTickerInput(e.target.value) : undefined}
                    readOnly={editingId !== null}
                    autoComplete="off"
                    className={`w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[var(--color-primary)] ${editingId !== null ? 'opacity-60 cursor-default' : ''}`}
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] animate-spin" />
                  )}
                </div>
                {showSuggestions && suggestions.length > 0 && editingId === null && (
                  <div className="absolute z-10 w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
                    {suggestions.map(s => (
                      <button
                        key={s.symbol}
                        onMouseDown={() => selectTicker(s.symbol)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--color-surface-hover)] transition-colors text-left"
                      >
                        <span className="text-white font-mono font-bold text-sm">{s.symbol}</span>
                        <span className="text-[var(--color-text-muted)] text-xs truncate ml-3 max-w-[200px]">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('Shares *', 'shares', 'e.g. 100')}
                {numField('Entry Price ($) *', 'entryPrice', 'e.g. 175.00')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {numField('Current Price ($) *', 'currentPrice', 'e.g. 189.00')}
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Entry Date</label>
                  <input
                    type="date"
                    value={form.entryDate}
                    onChange={e => handleEntryDateChange(e.target.value)}
                    className="w-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="flex space-x-3 pt-1">
              <button onClick={() => { setShowModal(false); setEditingId(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-colors">
                {editingId !== null ? 'Save Changes' : 'Add Position'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
