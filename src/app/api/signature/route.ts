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

  const record = await prisma.userSignature.findUnique({ where: { email } })
  return NextResponse.json({ html: record?.html ?? '' })
}

export async function POST(req: NextRequest) {
  const email = await getUserEmail()
  if (!email) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (typeof body?.html !== 'string') {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  await prisma.userSignature.upsert({
    where: { email },
    update: { html: body.html },
    create: { email, html: body.html },
  })

  return NextResponse.json({ ok: true })
}
