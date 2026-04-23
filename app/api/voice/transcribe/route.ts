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
      clearAbsolute()
      clearInactivity()
      ws.close()
      resolve(transcript)
    }

    const fail = (reason: string) => {
      if (settled) return
      settled = true
      clearAbsolute()
      clearInactivity()
      ws.close()
      reject(new Error(reason))
    }

    // Absolute hard cap (covers very long recordings)
    const absoluteTimer = setTimeout(() => fail('Pulse STT timeout'), 30_000)
    const clearAbsolute = () => clearTimeout(absoluteTimer)

    // Inactivity timer — resets on every message. Fires when Pulse goes silent
    // after returning results (handles cases where the socket doesn't close itself).
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null
    const clearInactivity = () => { if (inactivityTimer) clearTimeout(inactivityTimer) }
    const resetInactivity = () => {
      clearInactivity()
      inactivityTimer = setTimeout(() => done(fullTranscript.trim()), 2_000)
    }

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

        // Accumulate every final segment — do NOT resolve early.
        // Pulse sends one is_final per speech segment, so a recording with
        // pauses produces multiple is_final messages. Resolving on the first
        // one drops everything after the first pause.
        if (msg.is_final && msg.transcript) {
          fullTranscript += (fullTranscript ? ' ' : '') + msg.transcript
        }

        // is_last signals the stream is fully done (may not always fire)
        if (msg.is_last) {
          done(fullTranscript.trim())
          return
        }

        // Reset inactivity window after each message so we keep waiting as
        // long as Pulse keeps sending segments
        resetInactivity()
      } catch {
        // non-JSON frame, ignore
      }
    })

    ws.on('close', () => {
      // Socket closed — return whatever we have accumulated
      if (!settled) done(fullTranscript)
    })

    ws.on('error', (err) => {
      console.error('[transcribe] WebSocket error:', err)
      fail(String(err))
    })
  })
}
