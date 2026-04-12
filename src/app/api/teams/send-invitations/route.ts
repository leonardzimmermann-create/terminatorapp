import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Lead = { id?: number; anrede: string; vorname: string; nachname: string; email: string; firmenname: string; var1?: string; var2?: string; var3?: string }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !session.accessToken) {
    return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.leads || !Array.isArray(body.leads)) {
    return new Response(JSON.stringify({ error: 'Ungültige Anfrage' }), { status: 400 })
  }

  const leads: Lead[] = body.leads
  if (leads.length === 0) {
    return new Response(JSON.stringify({ error: 'Keine Leads' }), { status: 400 })
  }

  const accessToken = session.accessToken as string
  const windowStart = new Date(body.windowStart)
  const windowEnd = new Date(body.windowEnd)
  const durationMinutes = Number(body.durationMinutes)
  const parallelCount = Number(body.parallelCount)
  const eventBody = typeof body.eventBody === 'string' ? body.eventBody : 'Ein Teams-Termin ist angefragt.'
  const eventSubject = typeof body.eventSubject === 'string' && body.eventSubject.trim() ? body.eventSubject : 'Hier Terminbetreff eingeben'
  const signature = typeof body.signature === 'string' ? body.signature : ''
  const fullEventBody = signature ? `${eventBody}<br>${signature}` : eventBody

  if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime()) || windowEnd <= windowStart) {
    return new Response(JSON.stringify({ error: 'Ungültiges Zeitfenster' }), { status: 400 })
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return new Response(JSON.stringify({ error: 'Ungültige Termindauer' }), { status: 400 })
  }
  if (!Number.isInteger(parallelCount) || parallelCount <= 0) {
    return new Response(JSON.stringify({ error: 'Ungültige Parallelität' }), { status: 400 })
  }

  const toBerlinDateTime = (date: Date) =>
    date.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).replace(' ', 'T')

  const slotLengthMs = durationMinutes * 60 * 1000
  const totalRangeMs = windowEnd.getTime() - windowStart.getTime()
  const availableSlots = Math.max(0, Math.floor(totalRangeMs / slotLengthMs))

  if (availableSlots <= 0) {
    return new Response(JSON.stringify({ error: 'Keine verfügbaren Zeit-Slots' }), { status: 400 })
  }

  const maxLeads = availableSlots * parallelCount

  // Domain-Limit prüfen
  const userEmail = session.user?.email ?? ''
  const userDomain = userEmail.split('@')[1] ?? ''
  const domainLimit = userDomain
    ? await prisma.domainLimit.findUnique({ where: { domain: userDomain } })
    : null

  let domainLimitReached = false
  let allowedByDomain = maxLeads

  if (domainLimit) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const alreadySent = await prisma.sentInvitation.count({
      where: { sendLog: { userEmail: { endsWith: `@${userDomain}` }, sentAt: { gte: monthStart, lt: monthEnd } } },
    })
    const remaining = domainLimit.sendLimit - alreadySent
    if (remaining <= 0) {
      domainLimitReached = true
      allowedByDomain = 0
    } else {
      allowedByDomain = Math.min(maxLeads, remaining)
    }
  }

  // Blacklist aus DB laden (täglich via Power Automate synchronisiert)
  const blacklistEntries = userDomain
    ? await prisma.blacklistDomain.findMany({ where: { customerDomain: userDomain }, select: { blockedDomain: true } })
    : []
  const blacklistedDomains = new Set(blacklistEntries.map((e) => e.blockedDomain))

  // Leads in erlaubte / blacklisted / overflow aufteilen
  const allowedLeads: Lead[] = []
  const blacklistedLeads: Lead[] = []
  for (const lead of leads) {
    const leadDomain = lead.email.split('@')[1]?.toLowerCase() ?? ''
    if (blacklistedDomains.has(leadDomain)) {
      blacklistedLeads.push(lead)
    } else {
      allowedLeads.push(lead)
    }
  }

  const sliceLimit = domainLimitReached ? 0 : allowedByDomain
  const meetingLeads = allowedLeads.slice(0, sliceLimit)
  const overflowLeads = allowedLeads.slice(sliceLimit)
  const total = leads.length

  const encoder = new TextEncoder()
  const emit = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

  const stream = new ReadableStream({
    async start(controller) {
      const results: Array<{ id?: number; email: string; status: 'success' | 'failed'; message: string }> = []
      const sentInvitations: Array<{ eventId: string; leadEmail: string; leadName: string; slotStart: Date; slotEnd: Date }> = []
      let sent = 0

      for (let index = 0; index < meetingLeads.length; index++) {
        const lead = meetingLeads[index]
        const slotIndex = Math.floor(index / parallelCount)
        const slotStart = new Date(windowStart.getTime() + slotIndex * slotLengthMs)
        const slotEnd = new Date(slotStart.getTime() + slotLengthMs)

        try {
          if (!lead.email || !lead.vorname || !lead.nachname) throw new Error('Ungültiger Lead')

          const personalizedSubject = eventSubject
            .replace(/\{\{anrede\}\}/g, lead.anrede)
            .replace(/\{\{vorname\}\}/g, lead.vorname)
            .replace(/\{\{nachname\}\}/g, lead.nachname)
            .replace(/\{\{email\}\}/g, lead.email)
            .replace(/\{\{firmenname\}\}/g, lead.firmenname)
            .replace(/\{\{var1\}\}/g, lead.var1 ?? '')
            .replace(/\{\{var2\}\}/g, lead.var2 ?? '')
            .replace(/\{\{var3\}\}/g, lead.var3 ?? '')

          const personalizedBody = fullEventBody
            .replace(/\{\{anrede\}\}/g, lead.anrede)
            .replace(/\{\{vorname\}\}/g, lead.vorname)
            .replace(/\{\{nachname\}\}/g, lead.nachname)
            .replace(/\{\{email\}\}/g, lead.email)
            .replace(/\{\{firmenname\}\}/g, lead.firmenname)
            .replace(/\{\{var1\}\}/g, lead.var1 ?? '')
            .replace(/\{\{var2\}\}/g, lead.var2 ?? '')
            .replace(/\{\{var3\}\}/g, lead.var3 ?? '')
            .replace(/<p>/gi, '<p style="margin:0;padding:0;">')
            .replace(/<p style="margin:0;padding:0;"><\/p>/gi, '<p style="margin:0;padding:0;"><br></p>')

          const event = {
            subject: personalizedSubject,
            body: { contentType: 'HTML', content: personalizedBody },
            start: { dateTime: toBerlinDateTime(slotStart), timeZone: 'Europe/Berlin' },
            end: { dateTime: toBerlinDateTime(slotEnd), timeZone: 'Europe/Berlin' },
            location: { displayName: 'Online (Teams Meeting)' },
            attendees: [{ emailAddress: { address: lead.email, name: `${lead.vorname} ${lead.nachname}` }, type: 'required' }],
            isOnlineMeeting: true,
            onlineMeetingProvider: 'teamsForBusiness',
            showAs: 'busy',
          }

          const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
          })

          if (!response.ok) throw new Error((await response.text()) || 'Graph-Fehler')

          const created = await response.json()
          sentInvitations.push({ eventId: created.id, leadEmail: lead.email, leadName: `${lead.vorname} ${lead.nachname}`, slotStart, slotEnd })
          results.push({ id: lead.id, email: lead.email, status: 'success', message: 'Einladung versendet' })
        } catch (err) {
          results.push({ id: lead.id, email: lead.email, status: 'failed', message: (err as Error).message })
        }

        sent++
        controller.enqueue(emit({ type: 'progress', sent, total }))

        if (index < meetingLeads.length - 1) {
          const delayMs = (7 + Math.random() * 5) * 1000
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }

      const overflowMessage = domainLimitReached
        ? `Domain-Sendelimit erreicht (max. ${domainLimit!.sendLimit} Termine für ${userDomain})`
        : 'Kein Termin-Slot mehr verfügbar'

      for (const overflowLead of overflowLeads) {
        results.push({ id: overflowLead.id, email: overflowLead.email, status: 'failed', message: overflowMessage })
        sent++
        controller.enqueue(emit({ type: 'progress', sent, total }))
      }

      for (const lead of blacklistedLeads) {
        const leadDomain = lead.email.split('@')[1] ?? ''
        results.push({ id: lead.id, email: lead.email, status: 'failed', message: `Domain gesperrt (Blacklist): ${leadDomain}` })
        sent++
        controller.enqueue(emit({ type: 'progress', sent, total }))
      }

      const successCount = results.filter((r) => r.status === 'success').length
      const failedCount = results.filter((r) => r.status === 'failed').length

      await prisma.sendLog.create({
        data: {
          userEmail: session.user?.email ?? 'unbekannt',
          totalLeads: leads.length,
          successCount,
          failedCount,
          subject: eventSubject,
          eventBody,
          signature,
          invitations: { create: sentInvitations },
        },
      }).catch(() => {})

      controller.enqueue(emit({ type: 'done', results }))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
