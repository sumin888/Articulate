import { NextRequest, NextResponse } from 'next/server'
import dns from 'dns/promises'

export const maxDuration = 30

// ~400 words visible to the student
const EXCERPT_CHARS = 2200

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return true
  const [a, b] = parts
  return (
    a === 127 || a === 10 || a === 0 || a === 169 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

async function checkSSRF(url: URL): Promise<void> {
  const { hostname } = url
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIP(hostname)) throw new Error('private IP not allowed')
    return
  }
  const { address } = await dns.lookup(hostname).catch(() => { throw new Error('could not resolve hostname') })
  if (isPrivateIP(address)) throw new Error('hostname resolves to private IP')
}

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 }) }

  const rawUrl = body?.url?.trim()
  if (!rawUrl) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  let parsedUrl: URL
  try { parsedUrl = new URL(rawUrl) }
  catch { return NextResponse.json({ error: 'fetch_failed', message: 'Provide a valid HTTP or HTTPS URL' }, { status: 400 }) }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'fetch_failed', message: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 })
  }

  try { await checkSSRF(parsedUrl) }
  catch { return NextResponse.json({ error: 'fetch_failed', message: 'That URL is not accessible' }, { status: 400 }) }

  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArticulateBot/1.0)' },
    })
    clearTimeout(timeout)
    if (!res.ok) {
      return NextResponse.json(
        { error: 'fetch_failed', message: `Page returned ${res.status}. It may be paywalled or require login.` },
        { status: 422 }
      )
    }
    html = await res.text()
  } catch (err: unknown) {
    const isAbort = (err as Error)?.name === 'AbortError'
    return NextResponse.json(
      { error: 'fetch_failed', message: isAbort ? 'Request timed out.' : 'Could not fetch that URL. It may be paywalled or bot-blocked.' },
      { status: 422 }
    )
  }

  try {
    const { JSDOM } = await import('jsdom')
    const { Readability } = await import('@mozilla/readability')
    const dom = new JSDOM(html, { url: rawUrl })
    const article = new Readability(dom.window.document).parse()
    if (!article?.textContent?.trim()) {
      return NextResponse.json(
        { error: 'fetch_failed', message: 'Could not extract readable text. Try a different URL.' },
        { status: 422 }
      )
    }
    const excerpt = article.textContent.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_CHARS)
    return NextResponse.json({
      articleTitle: article.title ?? parsedUrl.hostname,
      articleUrl: rawUrl,
      excerpt,
    })
  } catch {
    return NextResponse.json({ error: 'fetch_failed', message: 'Failed to parse page content.' }, { status: 422 })
  }
}
