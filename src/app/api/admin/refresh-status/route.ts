import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const logId = parseInt(body?.logId)
  if (isNaN(logId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const log = await prisma.sendLog.findFirst({
    where: { id: logId, userEmail: session.user.email },
    include: { invitations: true },
  })

  if (!log) return NextResponse.json({ error: 'Nicht gefunden oder kein Zugriff' }, { status: 404 })

  const accessToken = session.accessToken as string

  // Use Graph API $batch to send all requests in a single HTTP call (avoids MailboxConcurrency limit)
  // Max 20 requests per $batch call
  const BATCH_LIMIT = 20
  const fetchedResponses: Array<{ inv: typeof log.invitations[number]; response: string }> = []

  for (let i = 0; i < log.invitations.length; i += BATCH_LIMIT) {
    const slice = log.invitations.slice(i, i + BATCH_LIMIT)

    const batchRequests = slice.map((inv: typeof log.invitations[number], j: number) => ({
      id: String(i + j),
      method: 'GET',
      url: `/me/events/${inv.eventId}?$select=attendees`,
    }))

    try {
      const batchRes = await fetch('https://graph.microsoft.com/v1.0/$batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: batchRequests }),
      })
      const batchData = await batchRes.json()
      const responses: Array<{ id: string; status: number; body: { attendees?: Array<{ emailAddress: { address: string }; status: { response: string } }> } }> = batchData.responses ?? []

      for (let j = 0; j < slice.length; j++) {
        const inv = slice[j]
        const resp = responses.find((r) => r.id === String(i + j))
        if (!resp || resp.status !== 200) {
          fetchedResponses.push({ inv, response: 'unknown' })
          continue
        }
        const attendee = resp.body?.attendees?.find((a) =>
          a.emailAddress.address.toLowerCase() === inv.leadEmail.toLowerCase()
        )
        fetchedResponses.push({ inv, response: attendee?.status?.response ?? 'notResponded' })
      }
    } catch {
      for (const inv of slice) {
        fetchedResponses.push({ inv, response: 'unknown' })
      }
    }
  }

  // Count
  let accepted = 0, declined = 0, tentative = 0
  for (const { response } of fetchedResponses) {
    if (response === 'accepted') accepted++
    else if (response === 'declined') declined++
    else if (response === 'tentativelyAccepted') tentative++
  }

  // All DB writes in a single atomic transaction to prevent SQLite lock conflicts
  const updated = await prisma.$transaction(async (tx) => {
    for (const { inv, response } of fetchedResponses) {
      await tx.sentInvitation.update({ where: { id: inv.id }, data: { response } })
    }
    return tx.sendLog.update({
      where: { id: logId },
      data: { acceptedCount: accepted, declinedCount: declined, tentativeCount: tentative },
    })
  })

  const updatedInvitations = fetchedResponses.map(({ inv, response }) => ({
    id: inv.id, leadEmail: inv.leadEmail, leadName: inv.leadName, response,
    slotStart: inv.slotStart, slotEnd: inv.slotEnd,
  }))

  return NextResponse.json({ log: updated, invitations: updatedInvitations })
}
