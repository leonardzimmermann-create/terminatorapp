"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, LabelList, XAxis, YAxis, Legend, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Tooltip } from "recharts"

type LogStat = {
  userEmail: string
  sentAt: Date | string
  successCount: number
  acceptedCount: number | null
  declinedCount: number | null
  tentativeCount: number | null
}

const DOMAIN_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#f97316","#ec4899","#14b8a6","#a855f7",
]

type TooltipProps = { active?: boolean; payload?: { dataKey: string; value: number; fill: string }[]; label?: string }
const BarTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: { value: number }) => s + (p.value ?? 0), 0)
  return (
    <div style={{ background: "#1f2937", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 14px", color: "#f3f4f6", fontSize: 12 }}>
      <p style={{ margin: "0 0 6px", color: "#9ca3af" }}>{label}</p>
      {payload.map((p: { dataKey: string; value: number; fill: string }) => (
        <p key={p.dataKey} style={{ margin: "2px 0" }}>
          <span style={{ color: p.fill }}>■ </span>{p.dataKey}: <strong>{p.value}</strong>
        </p>
      ))}
      {payload.length > 1 && (
        <p style={{ margin: "6px 0 0", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6, color: "#9ca3af" }}>
          Gesamt: <strong style={{ color: "#f3f4f6" }}>{total}</strong>
        </p>
      )}
    </div>
  )
}


export default function SendCharts({ logs, isAdmin }: { logs: LogStat[]; isAdmin: boolean }) {
  const allDomains = useMemo(
    () => Array.from(new Set(logs.map((l) => l.userEmail.split("@")[1] ?? ""))).sort(),
    [logs]
  )

  const [domainFilter, setDomainFilter] = useState("")

  const filteredLogs = domainFilter
    ? logs.filter((l) => l.userEmail.split("@")[1] === domainFilter)
    : logs

  const { chartData, chartKeys } = useMemo(() => {
    if (!domainFilter) {
      const monthDomainMap = new Map<string, Map<string, number>>()
      for (const log of filteredLogs) {
        const month = new Date(log.sentAt).toISOString().slice(0, 7)
        const domain = log.userEmail.split("@")[1] ?? ""
        if (!monthDomainMap.has(month)) monthDomainMap.set(month, new Map())
        const dm = monthDomainMap.get(month)!
        dm.set(domain, (dm.get(domain) ?? 0) + log.successCount)
      }
      const keys = Array.from(new Set(filteredLogs.map((l) => l.userEmail.split("@")[1] ?? ""))).sort()
      const data = Array.from(monthDomainMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, dm]) => {
          const entry: Record<string, string | number> = { month }
          let rowTotal = 0
          for (const k of keys) { const v = dm.get(k) ?? 0; entry[k] = v; rowTotal += v }
          entry._total = rowTotal
          return entry
        })
      return { chartData: data, chartKeys: keys }
    } else {
      const users = Array.from(new Set(filteredLogs.map((l) => l.userEmail))).sort()
      const monthUserMap = new Map<string, Map<string, number>>()
      for (const log of filteredLogs) {
        const month = new Date(log.sentAt).toISOString().slice(0, 7)
        if (!monthUserMap.has(month)) monthUserMap.set(month, new Map())
        const um = monthUserMap.get(month)!
        um.set(log.userEmail, (um.get(log.userEmail) ?? 0) + log.successCount)
      }
      const data = Array.from(monthUserMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, um]) => {
          const entry: Record<string, string | number> = { month }
          let rowTotal = 0
          for (const u of users) { const v = um.get(u) ?? 0; entry[u] = v; rowTotal += v }
          entry._total = rowTotal
          return entry
        })
      return { chartData: data, chartKeys: users }
    }
  }, [filteredLogs, domainFilter])

  const pieData = useMemo(() => {
    let accepted = 0, declined = 0, tentative = 0, total = 0
    for (const l of filteredLogs) {
      total += l.successCount
      accepted += l.acceptedCount ?? 0
      declined += l.declinedCount ?? 0
      tentative += l.tentativeCount ?? 0
    }
    const noReaction = Math.max(0, total - accepted - declined - tentative)
    return [
      { name: "Angenommen", value: accepted, color: "#10b981" },
      { name: "Abgelehnt", value: declined, color: "#ef4444" },
      { name: "Vorläufig", value: tentative, color: "#f59e0b" },
      { name: "Keine Reaktion", value: noReaction, color: "#6b7280" },
    ].filter((d) => d.value > 0)
  }, [filteredLogs])

  if (logs.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-white">Auswertung</h2>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Kunde:</label>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-xl bg-gray-800 border border-white/10 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="">Alle Kunden</option>
              {allDomains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-6 items-stretch">
        {/* Bar Chart */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-3">
            {domainFilter ? `Termine pro User – ${domainFilter}` : "Versendete Termine pro Monat"}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} wrapperStyle={{ zIndex: 9999 }} />
              <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12, paddingTop: 12 }} />
              {chartKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]}
                  radius={i === chartKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                >
                  {i === chartKeys.length - 1 && (
                    <LabelList dataKey="_total" position="top" style={{ fill: "#d1d5db", fontSize: 11, fontWeight: 500 }} />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 w-96 flex-shrink-0">
          <p className="text-xs text-gray-400 mb-3">
            Terminantworten{domainFilter ? ` – ${domainFilter}` : ""}
          </p>
          {pieData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10">Noch keine Statusdaten vorhanden.</p>
          ) : (
            <div className="flex items-center gap-3">
              <PieChart width={230} height={230}>
                <Pie data={pieData} cx={115} cy={115} innerRadius={60} outerRadius={105} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#f3f4f6" }}
                  wrapperStyle={{ opacity: 1 }}
                  formatter={(value: number) => [`${value} Termine`, ""]}
                />
              </PieChart>
              <div className="flex flex-col gap-2 flex-1">
                {pieData.map((entry) => {
                  const total = pieData.reduce((s, d) => s + d.value, 0)
                  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
                  return (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-gray-300 flex-1">{entry.name}</span>
                      <span className="text-xs font-semibold text-white">{entry.value}</span>
                      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
                <div className="border-t border-white/10 pt-2 mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex-1">Gesamt</span>
                  <span className="text-xs font-semibold text-white">{pieData.reduce((s, d) => s + d.value, 0)}</span>
                  <span className="w-8" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
