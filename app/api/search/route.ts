import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (q.length < 1) return NextResponse.json([])
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()
    const quotes = (data?.quotes ?? [])
      .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .slice(0, 8)
      .map((q: any) => ({ symbol: q.symbol, name: q.shortname ?? q.longname ?? '' }))
    return NextResponse.json(quotes)
  } catch {
    return NextResponse.json([])
  }
}
