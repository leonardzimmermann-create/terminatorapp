import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ logIds: [] })

  const now = new Date()
  const logs = await prisma.sendLog.findMany({
    where: {
      userEmail: session.user.email,
      invitations: { some: { slotStart: { gte: now } } },
    },
    select: { id: true },
  })

  return NextResponse.json({ logIds: logs.map((l) => l.id) })
}
