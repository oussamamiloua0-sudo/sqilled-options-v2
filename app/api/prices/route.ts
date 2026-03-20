import { NextRequest, NextResponse } from 'next/server'

const API = process.env.DROPLET_API_URL ?? 'http://147.182.205.5:8000'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol') ?? 'SPY'
    const start = searchParams.get('start') ?? '2023-01-01'
    const end = searchParams.get('end') ?? new Date().toISOString().slice(0, 10)
    const res = await fetch(`${API}/prices?symbol=${symbol}&start=${start}&end=${end}`, {
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
