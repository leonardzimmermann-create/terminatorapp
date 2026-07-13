import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Nur die System-Admins von Sales Culture und Smartflow
const ADMIN_EMAILS = ['leonard.zimmermann@smartflow-consulting.com', 'rolf.zimmermann@smartflow-consulting.com', 'marcel@sales-culture.de', 'david@sales-culture.de']

type GraphAttendee = { emailAddress?: { address?: string; name?: string }; status?: { response?: string; time?: string }; type?: string }
type GraphEventBody = { id?: string; subject?: string; isCancelled?: boolean; organizer?: { emailAddress?: { address?: string } }; attendees?: GraphAttendee[]; error?: unknown }
type BatchResponse = { id: string; status: number; body: GraphEventBody }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const logId = parseInt(body?.logId)
  if (isNaN(logId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  // Nur eigene Versendungen des Admins
  const log = await prisma.sendLog.findFirst({
    where: { id: logId, userEmail: session.user.email },
    include: { invitations: true },
  })
  if (!log) return NextResponse.json({ error: 'Nicht gefunden oder kein Zugriff' }, { status: 404 })

  const accessToken = session.accessToken as string
  const BATCH_LIMIT = 20

  type EventDebug = {
    invitationId: number
    leadEmail: string
    leadName: string
    eventId: string
    storedResponse: string
    httpStatus: number | null
    matchedAttendee: { address: string; name: string; response: string } | null
    emailMatch: boolean
    interpretedResponse: string
    attendees: GraphAttendee[] | null
    raw: unknown
    error: string | null
  }

  const events: EventDebug[] = []

  for (let i = 0; i < log.invitations.length; i += BATCH_LIMIT) {
    const slice = log.invitations.slice(i, i + BATCH_LIMIT)

    const batchRequests = slice.map((inv, j) => ({
      id: String(i + j),
      method: 'GET',
      url: `/me/events/${inv.eventId}?$select=id,subject,isCancelled,organizer,attendees`,
    }))

    try {
      const batchRes = await fetch('https://graph.microsoft.com/v1.0/$batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: batchRequests }),
      })
      const batchData = await batchRes.json()
      const responses: BatchResponse[] = batchData.responses ?? []

      for (let j = 0; j < slice.length; j++) {
        const inv = slice[j]
        const resp = responses.find((r) => r.id === String(i + j))

        if (!resp) {
          events.push({
            invitationId: inv.id, leadEmail: inv.leadEmail, leadName: inv.leadName, eventId: inv.eventId,
            storedResponse: inv.response, httpStatus: null, matchedAttendee: null, emailMatch: false,
            interpretedResponse: 'unknown', attendees: null, raw: null, error: 'Keine Antwort im Batch',
          })
          continue
        }

        const attendees = resp.body?.attendees ?? null
        const attendee = attendees?.find(
          (a) => a.emailAddress?.address?.toLowerCase() === inv.leadEmail.toLowerCase()
        )
        const rawResponse = attendee?.status?.response ?? 'notResponded'
        const interpreted = resp.status !== 200 ? 'unknown' : (rawResponse === 'none' ? 'notResponded' : rawResponse)

        events.push({
          invitationId: inv.id,
          leadEmail: inv.leadEmail,
          leadName: inv.leadName,
          eventId: inv.eventId,
          storedResponse: inv.response,
          httpStatus: resp.status,
          matchedAttendee: attendee
            ? {
                address: attendee.emailAddress?.address ?? '',
                name: attendee.emailAddress?.name ?? '',
                response: attendee.status?.response ?? '',
              }
            : null,
          emailMatch: !!attendee,
          interpretedResponse: interpreted,
          attendees,
          raw: resp.body,
          error: resp.status !== 200 ? `HTTP ${resp.status}` : null,
        })
      }
    } catch (e) {
      for (const inv of slice) {
        events.push({
          invitationId: inv.id, leadEmail: inv.leadEmail, leadName: inv.leadName, eventId: inv.eventId,
          storedResponse: inv.response, httpStatus: null, matchedAttendee: null, emailMatch: false,
          interpretedResponse: 'unknown', attendees: null, raw: null, error: (e as Error).message,
        })
      }
    }
  }

  return NextResponse.json({
    logId: log.id,
    subject: log.subject,
    sentAt: log.sentAt,
    userEmail: log.userEmail,
    events,
  })
}
