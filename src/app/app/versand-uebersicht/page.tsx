import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import VersandClient from '@/components/VersandClient'
import VersandPageHeader from '@/components/VersandPageHeader'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/app')

  const ADMIN_EMAILS = ['leonard.zimmermann@smartflow-consulting.com', 'rolf.zimmermann@smartflow-consulting.com', 'marcel@sales-culture.de', 'david@sales-culture.de']
  const isAdmin = ADMIN_EMAILS.includes(session.user.email)
  const userDomain = session.user.email.split('@')[1] ?? ''

  const userRole = isAdmin ? 'system_admin' : (
    (await prisma.userRole.findUnique({ where: { email: session.user.email } }))?.role ?? 'user'
  )
  const isUserAdmin = userRole === 'user_admin'

  let logs: Awaited<ReturnType<typeof prisma.sendLog.findMany<{ include: { invitations: true } }>>> = []
  let dbError: string | null = null

  try {
    let whereClause: object | undefined
    if (isAdmin) {
      whereClause = undefined
    } else if (isUserAdmin) {
      whereClause = { userEmail: { endsWith: `@${userDomain}` } }
    } else {
      whereClause = { userEmail: session.user.email }
    }
    logs = await prisma.sendLog.findMany({
      where: whereClause,
      orderBy: { sentAt: 'desc' },
      include: { invitations: true },
    })
  } catch (e) {
    dbError = (e as Error).message
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <VersandPageHeader domain={userDomain} logCount={logs.length} isAdmin={isAdmin} />

        {dbError ? (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm font-mono">{dbError}</div>
        ) : (
          <VersandClient logs={logs} isAdmin={isAdmin} currentUserEmail={session.user.email} />
        )}
      </div>
    </main>
  )
}
