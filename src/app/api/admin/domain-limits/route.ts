import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { periodStart, nextPeriodStart } from '@/lib/period'

const ADMIN_EMAILS = ['leonard.zimmermann@smartflow-consulting.com', 'rolf.zimmermann@smartflow-consulting.com', 'marcel@sales-culture.de', 'david@sales-culture.de']

async function enrichLimit(l: { id: number; domain: string; sendLimit: number; userLimit: number | null; resetIntervalMonths: number; createdAt: Date }) {
  const firstSendLog = await prisma.sendLog.findFirst({
    where: { userEmail: { endsWith: `@${l.domain}` } },
    orderBy: { sentAt: 'asc' },
    select: { sentAt: true },
  })
  const [sentCount, blacklistCount, userCount] = await Promise.all([
    firstSendLog
      ? prisma.sentInvitation.count({
          where: {
            sendLog: {
              userEmail: { endsWith: `@${l.domain}` },
              sentAt: {
                gte: periodStart(firstSendLog.sentAt, l.resetIntervalMonths),
                lt: nextPeriodStart(firstSendLog.sentAt, l.resetIntervalMonths),
              },
            },
          },
        })
      : Promise.resolve(0),
    prisma.blacklistDomain.count({ where: { customerDomain: l.domain } }),
    prisma.user.count({ where: { email: { endsWith: `@${l.domain}` } } }),
  ])
  return { ...l, sentCount, blacklistCount, userCount }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const limits = await prisma.domainLimit.findMany({ orderBy: { domain: 'asc' } })
  const limitsWithCount = await Promise.all(limits.map(enrichLimit))
  return Response.json(limitsWithCount)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const { domain, sendLimit, userLimit, resetIntervalMonths } = await req.json()
  if (!domain || typeof sendLimit !== 'number' || sendLimit < 1) {
    return new Response(JSON.stringify({ error: 'Ungültige Eingabe' }), { status: 400 })
  }

  const validSendLimit = Math.round(sendLimit)
  const validUserLimit = typeof userLimit === 'number' ? Math.round(userLimit) : null
  const interval = typeof resetIntervalMonths === 'number' && resetIntervalMonths >= 1
    ? Math.round(resetIntervalMonths)
    : 1

  const entry = await prisma.domainLimit.upsert({
    where: { domain },
    update: { sendLimit: validSendLimit, userLimit: validUserLimit, resetIntervalMonths: interval },
    create: { domain, sendLimit: validSendLimit, userLimit: validUserLimit, resetIntervalMonths: interval },
  })

  return Response.json(await enrichLimit(entry))
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const { domain } = await req.json()
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Domain fehlt' }), { status: 400 })
  }

  await prisma.domainLimit.delete({ where: { domain } }).catch(() => {})
  return Response.json({ ok: true })
}
