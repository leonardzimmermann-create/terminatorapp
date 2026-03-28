import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = 'leonard.zimmermann@smartflow-consulting.com'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.email === ADMIN_EMAIL ? session : null
}

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  const entry = await prisma.blacklistEntry.upsert({
    where: { email },
    create: { email },
    update: {},
  })
  return NextResponse.json(entry)
}

export async function DELETE(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  await prisma.blacklistEntry.delete({ where: { email } })
  return NextResponse.json({ ok: true })
}
