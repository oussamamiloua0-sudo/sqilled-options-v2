import { NextRequest, NextResponse } from 'next/server'

const API = process.env.DROPLET_API_URL ?? 'http://147.182.205.5:8000'

// ── Mock fallback ─────────────────────────────────────────────────────────────
// Base prices per ticker (approximate)
const TICKER_BASE: Record<string, number> = { SPY: 420, QQQ: 380, IWM: 195 }

function buildMockResponse(symbol: string, start: string, end: string, delta: number, dte: number) {
  // Generate monthly periods from start → end
  const months: string[] = []
  const d = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  while (d <= endDate) {
    months.push(d.toISOString().slice(0, 7))
    d.setMonth(d.getMonth() + 1)
  }
  if (!months.length) months.push(start.slice(0, 7))

  const basePrice   = TICKER_BASE[symbol] ?? 420
  const premiumBase = parseFloat((basePrice * delta * 0.045).toFixed(2))
  // Small deterministic variation per month (no Math.random)
  const variations  = [1.0, 1.04, 1.13, 1.26, 0.95, 1.37, 1.19, 1.07, 1.29, 0.89, 1.51, 1.16,
                       1.35, 1.24, 1.45, 1.13, 1.32, 1.40, 0.92, 1.21, 1.08, 1.44, 0.97, 1.28]
  const stepBase    = [0.012, -0.004, 0.018, 0.008, -0.003, 0.015, 0.010, -0.002, 0.020, 0.007,
                       0.014, 0.009, 0.016, -0.005, 0.013, 0.011, 0.018, 0.006, 0.014, 0.012,
                       0.009, 0.017, 0.008, 0.015]
  const lossIndices = new Set<number>()
  // one loss every ~6 trades
  for (let i = 4; i < months.length; i += 6) lossIndices.add(i)

  // Build performance curves (indexed, base=100)
  let e25 = 100, e50 = 100, eExp = 100
  const exit25Curve: number[] = [], exit50Curve: number[] = [], exitExpCurve: number[] = []
  const dates: string[] = []
  for (let i = 0; i < months.length; i++) {
    dates.push(`${months[i]}-01`)
    const s = stepBase[i % stepBase.length]
    e25  *= 1 + s * 0.82 + 0.003
    e50  *= 1 + s * 0.88 + 0.002
    eExp *= 1 + s * 0.91 + 0.001
    exit25Curve.push(parseFloat(e25.toFixed(4)))
    exit50Curve.push(parseFloat(e50.toFixed(4)))
    exitExpCurve.push(parseFloat(eExp.toFixed(4)))
  }

  const risk_table = [
    { key: 'exit25',  max_drawdown: 4.2,  total_return: parseFloat((e25  - 100).toFixed(1)), sharpe: 1.82 },
    { key: 'exit50',  max_drawdown: 6.1,  total_return: parseFloat((e50  - 100).toFixed(1)), sharpe: 1.54 },
    { key: 'exitExp', max_drawdown: 9.3,  total_return: parseFloat((eExp - 100).toFixed(1)), sharpe: 1.21 },
  ]

  function buildTrades(scenario: 'exit25' | 'exit50' | 'exitExp') {
    return months.map((m, i) => {
      const premium    = parseFloat((premiumBase * variations[i % variations.length]).toFixed(2))
      const strike     = parseFloat((basePrice * (1 + delta * 0.6 + i * 0.002)).toFixed(2))
      const daysHeld   = scenario === 'exit25' ? Math.min(dte, Math.round(dte * 0.25 + (i % 3)))
        : scenario === 'exit50' ? Math.min(dte, Math.round(dte * 0.55 + (i % 4)))
        : dte
      const closePrice = scenario === 'exit25' ? parseFloat((premium * 0.25).toFixed(2))
        : scenario === 'exit50' ? parseFloat((premium * 0.50).toFixed(2))
        : lossIndices.has(i) ? parseFloat((premium * 1.2).toFixed(2)) : 0
      const pnl = parseFloat(((premium - closePrice) * 100).toFixed(2))
      return {
        open_date:   `${m}-01`,
        expiry:      `${m}-${i % 2 === 0 ? 30 : 28}`,
        strike,
        premium,
        close_price: closePrice,
        pnl,
        days_held:   daysHeld,
        capped:      closePrice > premium,
      }
    })
  }

  const tradesByScenario = {
    exit25:  buildTrades('exit25'),
    exit50:  buildTrades('exit50'),
    exitExp: buildTrades('exitExp'),
  }

  const stats: Record<string, any> = {}
  for (const [key, trades] of Object.entries(tradesByScenario)) {
    const wins     = trades.filter(t => t.pnl >= 0)
    const total    = trades.reduce((s, t) => s + t.pnl, 0)
    const avgPrem  = trades.reduce((s, t) => s + t.premium, 0) / trades.length
    const avgDays  = trades.reduce((s, t) => s + t.days_held, 0) / trades.length
    stats[key] = {
      num_trades:    trades.length,
      win_rate:      parseFloat(((wins.length / trades.length) * 100).toFixed(1)),
      avg_premium:   parseFloat((avgPrem * 100).toFixed(0)),
      avg_pnl:       parseFloat((total / trades.length).toFixed(0)),
      total_pnl:     parseFloat(total.toFixed(0)),
      avg_days_held: parseFloat(avgDays.toFixed(0)),
    }
  }

  return {
    curves:    { dates, exit25: exit25Curve, exit50: exit50Curve, exitExp: exitExpCurve },
    risk_table,
    stats,
    trade_log: tradesByScenario,
    _mock:     true,
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    const res = await fetch(`${API}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) throw new Error(`Droplet returned ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    const mock = buildMockResponse(
      body.symbol ?? 'SPY',
      body.start  ?? '2023-01-01',
      body.end    ?? '2024-06-30',
      body.delta  ?? 0.25,
      body.dte    ?? 45,
    )
    return NextResponse.json(mock)
  }
}
