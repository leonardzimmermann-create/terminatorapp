import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = 'leonard.zimmermann@smartflow-consulting.com'

function currentMonthRange() {
  const now = new Date()
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }
}

async function enrichLimit(l: { id: number; domain: string; sendLimit: number; userLimit: number | null; createdAt: Date }) {
  const monthRange = currentMonthRange()
  const [sentCount, blacklistCount, userCount] = await Promise.all([
    prisma.sentInvitation.count({
      where: { sendLog: { userEmail: { endsWith: `@${l.domain}` }, sentAt: monthRange } },
    }),
    prisma.blacklistDomain.count({ where: { customerDomain: l.domain } }),
    prisma.user.count({ where: { email: { endsWith: `@${l.domain}` } } }),
  ])
  return { ...l, sentCount, blacklistCount, userCount }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const limits = await prisma.domainLimit.findMany({ orderBy: { domain: 'asc' } })
  const limitsWithCount = await Promise.all(limits.map(enrichLimit))
  return Response.json(limitsWithCount)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const { domain, sendLimit, userLimit } = await req.json()
  if (!domain || typeof sendLimit !== 'number' || sendLimit < 1) {
    return new Response(JSON.stringify({ error: 'Ungültige Eingabe' }), { status: 400 })
  }

  const entry = await prisma.domainLimit.upsert({
    where: { domain },
    update: { sendLimit, userLimit: userLimit ?? null },
    create: { domain, sendLimit, userLimit: userLimit ?? null },
  })

  return Response.json(await enrichLimit(entry))
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const { domain } = await req.json()
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Domain fehlt' }), { status: 400 })
  }

  await prisma.domainLimit.delete({ where: { domain } }).catch(() => {})
  return Response.json({ ok: true })
}
