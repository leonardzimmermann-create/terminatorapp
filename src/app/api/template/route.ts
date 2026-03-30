import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.email ?? null
}

export async function GET() {
  const email = await getUserEmail()
  if (!email) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const templates = await prisma.userTemplate.findMany({
    where: { email },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, html: true, subject: true },
  })
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const email = await getUserEmail()
  if (!email) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (typeof body?.name !== 'string' || typeof body?.html !== 'string') {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const subject = typeof body.subject === 'string' ? body.subject : ''

  if (body.id) {
    // Update existing
    const updated = await prisma.userTemplate.updateMany({
      where: { id: body.id, email },
      data: { name: body.name, html: body.html, subject },
    })
    if (updated.count === 0) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    const record = await prisma.userTemplate.findFirst({ where: { id: body.id, email } })
    return NextResponse.json({ template: record })
  }

  // Create new
  const record = await prisma.userTemplate.create({
    data: { email, name: body.name, html: body.html, subject },
  })
  return NextResponse.json({ template: record })
}

export async function DELETE(req: NextRequest) {
  const email = await getUserEmail()
  if (!email) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = parseInt(searchParams.get('id') ?? '')
  if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  await prisma.userTemplate.deleteMany({ where: { id, email } })
  return NextResponse.json({ ok: true })
}
