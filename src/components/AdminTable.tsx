"use client"

import { useState, useEffect, useRef } from "react"

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
  sentAt: Date
  totalLeads: number
  successCount: number
  failedCount: number
  acceptedCount: number | null
  declinedCount: number | null
  tentativeCount: number | null
  subject: string | null
  eventBody: string | null
  signature: string | null
  invitations: Invitation[]
}

const responseLabel = (r: string) => {
  if (r === "accepted") return { label: "Angenommen", color: "text-green-400" }
  if (r === "declined") return { label: "Abgelehnt", color: "text-red-400" }
  if (r === "tentativelyAccepted") return { label: "Vorläufig", color: "text-yellow-400" }
  if (r === "unknown") return { label: "Unbekannt", color: "text-gray-500" }
  return { label: "Keine Reaktion", color: "text-gray-400" }
}

export default function AdminTable({ logs: initialLogs, currentUserEmail }: { logs: Log[]; currentUserEmail: string }) {
  const [logs, setLogs] = useState<Log[]>(initialLogs)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [messagePopup, setMessagePopup] = useState<Log | null>(null)

  const didAutoRefresh = useRef(false)
  const searchTerm = search.trim().toLowerCase()
  const userSearchTerm = userSearch.trim().toLowerCase()
  const isFiltering = !!searchTerm || !!statusFilter || !!userSearchTerm

  const matchesInv = (inv: Invitation) => {
    const emailOk = !searchTerm || inv.leadEmail.toLowerCase().includes(searchTerm)
    const invResponse = inv.response === 'none' ? 'notResponded' : inv.response
    const statusOk = !statusFilter || invResponse === statusFilter
    return emailOk && statusOk
  }

  const filteredLogs = isFiltering
    ? logs.filter((l) => {
        const userOk = !userSearchTerm || l.userEmail.toLowerCase().includes(userSearchTerm)
        if (!userOk) return false
        // Runs ohne Einladungsdaten: nur anzeigen wenn kein Email-Filter aktiv
        if (l.invitations.length === 0) return !searchTerm
        return l.invitations.some(matchesInv)
      })
    : logs

  const toggleExpand = (id: number) => {
    if (isFiltering) {
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    } else {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }
  }

  const refreshAll: () => Promise<void> = async () => {
    const now = new Date()
    const ownLogs = logs.filter((l) => {
      if (l.userEmail !== currentUserEmail) return false
      // Skip runs where every slot lies in the past
      if (l.invitations.length === 0) return true
      return l.invitations.some((inv) => inv.slotStart && new Date(inv.slotStart) >= now)
    })
    if (ownLogs.length === 0) return
    setRefreshing(true)
    try {
      // Sequential to avoid Microsoft Graph MailboxConcurrency throttling
      for (const log of ownLogs) {
        const result = await fetch("/api/admin/refresh-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logId: log.id }),
        }).then((r) => r.json())

        if (result.log) {
          setLogs((prev) => prev.map((l) =>
            l.id === result.log.id
              ? { ...l, acceptedCount: result.log.acceptedCount, declinedCount: result.log.declinedCount, tentativeCount: result.log.tentativeCount, invitations: result.invitations }
              : l
          ))
        }
      }
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (didAutoRefresh.current) return
    didAutoRefresh.current = true
    refreshAll()
  })

  if (logs.length === 0) {
    return <p className="text-gray-400 p-6">Noch keine Versendungen protokolliert.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <p className="text-gray-500 text-xs whitespace-nowrap">Status aktualisieren gilt nur für eigene Versendungen.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Nach User-E-Mail suchen…"
            value={userSearch}
            onChange={(e) => { setUserSearch(e.target.value); setCollapsed(new Set()) }}
            className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-56"
          />
          <input
            type="text"
            placeholder="Nach Empfänger-E-Mail suchen…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCollapsed(new Set()) }}
            className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCollapsed(new Set()) }}
            className="rounded-xl bg-gray-800 border border-white/10 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Alle Stati</option>
            <option value="accepted">Angenommen</option>
            <option value="declined">Abgelehnt</option>
            <option value="tentativelyAccepted">Vorläufig</option>
            <option value="notResponded">Keine Reaktion</option>
            <option value="unknown">Unbekannt</option>
          </select>
          <button
            onClick={refreshAll}
            disabled={refreshing || logs.every(l => l.userEmail !== currentUserEmail)}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-white text-sm font-medium disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {refreshing ? "Aktualisiert…" : "↻ Status aktualisieren"}
          </button>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="bg-white/10 text-gray-300">
              <th className="px-4 py-3 font-medium w-6"></th>
              <th className="px-4 py-3 font-medium">Zeitpunkt</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium text-right">Leads</th>
              <th className="px-4 py-3 font-medium text-right">Versendet</th>
              <th className="px-4 py-3 font-medium text-right">Fehler</th>
              <th className="px-4 py-3 font-medium text-right text-green-400">Angenommen</th>
              <th className="px-4 py-3 font-medium text-right text-red-400">Abgelehnt</th>
              <th className="px-4 py-3 font-medium text-right text-yellow-400">Vorläufig</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => {
              const isExpanded = isFiltering ? !collapsed.has(log.id) : expanded.has(log.id)
              const visibleInvitations = isFiltering
                ? log.invitations.filter(matchesInv)
                : log.invitations
              return (
                <>
                  <tr
                    key={log.id}
                    className="border-t border-white/5 text-gray-300 odd:bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <td className="px-4 py-3 text-gray-500 text-xs">{isExpanded ? "▼" : "▶"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(log.sentAt).toLocaleString("de-DE")}</td>
                    <td className="px-4 py-3">{log.userEmail}</td>
                    <td className="px-4 py-3 text-right">{log.totalLeads}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-medium">{log.successCount}</td>
                    <td className="px-4 py-3 text-right text-red-400">{log.failedCount}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-medium">
                      {log.acceptedCount ?? "–"}
                      {log.acceptedCount != null && log.successCount > 0 && (
                        <span className="ml-1.5 text-green-600 font-normal">
                          ({Math.round((log.acceptedCount / log.successCount) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-red-400 font-medium">
                      {log.declinedCount ?? "–"}
                      {log.declinedCount != null && log.successCount > 0 && (
                        <span className="ml-1.5 text-red-600 font-normal">
                          ({Math.round((log.declinedCount / log.successCount) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400">{log.tentativeCount ?? "–"}</td>
                    <td className="px-4 py-3 text-right">
                      {log.subject && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMessagePopup(log) }}
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          title="Nachricht anzeigen"
                        >
                          ✉
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${log.id}-detail`} className="border-t border-white/5">
                      <td colSpan={9} className="px-6 py-4 bg-white/5">
                        {log.invitations.length === 0 ? (
                          <p className="text-gray-500 text-xs">Keine Einzel-Daten verfügbar (ältere Versendung).</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-400 text-xs">
                                <th className="text-left pb-2 font-medium">Name</th>
                                <th className="text-left pb-2 font-medium">E-Mail</th>
                                <th className="text-left pb-2 font-medium">Termin</th>
                                <th className="text-left pb-2 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleInvitations.map((inv) => {
                                const { label, color } = responseLabel(inv.response)
                                const slot = inv.slotStart && inv.slotEnd
                                  ? `${new Date(inv.slotStart).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} – ${new Date(inv.slotEnd).toLocaleTimeString('de-DE', { timeStyle: 'short' })}`
                                  : '–'
                                return (
                                  <tr key={inv.id} className="border-t border-white/5">
                                    <td className="py-1.5 pr-4 text-gray-300">{inv.leadName}</td>
                                    <td className="py-1.5 pr-4 text-gray-400">{inv.leadEmail}</td>
                                    <td className="py-1.5 pr-4 text-gray-300 whitespace-nowrap">{slot}</td>
                                    <td className={`py-1.5 font-medium ${color}`}>{label}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}

                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Message Popup */}
      {messagePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setMessagePopup(null)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-bold text-lg">Versendete Nachricht</h2>
              <button onClick={() => setMessagePopup(null)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Betreff</p>
                <p className="text-white font-medium">{messagePopup.subject}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Nachricht</p>
                <div
                  className="bg-white rounded-xl p-4 text-gray-900 text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: messagePopup.eventBody ?? '' }}
                />
              </div>
              {messagePopup.signature && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Signatur</p>
                  <div
                    className="bg-white rounded-xl p-4 text-gray-900 text-sm"
                    dangerouslySetInnerHTML={{ __html: messagePopup.signature }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
