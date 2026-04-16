import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminTable from '@/components/AdminTable'
import SendCharts from '@/components/SendCharts'

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
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center">
            <img src="/LogoWeißSales.png" alt="Sales Culture Logo" className="w-32 h-auto" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Versand-Übersicht</h1>
            <p className="text-gray-400 text-sm">Organisation: {userDomain} · {logs.length} Versand-Aktionen</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <a href="/app" className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm text-gray-300 font-medium transition-colors">
            ← Zurück zum Versand
          </a>
          {isAdmin && (
            <a href="/app/admin" className="inline-flex items-center gap-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 px-4 py-2 text-sm text-purple-300 font-medium transition-colors">
              🛡️ Admin
            </a>
          )}
        </div>

        {dbError ? (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm font-mono">{dbError}</div>
        ) : (
          <>
            <SendCharts logs={logs} isAdmin={isAdmin} />
            <AdminTable logs={logs} currentUserEmail={session.user.email} />
          </>
        )}
      </div>
    </main>
  )
}
