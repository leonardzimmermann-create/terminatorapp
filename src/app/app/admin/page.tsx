import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminPanel from '@/components/AdminPanel'
import AdminPageHeader from '@/components/AdminPageHeader'

const ADMIN_EMAILS = ['leonard.zimmermann@smartflow-consulting.com', 'rolf.zimmermann@smartflow-consulting.com', 'marcel@sales-culture.de', 'david@sales-culture.de']

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) redirect('/app')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [loginEvents, blacklist, domainLimitsRaw] = await Promise.all([
    prisma.loginEvent.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.blacklistEntry.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.domainLimit.findMany({ orderBy: { domain: 'asc' } }),
  ])

  const domainLimits = await Promise.all(
    domainLimitsRaw.map(async (l) => {
      const [sentCount, blacklistCount, userCount] = await Promise.all([
        prisma.sentInvitation.count({
          where: { sendLog: { userEmail: { endsWith: `@${l.domain}` }, sentAt: { gte: monthStart, lt: monthEnd } } },
        }),
        prisma.blacklistDomain.count({ where: { customerDomain: l.domain } }),
        prisma.user.count({ where: { email: { endsWith: `@${l.domain}` } } }),
      ])
      return { ...l, sentCount, blacklistCount, userCount }
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
        <AdminPanel userStats={userStats} blacklist={blacklist} domainLimits={domainLimits} />
      </div>
    </main>
  )
}
