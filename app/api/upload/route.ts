import { NextRequest } from 'next/server'
import { bootstrapSessionStreamable } from '@/lib/content-analyzer'
import { chunkIntoSlides } from '@/lib/content-analyzer'
import { createSession, updateSession, saveChunks } from '@/lib/session-store'
import type { Concept } from '@/lib/session-store'

export const maxDuration = 60


/** Minimum extracted text to consider a PDF text-based (not image-only). */
const IMAGE_PDF_THRESHOLD = 100

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(sseEvent(data)))
      }

      try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const pastedText = formData.get('text') as string | null

        let sourceText = ''
        let sourceTitle = 'Uploaded Material'

        emit({ type: 'progress', message: 'Reading your material…' })

        if (file) {
          sourceTitle = file.name.replace(/\.[^/.]+$/, '')
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
          const pdfMod = require('pdf-parse') as any
          const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
            typeof pdfMod === 'function' ? pdfMod : pdfMod.default
          const parsed = await pdfParse(buffer)
          sourceText = parsed.text

          if (sourceText.trim().length < IMAGE_PDF_THRESHOLD) {
            emit({
              type: 'error',
              message:
                'This PDF appears to be image-based (scanned pages with no selectable text). ' +
                'Please upload a text-based PDF or paste your notes directly.',
            })
            controller.close()
            return
          }
        } else if (pastedText) {
          sourceText = pastedText
          sourceTitle = 'Pasted Notes'
        } else {
          emit({ type: 'error', message: 'No content provided.' })
          controller.close()
          return
        }

        if (sourceText.trim().length < 100) {
          emit({ type: 'error', message: 'Content too short to analyze.' })
          controller.close()
          return
        }

        console.log('[upload] text extracted, length:', sourceText.length)

        // Chunk into slides and save (non-blocking relative to concept streaming)
        emit({ type: 'progress', message: 'Chunking into slides…' })
        const chunks = chunkIntoSlides(sourceText)
        console.log('[upload] slide chunks:', chunks.length)

        // Stream concept extraction
        emit({ type: 'progress', message: 'Extracting key concepts…' })

        const concepts: Concept[] = []
        let openingMessage = ''

        for await (const event of bootstrapSessionStreamable(sourceText, sourceTitle)) {
          if (event.type === 'concept') {
            concepts.push(event.concept)
            emit({ type: 'concept', concept: event.concept })
          } else if (event.type === 'opening') {
            openingMessage = event.openingMessage
          }
        }

        console.log('[upload] concepts streamed:', concepts.length)

        // Build index and create session
        emit({ type: 'progress', message: 'Building search index…' })

        const session = await createSession(sourceText, sourceTitle, concepts)
        await Promise.all([
          updateSession(session.id, {
            conversationHistory: [{ role: 'articulate', content: openingMessage }],
          }),
          saveChunks(session.id, chunks),
        ])

        console.log('[upload] session created:', session.id)

        emit({ type: 'complete', sessionId: session.id })
      } catch (err) {
        console.error('[upload] error:', err)
        const detail = err instanceof Error ? err.message : String(err)
        emit({ type: 'error', message: `Failed to process content: ${detail}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
