import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.BLACKLIST_SYNC_API_KEY) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.domain || !Array.isArray(body.blacklist)) {
    return new Response(JSON.stringify({ error: 'Ungültige Anfrage. Erwartet: { domain: string, blacklist: string[] }' }), { status: 400 })
  }

  const customerDomain: string = body.domain.trim().toLowerCase()
  const blacklist: string[] = body.blacklist
    .map((d: unknown) => String(d).trim().toLowerCase())
    .filter(Boolean)

  // Replace all entries for this customer domain
  await prisma.blacklistDomain.deleteMany({ where: { customerDomain } })

  if (blacklist.length > 0) {
    await prisma.blacklistDomain.createMany({
      data: blacklist.map((blockedDomain) => ({ customerDomain, blockedDomain })),
      skipDuplicates: true,
    })
  }

  return Response.json({ ok: true, customerDomain, count: blacklist.length })
}
