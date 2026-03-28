import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminPanel from '@/components/AdminPanel'

const ADMIN_EMAIL = 'leonard.zimmermann@smartflow-consulting.com'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) redirect('/app')

  const [loginEvents, blacklist] = await Promise.all([
    prisma.loginEvent.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.blacklistEntry.findMany({ orderBy: { createdAt: 'desc' } }),
  ])

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
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-purple-600 shadow-lg">
            <span className="text-lg">🛡️</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Admin</h1>
            <p className="text-gray-400 text-sm">{userStats.length} bekannte User · {blacklist.length} gesperrt</p>
          </div>
        </div>

        <a href="/app/versand-uebersicht" className="mb-8 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm text-gray-300 font-medium transition-colors">
          ← Zurück zur Versand-Übersicht
        </a>

        <AdminPanel userStats={userStats} blacklist={blacklist} />
      </div>
    </main>
  )
}
