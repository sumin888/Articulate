import { NextRequest, NextResponse } from 'next/server'
import dns from 'dns/promises'
import { createChatCompletion } from '@/lib/chat-completion'

export const maxDuration = 30

// Approx 3000 tokens ≈ 12000 characters
const MAX_CHARS = 12000

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return true // IPv6 or unparseable — block by default
  const [a, b] = parts
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 169 || // link-local
    a === 0
  )
}

async function checkSSRF(url: URL): Promise<void> {
  const hostname = url.hostname
  // Reject IPs directly supplied as hostname
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error('SSRF: private IP address not allowed')
    }
    return
  }
  try {
    const { address } = await dns.lookup(hostname)
    if (isPrivateIP(address)) {
      throw new Error('SSRF: hostname resolves to private IP')
    }
  } catch (err: unknown) {
    if ((err as Error).message.startsWith('SSRF:')) throw err
    throw new Error('SSRF: could not resolve hostname')
  }
}

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Request body must be JSON' }, { status: 400 })
  }

  const rawUrl = body?.url?.trim()
  if (!rawUrl) {
    return NextResponse.json({ error: 'invalid_request', message: 'url is required' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'invalid_url', message: 'Provide a valid HTTP or HTTPS URL' }, { status: 400 })
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'invalid_url', message: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 })
  }

  try {
    await checkSSRF(parsedUrl)
  } catch {
    return NextResponse.json({ error: 'fetch_failed', message: 'That URL is not accessible' }, { status: 400 })
  }

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
        { error: 'fetch_failed', message: `The page returned status ${res.status}. It may be paywalled or require login.` },
        { status: 422 }
      )
    }
    html = await res.text()
  } catch (err: unknown) {
    const isAbort = (err as Error)?.name === 'AbortError'
    return NextResponse.json(
      { error: 'fetch_failed', message: isAbort ? 'Request timed out. Try a different URL.' : 'Could not fetch that URL. It may be paywalled or bot-blocked.' },
      { status: 422 }
    )
  }

  // Extract clean article text using Readability + jsdom
  let articleText: string
  let articleTitle: string
  try {
    const { JSDOM } = await import('jsdom')
    const { Readability } = await import('@mozilla/readability')
    const dom = new JSDOM(html, { url: rawUrl })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    if (!article || !article.textContent?.trim()) {
      return NextResponse.json(
        { error: 'fetch_failed', message: 'Could not extract readable text from that page. Try a different URL.' },
        { status: 422 }
      )
    }
    articleTitle = article.title ?? parsedUrl.hostname
    articleText = article.textContent.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
  } catch {
    return NextResponse.json(
      { error: 'fetch_failed', message: 'Failed to parse the page content.' },
      { status: 422 }
    )
  }

  const wordCount = articleText.split(/\s+/).filter(Boolean).length

  const prompt = `Given this article text, generate a TextMap activity with two parts.

Article title: ${articleTitle}
Article URL: ${rawUrl}

Article text:
${articleText}

Part 1 — Argument Structure Map
Identify the following components from the article and return them as JSON:
- claim: the main argument or thesis (one sentence)
- evidence: array of 2-3 pieces of supporting evidence cited in the article
- warrant: the underlying reasoning that connects the evidence to the claim

Part 2 — Comprehension Questions
Generate exactly 3 reading comprehension questions of increasing difficulty:
- level 1: factual recall (answer is explicitly in the text)
- level 2: inference (requires reading between the lines)
- level 3: synthesis (requires connecting the article to outside knowledge)

For each question, include the correct answer and a one-sentence explanation.

Return ONLY valid JSON in this exact shape:
{
  "articleTitle": "...",
  "articleUrl": "...",
  "wordCount": ${wordCount},
  "map": {
    "claim": "...",
    "evidence": ["...", "...", "..."],
    "warrant": "..."
  },
  "questions": [
    { "level": 1, "question": "...", "answer": "...", "explanation": "..." },
    { "level": 2, "question": "...", "answer": "...", "explanation": "..." },
    { "level": 3, "question": "...", "answer": "...", "explanation": "..." }
  ]
}`

  let textmapData: unknown
  try {
    const response = await createChatCompletion({
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = response.choices[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON in response')
    textmapData = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json(
      { error: 'fetch_failed', message: 'Failed to generate TextMap from article. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json(textmapData)
}
