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
    <main className="min-h-screen p-10">
      <h1 className="text-3xl font-bold mb-4">Geschützter Bereich</h1>
      <p className="mb-4">Willkommen, {session.user?.name ?? session.user?.email}</p>
      <ProtectedArea />
    </main>
  )
}
