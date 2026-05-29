import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { periodStart, nextPeriodStart } from '@/lib/period'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), { status: 401 })
  }

  const email = session.user.email
  const domain = email.split('@')[1]
  if (!domain) {
    return Response.json({ sentCount: 0, sendLimit: null, remaining: null })
  }

  const limit = await prisma.domainLimit.findUnique({ where: { domain } })
  if (!limit) {
    return Response.json({ sentCount: 0, sendLimit: null, remaining: null })
  }

  const firstSendLog = await prisma.sendLog.findFirst({
    where: { userEmail: { endsWith: `@${domain}` } },
    orderBy: { sentAt: 'asc' },
    select: { sentAt: true },
  })

  if (!firstSendLog) {
    return Response.json({ sentCount: 0, sendLimit: limit.sendLimit, remaining: limit.sendLimit })
  }

  const winStart = periodStart(firstSendLog.sentAt, limit.resetIntervalMonths)
  const winEnd = nextPeriodStart(firstSendLog.sentAt, limit.resetIntervalMonths)

  const sentCount = await prisma.sentInvitation.count({
    where: { sendLog: { userEmail: { endsWith: `@${domain}` }, sentAt: { gte: winStart, lt: winEnd } } },
  })

  const remaining = limit.sendLimit - sentCount

  return Response.json({ sentCount, sendLimit: limit.sendLimit, remaining })
}
