import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = 'leonard.zimmermann@smartflow-consulting.com'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const logs = await prisma.sendLog.findMany({
    orderBy: { sentAt: 'desc' },
  })

  return NextResponse.json({ logs })
}
