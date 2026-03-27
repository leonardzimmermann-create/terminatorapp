import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminTable from '@/components/AdminTable'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/app')

  const ADMIN_EMAIL = 'leonard.zimmermann@smartflow-consulting.com'
  const isAdmin = session.user.email === ADMIN_EMAIL
  const userDomain = session.user.email.split('@')[1] ?? ''

  let logs: Awaited<ReturnType<typeof prisma.sendLog.findMany<{ include: { invitations: true } }>>> = []
  let dbError: string | null = null

  try {
    logs = await prisma.sendLog.findMany({
      where: isAdmin ? undefined : { userEmail: { endsWith: `@${userDomain}` } },
      orderBy: { sentAt: 'desc' },
      include: { invitations: true },
    })
  } catch (e) {
    dbError = (e as Error).message
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 shadow-lg">
            <span className="text-lg">⚡</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Versand-Übersicht</h1>
            <p className="text-gray-400 text-sm">Organisation: {userDomain} · {logs.length} Versand-Aktionen</p>
          </div>
        </div>

        <a href="/app" className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm text-gray-300 font-medium transition-colors">
          ← Zurück zum Versand
        </a>

        {dbError ? (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm font-mono">{dbError}</div>
        ) : (
          <AdminTable logs={logs} currentUserEmail={session.user.email} />
        )}
      </div>
    </main>
  )
}
