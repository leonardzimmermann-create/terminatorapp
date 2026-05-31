import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { periodStart, nextPeriodStart } from '@/lib/period'
import AdminPanel from '@/components/AdminPanel'
import AdminPageHeader from '@/components/AdminPageHeader'

const ADMIN_EMAILS = ['leonard.zimmermann@smartflow-consulting.com', 'rolf.zimmermann@smartflow-consulting.com', 'marcel@sales-culture.de', 'david@sales-culture.de']

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) redirect('/app')

  const [loginEvents, blacklist, domainLimitsRaw, userRoles] = await Promise.all([
    prisma.loginEvent.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.blacklistEntry.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.domainLimit.findMany({ orderBy: { domain: 'asc' } }),
    prisma.userRole.findMany(),
  ])

  // Erstes Login pro Domain aus den bereits geladenen LoginEvents ableiten
  const domainFirstLoginMap = new Map<string, Date>()
  for (const e of loginEvents) {
    const domain = e.userEmail.split('@')[1] ?? ''
    if (domain && !domainFirstLoginMap.has(domain)) {
      domainFirstLoginMap.set(domain, e.createdAt)
    }
  }

  const domainLimits = await Promise.all(
    domainLimitsRaw.map(async (l) => {
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
      const firstLogin = domainFirstLoginMap.get(l.domain) ?? null
      const firstSend = firstSendLog?.sentAt ?? null
      return { ...l, sentCount, blacklistCount, userCount, firstLogin, firstSend }
    })
  )

  const statsMap = new Map<string, { userName: string | null; firstLogin: Date; lastLogin: Date; count: number }>()
  for (const e of loginEvents) {
    const existing = statsMap.get(e.userEmail)
    if (!existing) {
      statsMap.set(e.userEmail, { userName: e.userName, firstLogin: e.createdAt, lastLogin: e.createdAt, count: 1 })
    } else {
      existing.lastLogin = e.createdAt
      existing.count++
      if (e.userName) existing.userName = e.userName
    }
  }

  const userStats = Array.from(statsMap.entries())
    .map(([email, s]) => ({ email, ...s, domain: email.split('@')[1] ?? '' }))
    .sort((a, b) => b.lastLogin.getTime() - a.lastLogin.getTime())

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <AdminPageHeader userCount={userStats.length} blockedCount={blacklist.length} />
        <AdminPanel userStats={userStats} blacklist={blacklist} domainLimits={domainLimits} userRoles={userRoles} />
      </div>
    </main>
  )
}
