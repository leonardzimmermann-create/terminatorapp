import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProtectedArea from '@/components/ProtectedArea'

export default async function AppPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/unauthorized')
  }

  // Track session-start (max once per hour per user)
  if (session.user?.email) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recent = await prisma.loginEvent.findFirst({
      where: { userEmail: session.user.email, createdAt: { gte: oneHourAgo } },
    })
    if (!recent) {
      prisma.loginEvent.create({
        data: { userEmail: session.user.email, userName: session.user.name ?? null },
      }).catch(() => {})
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center">
              <img src="/LogoWeißSales.png" alt="Sales Culture Logo" className="w-32 h-auto" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Terminator</h1>
          </div>
          <p className="text-gray-400 text-sm ml-12">Willkommen, {session.user?.name ?? session.user?.email}</p>
        </div>
        <ProtectedArea />
      </div>
    </main>
  )
}
