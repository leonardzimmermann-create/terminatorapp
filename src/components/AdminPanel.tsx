"use client"

import { useState } from "react"

type UserStat = {
  email: string
  userName: string | null
  domain: string
  firstLogin: Date
  lastLogin: Date
  count: number
}

type BlacklistEntry = {
  id: number
  email: string
  createdAt: Date
}

type DomainLimit = {
  id: number
  domain: string
  sendLimit: number
  sentCount: number
  sharepointBlacklistUrl: string | null
  createdAt: Date
}

export default function AdminPanel({
  userStats: initialStats,
  blacklist: initialBlacklist,
  domainLimits: initialDomainLimits,
}: {
  userStats: UserStat[]
  blacklist: BlacklistEntry[]
  domainLimits: DomainLimit[]
}) {
  const [blacklist, setBlacklist] = useState(initialBlacklist)
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")

  const [domainLimits, setDomainLimits] = useState(initialDomainLimits)
  const [newDomain, setNewDomain] = useState("")
  const [newLimit, setNewLimit] = useState(100)
  const [addingDomain, setAddingDomain] = useState(false)
  const [domainError, setDomainError] = useState("")
  const [editingUrl, setEditingUrl] = useState<Record<string, string>>({})
  const [savingUrl, setSavingUrl] = useState<Record<string, boolean>>({})

  const isBlocked = (email: string) => blacklist.some((w) => w.email === email)

  const blockEmail = async (email: string) => {
    setAdding(true)
    setError("")
    const res = await fetch("/api/admin/whitelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      const entry = await res.json()
      setBlacklist((prev) => [entry, ...prev])
      setNewEmail("")
    } else {
      setError("Fehler beim Sperren")
    }
    setAdding(false)
  }

  const unblockEmail = async (email: string) => {
    const res = await fetch("/api/admin/whitelist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      setBlacklist((prev) => prev.filter((w) => w.email !== email))
    }
  }

  const addDomainLimit = async () => {
    setAddingDomain(true)
    setDomainError("")
    const res = await fetch("/api/admin/domain-limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: newDomain.trim().toLowerCase(), sendLimit: newLimit }),
    })
    if (res.ok) {
      const entry: DomainLimit = await res.json()
      setDomainLimits((prev) => {
        const existing = prev.findIndex((d) => d.domain === entry.domain)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = entry
          return updated
        }
        return [...prev, entry].sort((a, b) => a.domain.localeCompare(b.domain))
      })
      setNewDomain("")
      setNewLimit(100)
    } else {
      setDomainError("Fehler beim Speichern")
    }
    setAddingDomain(false)
  }

  const deleteDomainLimit = async (domain: string) => {
    const res = await fetch("/api/admin/domain-limits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    })
    if (res.ok) {
      setDomainLimits((prev) => prev.filter((d) => d.domain !== domain))
    }
  }

  const saveSharepointUrl = async (domain: string) => {
    setSavingUrl((prev) => ({ ...prev, [domain]: true }))
    const url = editingUrl[domain] ?? ""
    const res = await fetch("/api/admin/domain-limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, sharepointBlacklistUrl: url.trim() || null }),
    })
    if (res.ok) {
      setDomainLimits((prev) =>
        prev.map((d) => d.domain === domain ? { ...d, sharepointBlacklistUrl: url.trim() || null } : d)
      )
    }
    setSavingUrl((prev) => ({ ...prev, [domain]: false }))
  }

  const fmt = (d: Date) =>
    new Date(d).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })

  return (
    <div className="space-y-10">
      {/* Login-Statistiken */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4">User-Logins</h2>
        {initialStats.length === 0 ? (
          <p className="text-gray-500 text-sm">Noch keine Logins erfasst.</p>
        ) : (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-white/10 text-gray-300">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">E-Mail</th>
                  <th className="px-4 py-3 font-medium">Kunde</th>
                  <th className="px-4 py-3 font-medium">Erstes Login</th>
                  <th className="px-4 py-3 font-medium">Letztes Login</th>
                  <th className="px-4 py-3 font-medium text-right">Logins</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {initialStats.map((u) => (
                  <tr key={u.email} className="border-t border-white/5 text-gray-300 odd:bg-white/5">
                    <td className="px-4 py-3">{u.userName ?? "–"}</td>
                    <td className="px-4 py-3 text-gray-400">{u.email}</td>
                    <td className="px-4 py-3 text-gray-400">{u.domain}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-400">{fmt(u.firstLogin)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(u.lastLogin)}</td>
                    <td className="px-4 py-3 text-right">{u.count}</td>
                    <td className="px-4 py-3 text-center">
                      {isBlocked(u.email) ? (
                        <button
                          onClick={() => unblockEmail(u.email)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-white/5 hover:text-gray-400 hover:border-white/10 transition-colors"
                        >
                          Gesperrt
                        </button>
                      ) : (
                        <button
                          onClick={() => blockEmail(u.email)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                        >
                          Sperren
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Blacklist manuell bearbeiten */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Blacklist</h2>
        <div className="flex gap-3 mb-4">
          <input
            type="email"
            placeholder="E-Mail-Adresse sperren…"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newEmail && blockEmail(newEmail)}
            className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-500 w-80"
          />
          <button
            onClick={() => newEmail && blockEmail(newEmail)}
            disabled={adding || !newEmail}
            className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {adding ? "…" : "Sperren"}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        {blacklist.length === 0 ? (
          <p className="text-gray-500 text-sm">Keine gesperrten User.</p>
        ) : (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-white/10 text-gray-300">
                  <th className="px-4 py-3 font-medium">E-Mail</th>
                  <th className="px-4 py-3 font-medium">Gesperrt seit</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map((w) => (
                  <tr key={w.email} className="border-t border-white/5 text-gray-300 odd:bg-white/5">
                    <td className="px-4 py-3">{w.email}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(w.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => unblockEmail(w.email)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-green-600/20 hover:text-green-400 hover:border-green-500/30 transition-colors"
                      >
                        Entsperren
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Domain-Sendelimits */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Domain-Sendelimits</h2>
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Domain</label>
            <input
              type="text"
              placeholder="z.B. kunde.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newDomain && addDomainLimit()}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Max. Termine</label>
            <input
              type="number"
              min={1}
              value={newLimit}
              onChange={(e) => setNewLimit(Number(e.target.value))}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 w-32"
            />
          </div>
          <button
            onClick={addDomainLimit}
            disabled={addingDomain || !newDomain}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {addingDomain ? "…" : "Hinzufügen"}
          </button>
        </div>
        {domainError && <p className="text-red-400 text-xs mb-3">{domainError}</p>}
        {domainLimits.length === 0 ? (
          <p className="text-gray-500 text-sm">Keine Domain-Limits konfiguriert.</p>
        ) : (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-white/10 text-gray-300">
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium text-right">Limit</th>
                  <th className="px-4 py-3 font-medium text-right">Versendet</th>
                  <th className="px-4 py-3 font-medium text-right">Verbleibend</th>
                  <th className="px-4 py-3 font-medium">Blacklist SharePoint-Link</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {domainLimits.map((d) => {
                  const remaining = d.sendLimit - d.sentCount
                  const pct = Math.min(100, Math.round((d.sentCount / d.sendLimit) * 100))
                  return (
                    <tr key={d.domain} className="border-t border-white/5 text-gray-300 odd:bg-white/5">
                      <td className="px-4 py-3 font-mono">{d.domain}</td>
                      <td className="px-4 py-3 text-right">{d.sendLimit}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={d.sentCount >= d.sendLimit ? "text-red-400 font-semibold" : ""}>
                          {d.sentCount}
                        </span>
                        <div className="mt-1 h-1 w-16 bg-white/10 rounded-full ml-auto">
                          <div
                            className={`h-1 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-400" : "bg-blue-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${remaining <= 0 ? "text-red-400" : remaining < 10 ? "text-orange-400" : "text-green-400"}`}>
                        {remaining <= 0 ? "Limit erreicht" : remaining}
                      </td>
                      <td className="px-4 py-3 min-w-[280px]">
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            placeholder="https://..."
                            value={editingUrl[d.domain] ?? (d.sharepointBlacklistUrl || "")}
                            onChange={(e) => setEditingUrl((prev) => ({ ...prev, [d.domain]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && saveSharepointUrl(d.domain)}
                            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 min-w-0"
                          />
                          <button
                            onClick={() => saveSharepointUrl(d.domain)}
                            disabled={savingUrl[d.domain]}
                            className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 disabled:opacity-40 transition-colors"
                          >
                            {savingUrl[d.domain] ? "…" : "Speichern"}
                          </button>
                        </div>
                        {d.sharepointBlacklistUrl && !(editingUrl[d.domain] !== undefined && editingUrl[d.domain] !== d.sharepointBlacklistUrl) && (
                          <p className="text-xs text-green-400 mt-1">✓ Link hinterlegt</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteDomainLimit(d.domain)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                        >
                          Entfernen
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
