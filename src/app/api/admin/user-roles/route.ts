import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAILS = ['leonard.zimmermann@smartflow-consulting.com', 'rolf.zimmermann@smartflow-consulting.com', 'marcel@sales-culture.de', 'david@sales-culture.de']

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const roles = await prisma.userRole.findMany()
  return Response.json(roles)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 403 })
  }

  const { email, role, canExport } = await req.json()
  if (!email) {
    return new Response(JSON.stringify({ error: 'Ungültige Eingabe' }), { status: 400 })
  }
  if (role !== undefined && !['user', 'user_admin'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Ungültige Rolle' }), { status: 400 })
  }
  if (canExport !== undefined && typeof canExport !== 'boolean') {
    return new Response(JSON.stringify({ error: 'Ungültiger canExport-Wert' }), { status: 400 })
  }

  const updateData: { role?: string; canExport?: boolean } = {}
  if (role !== undefined) updateData.role = role
  if (canExport !== undefined) updateData.canExport = canExport

  const entry = await prisma.userRole.upsert({
    where: { email },
    update: updateData,
    create: { email, role: role ?? 'user', canExport: canExport ?? false },
  })

  return Response.json(entry)
}
