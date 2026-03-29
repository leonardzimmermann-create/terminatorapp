import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/')

  const blocked = await prisma.blacklistEntry.findUnique({
    where: { email: session.user.email },
  })
  if (blocked) redirect('/not-authorized')

  return <>{children}</>
}
