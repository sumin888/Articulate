import { NextRequest, NextResponse } from 'next/server'
import WebSocket from 'ws'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as Blob | null
    const sampleRate = (formData.get('sample_rate') as string) ?? '16000'

    if (!audio) {
      return NextResponse.json({ error: 'Audio required' }, { status: 400 })
    }

    const buffer = Buffer.from(await audio.arrayBuffer())

    const transcript = await transcribeWithPulse(buffer, parseInt(sampleRate, 10))
    return NextResponse.json({ transcript })
  } catch (err) {
    console.error('[transcribe] error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}

function transcribeWithPulse(pcmBuffer: Buffer, sampleRate: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://api.smallest.ai/waves/v1/pulse/get_text', {
      headers: {
        Authorization: `Bearer ${process.env.SMALLEST_API_KEY}`,
        encoding: 'linear16',
        sample_rate: String(sampleRate),
        language: 'en',
      },
    })

    let fullTranscript = ''
    let settled = false

    const done = (transcript: string) => {
      if (settled) return
      settled = true
      ws.close()
      resolve(transcript)
    }

    const fail = (reason: string) => {
      if (settled) return
      settled = true
      ws.close()
      reject(new Error(reason))
    }

    // 10 s hard cap — only fires if Pulse sends nothing at all
    const timeout = setTimeout(() => fail('Pulse STT timeout'), 10_000)

    ws.on('open', () => {
      const CHUNK = 4096
      for (let i = 0; i < pcmBuffer.length; i += CHUNK) {
        ws.send(pcmBuffer.slice(i, i + CHUNK))
      }
      ws.send(JSON.stringify({ type: 'finalize' }))
    })

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          transcript?: string
          is_last?: boolean
          is_final?: boolean
        }

        if (msg.is_final) {
          if (msg.transcript) {
            // Got real content — resolve immediately, no need to wait for trailing empty msg
            fullTranscript += msg.transcript
            clearTimeout(timeout)
            done(fullTranscript.trim())
          } else if (!fullTranscript) {
            // Pulse returned is_final with no content = silence / no speech detected
            clearTimeout(timeout)
            done('')
          }
          // If msg.transcript is empty but we already have content, ignore (trailing cleanup msg)
        }

        if (msg.is_last && !settled) {
          clearTimeout(timeout)
          done(fullTranscript.trim())
        }
      } catch {
        // non-JSON frame, ignore
      }
    })

    ws.on('close', () => {
      clearTimeout(timeout)
      // Connection closed without is_last — return whatever we have
      if (!settled) done(fullTranscript)
    })

    ws.on('error', (err) => {
      clearTimeout(timeout)
      console.error('[transcribe] WebSocket error:', err)
      fail(String(err))
    })
  })
}
