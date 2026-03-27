import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import ProtectedArea from '@/components/ProtectedArea'

export default async function AppPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/unauthorized')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 shadow-lg">
              <span className="text-lg">⚡</span>
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
