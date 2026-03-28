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

export default function AdminPanel({
  userStats: initialStats,
  blacklist: initialBlacklist,
}: {
  userStats: UserStat[]
  blacklist: BlacklistEntry[]
}) {
  const [blacklist, setBlacklist] = useState(initialBlacklist)
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")

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
    </div>
  )
}
