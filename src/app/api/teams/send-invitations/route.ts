import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Lead = { anrede: string; vorname: string; nachname: string; email: string; firmenname: string }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.leads || !Array.isArray(body.leads)) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const leads: Lead[] = body.leads
  if (leads.length === 0) {
    return NextResponse.json({ error: 'Keine Leads' }, { status: 400 })
  }

  const accessToken = session.accessToken as string
  const windowStart = new Date(body.windowStart)
  const windowEnd = new Date(body.windowEnd)
  const durationMinutes = Number(body.durationMinutes)
  const parallelCount = Number(body.parallelCount)
  const eventBody = typeof body.eventBody === 'string' ? body.eventBody : 'Ein Teams-Termin ist angefragt.'

  if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime()) || windowEnd <= windowStart) {
    return NextResponse.json({ error: 'Ungültiges Zeitfenster' }, { status: 400 })
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return NextResponse.json({ error: 'Ungültige Termindauer' }, { status: 400 })
  }
  if (!Number.isInteger(parallelCount) || parallelCount <= 0) {
    return NextResponse.json({ error: 'Ungültige Parallelität' }, { status: 400 })
  }

  const slotLengthMs = durationMinutes * 60 * 1000
  const totalRangeMs = windowEnd.getTime() - windowStart.getTime()
  const availableSlots = Math.max(0, Math.floor(totalRangeMs / slotLengthMs))

  if (availableSlots <= 0) {
    return NextResponse.json({ error: 'Keine verfügbaren Zeit-Slots' }, { status: 400 })
  }

  const maxLeads = availableSlots * parallelCount
  const meetingLeads = leads.slice(0, maxLeads)
  const overflowLeads = leads.slice(maxLeads)

  const results: Array<{ email: string; status: 'success' | 'failed'; message: string }> = []

  for (let index = 0; index < meetingLeads.length; index += 1) {
    const lead = meetingLeads[index]
    const slotIndex = Math.floor(index / parallelCount)
    const slotStart = new Date(windowStart.getTime() + slotIndex * slotLengthMs)
    const slotEnd = new Date(slotStart.getTime() + slotLengthMs)

    try {
      if (!lead.email || !lead.vorname || !lead.nachname) {
        throw new Error('Ungültiger Lead')
      }

      const personalizedBody = eventBody
        .replace(/\{\{anrede\}\}/g, lead.anrede)
        .replace(/\{\{vorname\}\}/g, lead.vorname)
        .replace(/\{\{nachname\}\}/g, lead.nachname)
        .replace(/\{\{email\}\}/g, lead.email)
        .replace(/\{\{firmenname\}\}/g, lead.firmenname)
        .replace(/<p>/gi, "")
        .replace(/<\/p>/gi, "<br>")
        .replace(/(<br\s*\/?>\s*)+$/i, "")

      const event = {
        subject: `Termin mit ${lead.vorname} ${lead.nachname}`,
        body: {
          contentType: 'HTML',
          content: personalizedBody,
        },
        start: {
          dateTime: slotStart.toISOString().slice(0, 19),
          timeZone: 'UTC',
        },
        end: {
          dateTime: slotEnd.toISOString().slice(0, 19),
          timeZone: 'UTC',
        },
        location: { displayName: 'Online (Teams Meeting)' },
        attendees: [
          {
            emailAddress: { address: lead.email, name: `${lead.vorname} ${lead.nachname}` },
            type: 'required',
          },
        ],
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
        showAs: 'busy',
      }

      const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Graph-Fehler')
      }

      results.push({ email: lead.email, status: 'success', message: 'Einladung versendet' })
    } catch (err) {
      results.push({ email: lead.email, status: 'failed', message: (err as Error).message })
    }
  }

  for (const overflowLead of overflowLeads) {
    results.push({ email: overflowLead.email, status: 'failed', message: 'Kein Termin-Slot mehr verfügbar' })
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const failedCount = results.filter((r) => r.status === 'failed').length
  await prisma.sendLog.create({
    data: {
      userEmail: session.user?.email ?? 'unbekannt',
      totalLeads: leads.length,
      successCount,
      failedCount,
    },
  }).catch(() => {}) // Log-Fehler sollen den Versand nicht blockieren

  return NextResponse.json({ results })
}
