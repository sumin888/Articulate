import { NextRequest, NextResponse } from 'next/server'
import { verifyInstructorToken, instructorUnauthorized } from '@/lib/auth'
import { getCourse, listSources } from '@/lib/db'
import { generate_rubric, parse_uploaded_rubric } from '@/lib/instructor-tools'
import { getTemplate, TEMPLATES } from '@/lib/rubric-templates'

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  if (!verifyInstructorToken(req)) return instructorUnauthorized()
  await params
  return NextResponse.json({ templates: TEMPLATES.map(t => ({ templateId: t.templateId, name: t.name })) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  if (!verifyInstructorToken(req)) return instructorUnauthorized()
  const { courseId } = await params

  const course = getCourse(courseId)
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const body = await req.json() as {
    action: 'template' | 'generate' | 'parse_text'
    templateId?: string
    style?: 'stanford_oral_comm' | 'discipline_specific' | 'custom'
    rubricText?: string
  }

  try {
    if (body.action === 'template') {
      const tpl = getTemplate(body.templateId ?? 'stanford_oral_comm')
      if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      const { createRubricVersion } = await import('@/lib/db')
      const rubric = createRubricVersion(courseId, 'template', tpl.dimensions, tpl.origin, tpl.templateId)
      return NextResponse.json({ rubric })
    }

    if (body.action === 'generate') {
      const sources = listSources(courseId)
      const rubric = await generate_rubric(courseId, sources.map(s => s.id), body.style ?? 'discipline_specific')
      return NextResponse.json({ rubric })
    }

    if (body.action === 'parse_text') {
      if (!body.rubricText) return NextResponse.json({ error: 'rubricText is required' }, { status: 400 })
      const rubric = await parse_uploaded_rubric(courseId, body.rubricText)
      return NextResponse.json({ rubric })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
