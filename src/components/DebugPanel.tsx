"use client"

import { Fragment, useState } from "react"

type Invitation = {
  id: number
  leadEmail: string
  leadName: string
  response: string
  slotStart: string | Date | null
  slotEnd: string | Date | null
}

type Log = {
  id: number
  userEmail: string
  sentAt: Date | string
  totalLeads: number
  successCount: number
  subject: string | null
  invitations: Invitation[]
}

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
  attendees: unknown
  raw: unknown
  error: string | null
}

type DebugResult = {
  logId: number
  subject: string | null
  sentAt: string
  userEmail: string
  events: EventDebug[]
}

const responseColor = (r: string) => {
  if (r === "accepted") return "text-green-400"
  if (r === "declined") return "text-red-400"
  if (r === "tentativelyAccepted") return "text-yellow-400"
  if (r === "unknown") return "text-gray-500"
  return "text-gray-400"
}

const fmt = (d: Date | string) =>
  new Date(d).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })

export default function DebugPanel({ logs }: { logs: Log[] }) {
  const [results, setResults] = useState<Record<number, DebugResult>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [rawOpen, setRawOpen] = useState<Set<number>>(new Set())

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleRaw = (id: number) =>
    setRawOpen((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const runDebug = async (logId: number) => {
    setLoading((p) => ({ ...p, [logId]: true }))
    setErrors((p) => { const n = { ...p }; delete n[logId]; return n })
    try {
      const res = await fetch("/api/admin/debug-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors((p) => ({ ...p, [logId]: data?.error || `HTTP ${res.status}` }))
      } else {
        setResults((p) => ({ ...p, [logId]: data }))
        setExpanded((prev) => new Set(prev).add(logId))
      }
    } catch (e) {
      setErrors((p) => ({ ...p, [logId]: (e as Error).message }))
    } finally {
      setLoading((p) => ({ ...p, [logId]: false }))
    }
  }

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-1">Debug: Termin-Status (Graph-Rohdaten)</h2>
      <p className="text-xs text-gray-500 mb-4">
        Nur deine eigenen Versendungen. Ruft pro Termin live <span className="font-mono">GET /me/events/&#123;id&#125;</span> ab und zeigt,
        was Microsoft Graph zurückgibt – ohne die Datenbank zu verändern. So lässt sich prüfen, warum ein Termin als
        &bdquo;Keine Reaktion&ldquo; erscheint (z.&nbsp;B. Adress-Abweichung oder tatsächlich <span className="font-mono">notResponded</span> in Graph).
      </p>

      {logs.length === 0 ? (
        <p className="text-gray-500 text-sm">Keine eigenen Versendungen vorhanden.</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const result = results[log.id]
            const isOpen = expanded.has(log.id)
            return (
              <div key={log.id} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{log.subject || "(kein Betreff)"}</div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      {fmt(log.sentAt)} · {log.successCount} Termine · {log.invitations.length} gespeichert
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        {isOpen ? "Einklappen" : "Anzeigen"}
                      </button>
                    )}
                    <button
                      onClick={() => runDebug(log.id)}
                      disabled={!!loading[log.id]}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-40 transition-colors"
                    >
                      {loading[log.id] ? "Lädt…" : result ? "Erneut abrufen" : "Debug-Refresh"}
                    </button>
                  </div>
                </div>

                {errors[log.id] && (
                  <div className="px-4 pb-3 text-xs text-red-400">{errors[log.id]}</div>
                )}

                {result && isOpen && (
                  <div className="border-t border-white/10 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="bg-white/10 text-gray-300">
                          <th className="px-3 py-2 font-medium">Lead</th>
                          <th className="px-3 py-2 font-medium">HTTP</th>
                          <th className="px-3 py-2 font-medium">Graph-Teilnehmer</th>
                          <th className="px-3 py-2 font-medium">Adresse&nbsp;ok?</th>
                          <th className="px-3 py-2 font-medium">Graph-Status</th>
                          <th className="px-3 py-2 font-medium">DB gespeichert</th>
                          <th className="px-3 py-2 font-medium">Rohdaten</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.events.map((ev) => {
                          const mismatch = ev.httpStatus === 200 && !ev.emailMatch
                          const drift = ev.interpretedResponse !== ev.storedResponse
                          return (
                            <Fragment key={ev.invitationId}>
                              <tr className={`border-t border-white/5 text-gray-300 ${mismatch ? "bg-red-900/20" : drift ? "bg-yellow-900/10" : "odd:bg-white/5"}`}>
                                <td className="px-3 py-2">
                                  <div className="text-gray-200">{ev.leadName}</div>
                                  <div className="text-gray-500 font-mono">{ev.leadEmail}</div>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={ev.httpStatus === 200 ? "text-green-400" : "text-red-400"}>
                                    {ev.httpStatus ?? "–"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-400">
                                  {ev.matchedAttendee ? ev.matchedAttendee.address : <span className="text-red-400">nicht gefunden</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {ev.httpStatus !== 200 ? (
                                    <span className="text-gray-500">–</span>
                                  ) : ev.emailMatch ? (
                                    <span className="text-green-400">✓</span>
                                  ) : (
                                    <span className="text-red-400 font-medium">Abweichung</span>
                                  )}
                                </td>
                                <td className={`px-3 py-2 font-medium ${responseColor(ev.interpretedResponse)}`}>
                                  {ev.matchedAttendee?.response || ev.interpretedResponse}
                                </td>
                                <td className={`px-3 py-2 ${responseColor(ev.storedResponse === "none" ? "notResponded" : ev.storedResponse)}`}>
                                  {ev.storedResponse}
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => toggleRaw(ev.invitationId)}
                                    className="text-blue-400 hover:text-blue-300 underline"
                                  >
                                    {rawOpen.has(ev.invitationId) ? "verbergen" : "JSON"}
                                  </button>
                                </td>
                              </tr>
                              {rawOpen.has(ev.invitationId) && (
                                <tr className="border-t border-white/5">
                                  <td colSpan={7} className="px-3 py-2 bg-black/30">
                                    <div className="text-gray-500 mb-1 font-mono">eventId: {ev.eventId}</div>
                                    {ev.error && <div className="text-red-400 mb-1">Fehler: {ev.error}</div>}
                                    <pre className="text-[11px] text-gray-300 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                                      {JSON.stringify(ev.raw, null, 2)}
                                    </pre>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                        {result.events.length === 0 && (
                          <tr><td colSpan={7} className="px-3 py-3 text-gray-500 italic">Keine gespeicherten Termine in dieser Versendung.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
