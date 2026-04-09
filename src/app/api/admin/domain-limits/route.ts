import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = 'leonard.zimmermann@smartflow-consulting.com'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const limits = await prisma.domainLimit.findMany({ orderBy: { domain: 'asc' } })

  const limitsWithCount = await Promise.all(
    limits.map(async (l) => {
      const sentCount = await prisma.sentInvitation.count({
        where: { sendLog: { userEmail: { endsWith: `@${l.domain}` } } },
      })
      return { ...l, sentCount }
    })
  )

  return Response.json(limitsWithCount)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const { domain, sendLimit } = await req.json()
  if (!domain || typeof sendLimit !== 'number' || sendLimit < 1) {
    return new Response(JSON.stringify({ error: 'Ungültige Eingabe' }), { status: 400 })
  }

  const entry = await prisma.domainLimit.upsert({
    where: { domain },
    update: { sendLimit },
    create: { domain, sendLimit },
  })

  const sentCount = await prisma.sentInvitation.count({
    where: { sendLog: { userEmail: { endsWith: `@${domain}` } } },
  })

  return Response.json({ ...entry, sentCount })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const { domain, sharepointBlacklistUrl } = await req.json()
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Domain fehlt' }), { status: 400 })
  }

  const entry = await prisma.domainLimit.update({
    where: { domain },
    data: { sharepointBlacklistUrl: sharepointBlacklistUrl || null },
  })

  return Response.json(entry)
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
