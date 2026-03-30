import { NextRequest, NextResponse } from 'next/server'
import { bootstrapSessionFromMaterial } from '@/lib/content-analyzer'
import { createSession, updateSession } from '@/lib/session-store'

/** Parse only the first N pages for speed; enough for typical lecture PDFs. */
const PDF_FIRST_PAGES = 50

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const pastedText = formData.get('text') as string | null

    let sourceText = ''
    let sourceTitle = 'Uploaded Material'

    if (file) {
      sourceTitle = file.name.replace(/\.[^/.]+$/, '')
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      try {
        let result = await parser.getText({ first: PDF_FIRST_PAGES })
        sourceText = result.text
        if (sourceText.trim().length < 100) {
          result = await parser.getText()
          sourceText = result.text
        }
      } finally {
        try {
          await parser.destroy()
        } catch (destroyErr) {
          console.warn('[upload] parser.destroy:', destroyErr)
        }
      }
    } else if (pastedText) {
      sourceText = pastedText
      sourceTitle = 'Pasted Notes'
    } else {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    if (sourceText.trim().length < 100) {
      return NextResponse.json({ error: 'Content too short to analyze' }, { status: 400 })
    }

    console.log('[upload] text extracted, length:', sourceText.length)
    console.log('[upload] bootstrapSessionFromMaterial (single LLM call)...')
    const { concepts, openingMessage } = await bootstrapSessionFromMaterial(sourceText, sourceTitle)
    console.log('[upload] bootstrap done, concepts:', concepts.length)
    const session = createSession(sourceText, sourceTitle, concepts)

    updateSession(session.id, {
      conversationHistory: [{ role: 'articulate', content: openingMessage }],
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (err) {
    console.error('Upload error:', err)
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'Failed to process content', detail },
      { status: 500 }
    )
  }
}
