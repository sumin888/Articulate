import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// ElevenLabs voice ID.
// Using George (JBFqnCBsd6RMkjVDRZzb) — British male premade voice.
// To use Dexter: add it to your VoiceLab at elevenlabs.io/voice-library,
// then paste its voice_id here.
const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

/**
 * Strip LaTeX delimiters so Dexter reads the surrounding text naturally.
 * Displayed messages still contain LaTeX (stripping only happens here).
 */
function stripLatex(text: string): string {
  return text
    // \begin{...}...\end{...} environments (multiline)
    .replace(/\\begin\{[^}]*\}[\s\S]*?\\end\{[^}]*\}/g, '')
    // Display math: $$...$$ and \[...\]
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\\\[[\s\S]*?\\\]/g, '')
    // Inline math: \(...\)
    .replace(/\\\([\s\S]*?\\\)/g, '')
    // Single-dollar inline: $...$  (non-greedy, no newlines)
    .replace(/\$[^\n$]*?\$/g, '')
    // Collapse leftover whitespace
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 })
    }

    const cleanText = stripLatex(text)

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[speak] ElevenLabs error:', res.status, errText)
      return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
    }

    const audioBuffer = await res.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[speak] error:', err)
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }
}
