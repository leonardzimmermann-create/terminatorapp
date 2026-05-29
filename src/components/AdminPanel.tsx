"use client"

import { useState, useRef, useEffect } from "react"
import { useLanguage } from "@/components/LanguageProvider"
import { t, type Lang } from "@/lib/i18n"

type UserStat = {
  email: string
  userName: string | null
  domain: string
  firstLogin: Date
  lastLogin: Date
  count: number
}

type UserRoleEntry = {
  id: number
  email: string
  role: string
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
  userLimit: number | null
  resetIntervalMonths: number
  sentCount: number
  blacklistCount: number
  userCount: number
  createdAt: Date
}

function RoleDropdown({ email, role, saving, onChange, lang }: { email: string; role: string; saving: boolean; onChange: (role: string) => void; lang: Lang }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  const isAdmin = role === "user_admin"
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors disabled:opacity-50 ${
          isAdmin
            ? "bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30"
            : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
        }`}
      >
        {saving ? "…" : isAdmin ? t("role_user_admin", lang) : t("role_user", lang)}
        <svg className="w-3 h-3 opacity-60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-1/2 -translate-x-1/2 w-36 rounded-xl bg-[#1a1f2e] border border-white/10 shadow-2xl overflow-hidden">
          {[{ value: "user", label: t("role_user", lang) }, { value: "user_admin", label: t("role_user_admin", lang) }].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                role === opt.value
                  ? "bg-blue-600/20 text-blue-300 font-medium"
                  : "text-gray-300 hover:bg-white/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminPanel({
  userStats: initialStats,
  blacklist: initialBlacklist,
  domainLimits: initialDomainLimits,
  userRoles: initialUserRoles,
}: {
  userStats: UserStat[]
  blacklist: BlacklistEntry[]
  domainLimits: DomainLimit[]
  userRoles: UserRoleEntry[]
}) {
  const { lang } = useLanguage()

  const [blacklist, setBlacklist] = useState(initialBlacklist)
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")

  const [domainFilter, setDomainFilter] = useState("")
  const [domainSearch, setDomainSearch] = useState("")
  const [domainDropdownOpen, setDomainDropdownOpen] = useState(false)
  const domainDropdownRef = useRef<HTMLDivElement>(null)

  const [limitsFilter, setLimitsFilter] = useState("")
  const [limitsSearch, setLimitsSearch] = useState("")
  const [limitsDropdownOpen, setLimitsDropdownOpen] = useState(false)
  const limitsDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (domainDropdownRef.current && !domainDropdownRef.current.contains(e.target as Node)) {
        setDomainDropdownOpen(false)
      }
      if (limitsDropdownRef.current && !limitsDropdownRef.current.contains(e.target as Node)) {
        setLimitsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const [domainLimits, setDomainLimits] = useState(initialDomainLimits)
  const [newDomain, setNewDomain] = useState("")
  const [newLimit, setNewLimit] = useState(100)
  const [newUserLimit, setNewUserLimit] = useState<number | "">("")
  const [newResetInterval, setNewResetInterval] = useState(1)
  const [addingDomain, setAddingDomain] = useState(false)
  const [domainError, setDomainError] = useState("")

  // Inline editing state: domain → { sendLimit, userLimit, resetIntervalMonths }
  const [edits, setEdits] = useState<Record<string, { sendLimit: string; userLimit: string; resetIntervalMonths: string }>>({})
  const editsRef = useRef(edits)
  editsRef.current = edits
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const getEdit = (domain: string, field: "sendLimit" | "userLimit" | "resetIntervalMonths", fallback: number | null) =>
    edits[domain]?.[field] ?? (fallback != null ? String(fallback) : "")

  const setEdit = (domain: string, field: "sendLimit" | "userLimit" | "resetIntervalMonths", value: string) =>
    setEdits((prev) => ({ ...prev, [domain]: { ...prev[domain], [field]: value } }))

  const saveRow = async (domain: string, currentSendLimit: number, currentUserLimit: number | null, currentResetIntervalMonths: number) => {
    const currentEdits = editsRef.current
    if (!currentEdits[domain]) return
    const sendLimitStr = currentEdits[domain]?.sendLimit
    const userLimitStr = currentEdits[domain]?.userLimit
    const resetIntervalStr = currentEdits[domain]?.resetIntervalMonths
    const sendLimit = sendLimitStr !== undefined ? Number(sendLimitStr) : currentSendLimit
    const userLimit = userLimitStr !== undefined ? (userLimitStr === "" ? null : Number(userLimitStr)) : currentUserLimit
    const resetIntervalMonths = resetIntervalStr !== undefined
      ? Math.max(1, Number(resetIntervalStr) || 1)
      : currentResetIntervalMonths
    if (!Number.isFinite(sendLimit) || sendLimit < 1) return
    setSaving((prev) => ({ ...prev, [domain]: true }))
    const res = await fetch("/api/admin/domain-limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, sendLimit, userLimit, resetIntervalMonths }),
    })
    if (res.ok) {
      const entry: DomainLimit = await res.json()
      setDomainLimits((prev) => prev.map((d) => d.domain === domain ? entry : d))
      setEdits((prev) => { const next = { ...prev }; delete next[domain]; return next })
    }
    setSaving((prev) => ({ ...prev, [domain]: false }))
  }

  const [userRoles, setUserRoles] = useState<UserRoleEntry[]>(initialUserRoles)
  const [savingRole, setSavingRole] = useState<Record<string, boolean>>({})

  const getRole = (email: string) => userRoles.find((r) => r.email === email)?.role ?? "user"

  const setRole = async (email: string, role: string) => {
    setSavingRole((prev) => ({ ...prev, [email]: true }))
    const res = await fetch("/api/admin/user-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    })
    if (res.ok) {
      const entry: UserRoleEntry = await res.json()
      setUserRoles((prev) => {
        const idx = prev.findIndex((r) => r.email === email)
        if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next }
        return [...prev, entry]
      })
    }
    setSavingRole((prev) => ({ ...prev, [email]: false }))
  }

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
      setError(t("block_error", lang))
    }
    setAdding(false)
  }

  const unblockEmail = async (email: string) => {
    const res = await fetch("/api/admin/whitelist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (res.ok) setBlacklist((prev) => prev.filter((w) => w.email !== email))
  }

  const addDomainLimit = async () => {
    setAddingDomain(true)
    setDomainError("")
    const res = await fetch("/api/admin/domain-limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: newDomain.trim().toLowerCase(),
        sendLimit: newLimit,
        userLimit: newUserLimit === "" ? null : newUserLimit,
        resetIntervalMonths: Math.max(1, newResetInterval || 1),
      }),
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
      setNewUserLimit("")
      setNewResetInterval(1)
    } else {
      setDomainError(t("error", lang))
    }
    setAddingDomain(false)
  }

  const deleteDomainLimit = async (domain: string) => {
    const res = await fetch("/api/admin/domain-limits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    })
    if (res.ok) setDomainLimits((prev) => prev.filter((d) => d.domain !== domain))
  }

  const fmt = (d: Date) =>
    new Date(d).toLocaleString(lang === "de" ? "de-DE" : "en-GB", { dateStyle: "short", timeStyle: "short" })

  return (
    <div className="space-y-10 mt-6">
      {/* Domain-Sendelimits – zuerst */}
      <section>
        <h2 className="text-lg font-bold text-white mb-1">{t("domain_limits", lang)}</h2>
        <p className="text-xs text-gray-500 mb-4">{t("domain_limits_hint", lang)}</p>
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">{t("domain", lang)}</label>
            <input type="text" placeholder="z.B. kunde.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newDomain && addDomainLimit()} className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-52" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">{t("max_per_month", lang)}</label>
            <input type="number" min={1} value={newLimit} onChange={(e) => setNewLimit(Number(e.target.value))} className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">{t("max_seats", lang)}</label>
            <input type="number" min={1} value={newUserLimit} onChange={(e) => setNewUserLimit(e.target.value === "" ? "" : Number(e.target.value))} placeholder="–" className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">{t("reset_interval_months", lang)}</label>
            <input type="number" min={1} value={newResetInterval} onChange={(e) => setNewResetInterval(Math.max(1, Number(e.target.value) || 1))} className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 w-28" />
          </div>
          <button onClick={addDomainLimit} disabled={addingDomain || !newDomain} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-white text-sm font-medium disabled:opacity-40 transition-colors">
            {addingDomain ? "…" : t("add", lang)}
          </button>
          <div ref={limitsDropdownRef} className="relative w-56 ml-auto">
            <button
              type="button"
              onClick={() => { setLimitsDropdownOpen((o) => !o); setLimitsSearch("") }}
              className="w-full flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-300 focus:outline-none hover:border-white/20"
            >
              <span className={limitsFilter ? "text-white" : "text-gray-500"}>{limitsFilter || t("all_domains", lang)}</span>
              <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {limitsDropdownOpen && (
              <div className="absolute z-20 mt-1 right-0 w-full rounded-xl bg-[#1a1f2e] border border-white/10 shadow-2xl overflow-hidden">
                <div className="p-2 border-b border-white/10">
                  <input
                    autoFocus
                    type="text"
                    value={limitsSearch}
                    onChange={(e) => setLimitsSearch(e.target.value)}
                    placeholder={t("search", lang)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <ul className="max-h-52 overflow-y-auto py-1">
                  <li
                    onClick={() => { setLimitsFilter(""); setLimitsDropdownOpen(false) }}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${!limitsFilter ? "bg-blue-600/20 text-blue-300 font-medium" : "text-gray-300 hover:bg-white/5"}`}
                  >
                    {t("all_domains", lang)}
                  </li>
                  {domainLimits.map((d) => d.domain).sort().filter((d) => d.toLowerCase().includes(limitsSearch.toLowerCase())).map((d) => (
                    <li
                      key={d}
                      onClick={() => { setLimitsFilter(d); setLimitsDropdownOpen(false) }}
                      className={`px-3 py-2 text-sm cursor-pointer transition-colors ${limitsFilter === d ? "bg-blue-600/20 text-blue-300 font-medium" : "text-gray-300 hover:bg-white/5"}`}
                    >
                      {d}
                    </li>
                  ))}
                  {domainLimits.filter((d) => d.domain.toLowerCase().includes(limitsSearch.toLowerCase())).length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-500 italic">{t("no_results", lang)}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
        {domainError && <p className="text-red-400 text-xs mb-3">{domainError}</p>}
        {domainLimits.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("no_domain_limits", lang)}</p>
        ) : (
          <>
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-white/10 text-gray-300">
                  <th className="px-4 py-3 font-medium">{t("domain", lang)}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("col_per_month", lang)}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("col_interval", lang)}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("col_sent", lang)}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("col_remaining", lang)}</th>
                  <th className="px-4 py-3 font-medium text-center">{t("col_seats", lang)}</th>
                  <th className="px-4 py-3 font-medium text-center">{t("col_blacklist", lang)}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(limitsFilter ? domainLimits.filter((d) => d.domain === limitsFilter) : domainLimits).map((d) => {
                  const remaining = d.sendLimit - d.sentCount
                  const pct = Math.min(100, Math.round((d.sentCount / d.sendLimit) * 100))
                  const seatsFull = d.userLimit != null && d.userCount >= d.userLimit
                  return (
                    <tr key={d.domain} className="border-t border-white/5 text-gray-300 odd:bg-white/5">
                      <td className="px-4 py-3 font-mono">{d.domain}</td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" min={1} value={getEdit(d.domain, "sendLimit", d.sendLimit)} onChange={(e) => setEdit(d.domain, "sendLimit", e.target.value)} onBlur={() => saveRow(d.domain, d.sendLimit, d.userLimit, d.resetIntervalMonths)} onKeyDown={(e) => e.key === "Enter" && saveRow(d.domain, d.sendLimit, d.userLimit, d.resetIntervalMonths)} disabled={saving[d.domain]} className="w-20 text-right rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500 disabled:opacity-50" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" min={1} value={getEdit(d.domain, "resetIntervalMonths", d.resetIntervalMonths)} onChange={(e) => setEdit(d.domain, "resetIntervalMonths", e.target.value)} onBlur={() => saveRow(d.domain, d.sendLimit, d.userLimit, d.resetIntervalMonths)} onKeyDown={(e) => e.key === "Enter" && saveRow(d.domain, d.sendLimit, d.userLimit, d.resetIntervalMonths)} disabled={saving[d.domain]} className="w-16 text-right rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500 disabled:opacity-50" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={d.sentCount >= d.sendLimit ? "text-red-400 font-semibold" : ""}>{d.sentCount}</span>
                        <div className="mt-1 h-1 w-16 bg-white/10 rounded-full ml-auto">
                          <div className={`h-1 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-400" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${remaining <= 0 ? "text-red-400" : remaining < 10 ? "text-orange-400" : "text-green-400"}`}>
                        {remaining <= 0 ? t("limit_reached", lang) : remaining}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`text-xs font-medium ${seatsFull ? "text-red-400" : "text-gray-300"}`}>{d.userCount} /</span>
                          <input type="number" min={1} value={getEdit(d.domain, "userLimit", d.userLimit)} onChange={(e) => setEdit(d.domain, "userLimit", e.target.value)} onBlur={() => saveRow(d.domain, d.sendLimit, d.userLimit, d.resetIntervalMonths)} onKeyDown={(e) => e.key === "Enter" && saveRow(d.domain, d.sendLimit, d.userLimit, d.resetIntervalMonths)} disabled={saving[d.domain]} placeholder="∞" className="w-14 text-center rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.blacklistCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-green-600/20 text-green-400 border border-green-500/30 font-medium">{t("yes", lang)} ({d.blacklistCount})</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-500 border border-white/10">{t("no", lang)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => deleteDomainLimit(d.domain)} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/30 transition-colors">{t("remove", lang)}</button>
                          {edits[d.domain] && (
                            <button onClick={() => saveRow(d.domain, d.sendLimit, d.userLimit, d.resetIntervalMonths)} disabled={saving[d.domain]} className="text-xs px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                              {saving[d.domain] ? "…" : "Speichern"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      {/* Login-Statistiken */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-lg font-bold text-white">{t("user_logins", lang)}</h2>
          {initialStats.length > 0 && (() => {
            const allDomains = Array.from(new Set(initialStats.map((u) => u.domain))).sort()
            const filtered = allDomains.filter((d) => d.toLowerCase().includes(domainSearch.toLowerCase()))
            return (
              <div ref={domainDropdownRef} className="relative w-56">
                <button
                  type="button"
                  onClick={() => { setDomainDropdownOpen((o) => !o); setDomainSearch("") }}
                  className="w-full flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-300 focus:outline-none hover:border-white/20"
                >
                  <span className={domainFilter ? "text-white" : "text-gray-500"}>{domainFilter || t("all_customers", lang)}</span>
                  <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {domainDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl bg-[#1a1f2e] border border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-white/10">
                      <input
                        autoFocus
                        type="text"
                        value={domainSearch}
                        onChange={(e) => setDomainSearch(e.target.value)}
                        placeholder={t("search", lang)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <ul className="max-h-52 overflow-y-auto py-1">
                      <li
                        onClick={() => { setDomainFilter(""); setDomainDropdownOpen(false) }}
                        className={`px-3 py-2 text-sm cursor-pointer transition-colors ${!domainFilter ? "bg-blue-600/20 text-blue-300 font-medium" : "text-gray-300 hover:bg-white/5"}`}
                      >
                        {t("all_customers", lang)}
                      </li>
                      {filtered.map((d) => (
                        <li
                          key={d}
                          onClick={() => { setDomainFilter(d); setDomainDropdownOpen(false) }}
                          className={`px-3 py-2 text-sm cursor-pointer transition-colors ${domainFilter === d ? "bg-blue-600/20 text-blue-300 font-medium" : "text-gray-300 hover:bg-white/5"}`}
                        >
                          {d}
                        </li>
                      ))}
                      {filtered.length === 0 && <li className="px-3 py-2 text-sm text-gray-500 italic">{t("no_results", lang)}</li>}
                    </ul>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
        {initialStats.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("no_logins", lang)}</p>
        ) : (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-white/10 text-gray-300">
                  <th className="px-4 py-3 font-medium">{t("name", lang)}</th>
                  <th className="px-4 py-3 font-medium">{t("email", lang)}</th>
                  <th className="px-4 py-3 font-medium">{t("col_customer", lang)}</th>
                  <th className="px-4 py-3 font-medium">{t("col_first_login", lang)}</th>
                  <th className="px-4 py-3 font-medium">{t("col_last_login", lang)}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("col_logins", lang)}</th>
                  <th className="px-4 py-3 font-medium text-center">{t("col_role", lang)}</th>
                  <th className="px-4 py-3 font-medium text-center">{t("status", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {(domainFilter ? initialStats.filter((u) => u.domain === domainFilter) : initialStats).map((u) => (
                  <tr key={u.email} className="border-t border-white/5 text-gray-300 odd:bg-white/5">
                    <td className="px-4 py-3">{u.userName ?? "–"}</td>
                    <td className="px-4 py-3 text-gray-400">{u.email}</td>
                    <td className="px-4 py-3 text-gray-400">{u.domain}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-400">{fmt(u.firstLogin)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(u.lastLogin)}</td>
                    <td className="px-4 py-3 text-right">{u.count}</td>
                    <td className="px-4 py-3 text-center">
                      <RoleDropdown
                        email={u.email}
                        role={getRole(u.email)}
                        saving={!!savingRole[u.email]}
                        onChange={(role) => setRole(u.email, role)}
                        lang={lang}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isBlocked(u.email) ? (
                        <button onClick={() => unblockEmail(u.email)} className="text-xs px-2.5 py-1 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-white/5 hover:text-gray-400 hover:border-white/10 transition-colors">
                          {t("blocked", lang)}
                        </button>
                      ) : (
                        <button onClick={() => blockEmail(u.email)} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/30 transition-colors">
                          {t("block", lang)}
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
        <h2 className="text-lg font-bold text-white mb-4">{t("blacklist", lang)}</h2>
        <div className="flex gap-3 mb-4">
          <input
            type="email"
            placeholder={t("block_email_placeholder", lang)}
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
            {adding ? "…" : t("block", lang)}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        {blacklist.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("no_blocked_users", lang)}</p>
        ) : (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-white/10 text-gray-300">
                  <th className="px-4 py-3 font-medium">{t("email", lang)}</th>
                  <th className="px-4 py-3 font-medium">{t("col_blocked_since", lang)}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map((w) => (
                  <tr key={w.email} className="border-t border-white/5 text-gray-300 odd:bg-white/5">
                    <td className="px-4 py-3">{w.email}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(w.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => unblockEmail(w.email)} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-green-600/20 hover:text-green-400 hover:border-green-500/30 transition-colors">
                        {t("unblock", lang)}
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
