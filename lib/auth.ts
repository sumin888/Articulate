import { NextRequest } from 'next/server'

export function verifyInstructorToken(req: NextRequest): boolean {
  const token = process.env.INSTRUCTOR_TOKEN
  if (!token) return false
  const auth = req.headers.get('authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  return provided === token
}

export function instructorUnauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
