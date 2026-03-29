import { NextRequest, NextResponse } from 'next/server'
import { extractConcepts } from '@/lib/content-analyzer'
import { createSession } from '@/lib/session-store'
import { generateOpeningQuestion } from '@/lib/session-engine'
import { updateSession } from '@/lib/session-store'

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
      const result = await parser.getText()
      sourceText = result.text
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
    console.log('[upload] calling extractConcepts...')
    const concepts = await extractConcepts(sourceText)
    console.log('[upload] concepts extracted:', concepts.length)
    const session = createSession(sourceText, sourceTitle, concepts)

    console.log('[upload] calling generateOpeningQuestion...')
    const opening = await generateOpeningQuestion(session)
    console.log('[upload] opening question generated')
    updateSession(session.id, {
      conversationHistory: [{ role: 'articulate', content: opening.message }],
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Failed to process content' }, { status: 500 })
  }
}
