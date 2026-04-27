import { NextRequest, NextResponse } from 'next/server';

const POSTHOG_HOST = 'https://us.i.posthog.com';

async function proxy(req: NextRequest, path: string) {
  const search = req.nextUrl.search;
  const url = `${POSTHOG_HOST}/${path}${search}`;

  // Forward real client IP so PostHog can do GeoIP lookup
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '';

  const headers: Record<string, string> = {
    'content-type': req.headers.get('content-type') || 'application/json',
  };
  if (clientIp) headers['x-forwarded-for'] = clientIp;

  const body = req.method !== 'GET' ? await req.text() : undefined;

  const res = await fetch(url, { method: req.method, headers, body });
  const resBody = await res.text();

  return new NextResponse(resBody, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return proxy(req, (path ?? []).join('/'));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return proxy(req, (path ?? []).join('/'));
}
