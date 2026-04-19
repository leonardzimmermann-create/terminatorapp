"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import RichTextEditor from "./RichTextEditor"
import * as XLSX from "xlsx"

const ADMIN_EMAILS = ["leonard.zimmermann@smartflow-consulting.com", "rolf.zimmermann@smartflow-consulting.com"]

function downloadLeadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Anrede", "Vorname", "Nachname", "Email", "Firmenname", "Variable 1", "Variable 2", "Variable 3"],
  ])
  ws["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Leads")
  XLSX.writeFile(wb, "Lead-Template.xlsx")
}

type Lead = {
  id: number
  anrede: string
  vorname: string
  nachname: string
  email: string
  firmenname: string
  var1?: string
  var2?: string
  var3?: string
  status?: "pending" | "success" | "failed"
  message?: string
}

type SendStatus = "idle" | "sending" | "success" | "failed"

const card = "bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4"
const label = "block mb-1 text-sm font-medium text-gray-300"
const input = "w-full bg-white/10 border border-white/20 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
const btnPrimary = "rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-white font-semibold text-sm transition-colors disabled:opacity-40"

export default function ProtectedArea() {
  const { data: session } = useSession()
  const isAdmin = !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email)
  const [leads, setLeads] = useState<Lead[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle")
  const [showConfirm, setShowConfirm] = useState(false)
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null)
  const [sendStartTime, setSendStartTime] = useState<number | null>(null)
  const [testEmail, setTestEmail] = useState<string>("")
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "success" | "failed">("idle")
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [signature, setSignature] = useState<string>("")
  const [sigSaveStatus, setSigSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  const [tmplSaveStatus, setTmplSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  const [aiAnalysis, setAiAnalysis] = useState<{ motivation: string; suggestions: string[] } | null>(null)
  const [checkedSuggestions, setCheckedSuggestions] = useState<boolean[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const resetAnalysis = () => { setAiAnalysis(null); setCheckedSuggestions([]) }
  const [templates, setTemplates] = useState<{ id: number; name: string; html: string; subject: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [templateName, setTemplateName] = useState<string>("")
  const [eventSubject, setEventSubject] = useState<string>("Hier Terminbetreff eingeben")

  const [windowStartDate, setWindowStartDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const [windowStartTime, setWindowStartTime] = useState<string>("09:00")
  const [windowEndDate, setWindowEndDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const [windowEndTime, setWindowEndTime] = useState<string>("12:00")
  const [durationMinutes, setDurationMinutes] = useState<number>(30)
  const [parallelCount, setParallelCount] = useState<number>(1)
  const [eventBody, setEventBody] = useState<string>("<p>Hallo {{vorname}},</p><p>ich möchte Sie zu einem Teams-Termin einladen.</p>")
  const [quota, setQuota] = useState<{ sentCount: number; sendLimit: number | null; remaining: number | null } | null>(null)

  useEffect(() => {
    fetch("/api/domain-quota")
      .then((r) => r.json())
      .then((d) => { if (d.sendLimit !== undefined) setQuota(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/signature")
      .then((r) => r.json())
      .then((d) => { if (d.html) setSignature(d.html) })
      .catch(() => {})
    fetch("/api/template")
      .then((r) => r.json())
      .then((d) => {
        if (d.templates?.length > 0) {
          setTemplates(d.templates)
          setSelectedTemplateId(d.templates[0].id)
          setTemplateName(d.templates[0].name)
          setEventBody(d.templates[0].html)
          if (d.templates[0].subject) setEventSubject(d.templates[0].subject)
        }
      })
      .catch(() => {})
  }, [])

  const saveTemplate = async () => {
    if (!templateName.trim()) { setTmplSaveStatus("failed"); setTimeout(() => setTmplSaveStatus("idle"), 2500); return }
    setTmplSaveStatus("saving")
    try {
      const r = await fetch("/api/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTemplateId, name: templateName.trim(), html: eventBody, subject: eventSubject }),
      })
      const data = await r.json()
      if (r.ok && data.template) {
        setTemplates((prev) => {
          const exists = prev.find((t) => t.id === data.template.id)
          if (exists) return prev.map((t) => t.id === data.template.id ? { ...t, ...data.template } : t)
          return [{ ...data.template, subject: data.template.subject ?? '' }, ...prev]
        })
        setSelectedTemplateId(data.template.id)
        setTmplSaveStatus("saved")
        analyzeText(eventBody)
      } else {
        setTmplSaveStatus("failed")
      }
    } catch {
      setTmplSaveStatus("failed")
    }
    setTimeout(() => setTmplSaveStatus("idle"), 2500)
  }

  const analyzeText = async (html: string) => {
    setAnalyzing(true)
    try {
      const r = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, subject: eventSubject }),
      })
      const data = await r.json()
      if (r.ok && data.suggestions) {
        setAiAnalysis(data)
        setCheckedSuggestions(new Array(data.suggestions.length).fill(false))
      }
    } catch {}
    setAnalyzing(false)
  }

  const deleteTemplate = async () => {
    if (!selectedTemplateId) return
    await fetch(`/api/template?id=${selectedTemplateId}`, { method: "DELETE" })
    const remaining = templates.filter((t) => t.id !== selectedTemplateId)
    setTemplates(remaining)
    if (remaining.length > 0) {
      setSelectedTemplateId(remaining[0].id)
      setTemplateName(remaining[0].name)
      setEventBody(remaining[0].html)
      if (remaining[0].subject) setEventSubject(remaining[0].subject)
    } else {
      setSelectedTemplateId(null)
      setTemplateName("")
      setEventBody("<p>Hallo {{vorname}},</p><p>ich möchte Sie zu einem Teams-Termin einladen.</p>")
      setEventSubject("Hier Terminbetreff eingeben")
    }
  }

  const saveSignature = async () => {
    setSigSaveStatus("saving")
    try {
      const r = await fetch("/api/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: signature }),
      })
      setSigSaveStatus(r.ok ? "saved" : "failed")
    } catch {
      setSigSaveStatus("failed")
    }
    setTimeout(() => setSigSaveStatus("idle"), 2500)
  }

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) { setError("Die CSV muss mindestens eine Datenzeile enthalten."); return }
    const delimiter = lines[0].includes(";") ? ";" : ","
    const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase())
    if (header.length < 5 || header[0] !== "anrede" || header[1] !== "vorname" || header[2] !== "nachname" || header[3] !== "email" || header[4] !== "firmenname") {
      setError("Ungültiges CSV-Format. Erwartete Spalten: Anrede, Vorname, Nachname, Email, Firmenname[, Variable 1, Variable 2, Variable 3]"); return
    }
    const items: Lead[] = []
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(delimiter).map((v) => v.trim())
      if (fields.length < 5) { setError(`Zeile ${i + 1} hat nicht genug Felder.`); return }
      const [anrede, vorname, nachname, email, firmenname, var1, var2, var3] = fields
      if (!vorname || !nachname || !email) { setError(`Zeile ${i + 1}: Vorname, Nachname und Email dürfen nicht leer sein.`); return }
      items.push({ id: i, anrede, vorname, nachname, email, firmenname, var1, var2, var3, status: "pending" })
    }
    setError(null)
    setLeads(items)
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".csv")) { setError("Bitte eine .csv-Datei auswählen."); return }
    parseCsv(await file.text())
  }

  const sendInvites = async () => {
    if (leads.length === 0) { setError("Keine Leads zum Senden vorhanden."); return }
    const start = new Date(`${windowStartDate}T${windowStartTime}:00`)
    const end = new Date(`${windowEndDate}T${windowEndTime}:00`)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) { setError("Ungültiges Zeitfenster."); return }
    if (durationMinutes <= 0) { setError("Dauer muss größer als 0 sein."); return }
    if (parallelCount <= 0) { setError("Parallelität muss mindestens 1 sein."); return }

    // Retry mode: only send leads that previously failed; never re-send successful ones
    const hasFailedLeads = leads.some((l) => l.status === "failed")
    const leadsToSend = hasFailedLeads ? leads.filter((l) => l.status === "failed") : leads

    setSendStatus("sending"); setError(null); setProgress({ sent: 0, total: Math.min(leadsToSend.length, schedulableLeads) }); setSendStartTime(Date.now())
    try {
      const response = await fetch("/api/teams/send-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: leadsToSend,
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
          durationMinutes,
          parallelCount,
          eventBody,
          eventSubject,
          signature,
        }),
      })
      if (!response.ok) throw new Error((await response.text()) || "Fehler beim Versenden")

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = JSON.parse(line.slice(6))
          if (data.type === "progress") {
            setProgress((prev) => prev ? { ...prev, sent: data.sent } : { sent: data.sent, total: data.total })
          } else if (data.type === "done") {
            const resultsById = new Map<number, { status: string; message: string }>(
              data.results.map((r: { id: number; status: string; message: string }) => [r.id, r])
            )
            setLeads((prev) => prev.map((lead) => {
              const result = resultsById.get(lead.id)
              if (!result) return lead // was not in this batch (already successful)
              return { ...lead, status: result.status === "success" ? "success" : "failed", message: result.message }
            }))
            setSendStatus("success")
            setProgress(null)
          }
        }
      }
    } catch (err) {
      setError((err as Error).message); setSendStatus("failed"); setProgress(null)
    }
  }

  const sendTestInvite = async () => {
    if (!testEmail) { setTestMessage("Bitte eine Test-E-Mail-Adresse eingeben."); setTestStatus("failed"); return }
    const start = new Date(`${windowStartDate}T${windowStartTime}:00`)
    const end = new Date(`${windowEndDate}T${windowEndTime}:00`)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) { setTestMessage("Ungültiges Zeitfenster."); setTestStatus("failed"); return }
    setTestStatus("sending"); setTestMessage(null)
    try {
      const response = await fetch("/api/teams/send-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: [{ id: 0, anrede: "Herr", vorname: "Max", nachname: "Mustermann", firmenname: "Beispiel GmbH", email: testEmail, var1: "Beispiel1", var2: "Beispiel2", var3: "Beispiel3" }],
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
          durationMinutes,
          parallelCount: 1,
          eventBody: signature ? `${eventBody}<br>${signature}` : eventBody,
          eventSubject,
        }),
      })
      if (!response.ok) throw new Error((await response.text()) || "Fehler beim Test-Versand")

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let result: { status: string; message: string } | undefined

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = JSON.parse(line.slice(6))
          if (data.type === "done") result = data.results?.[0]
        }
      }

      if (result?.status === "success") {
        setTestStatus("success"); setTestMessage(`Test-Einladung an ${testEmail} versendet.`)
      } else {
        throw new Error(result?.message || "Unbekannter Fehler")
      }
    } catch (err) {
      setTestStatus("failed"); setTestMessage((err as Error).message)
    }
  }

  const start = new Date(`${windowStartDate}T${windowStartTime}:00`)
  const end = new Date(`${windowEndDate}T${windowEndTime}:00`)
  const rangeMs = end.getTime() - start.getTime()
  const slotMs = durationMinutes * 60 * 1000
  const availableSlots = slotMs > 0 && rangeMs > 0 ? Math.floor(rangeMs / slotMs) : 0
  const schedulableLeads = availableSlots * parallelCount
  // In retry mode only count leads that haven't succeeded yet
  const pendingLeadsCount = leads.some((l) => l.status === "failed")
    ? leads.filter((l) => l.status === "failed").length
    : leads.length

  return (
    <section className="w-full space-y-5">

      <div className="flex items-center gap-4 flex-wrap justify-between">
        <a href="/app/versand-uebersicht" className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm text-gray-300 font-medium transition-colors">
          Versand-Übersicht →
        </a>

        {quota && quota.sendLimit !== null && (
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Versendet</p>
              <p className={`text-sm font-semibold ${quota.sentCount >= quota.sendLimit ? "text-red-400" : "text-gray-200"}`}>
                {quota.sentCount}
              </p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Verbleibend</p>
              <p className={`text-sm font-semibold ${quota.remaining !== null && quota.remaining <= 0 ? "text-red-400" : quota.remaining !== null && quota.remaining < 10 ? "text-orange-400" : "text-green-400"}`}>
                {quota.remaining !== null && quota.remaining <= 0 ? "Limit erreicht" : quota.remaining}
              </p>
            </div>
            <div className="w-16">
              <div className="h-1 w-full bg-white/10 rounded-full">
                {(() => {
                  const pct = Math.min(100, Math.round((quota.sentCount / quota.sendLimit!) * 100))
                  return (
                    <div
                      className={`h-1 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-400" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  )
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSV Upload */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Lead-Upload</h2>
          <button
            onClick={downloadLeadTemplate}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 text-white text-sm font-medium transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="3" fill="#1D6F42"/>
              <path d="M13 3H7C5.9 3 5 3.9 5 5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V9L13 3Z" fill="#1D6F42"/>
              <path d="M13 3V9H19L13 3Z" fill="#185C37"/>
              <path d="M9 13L11.5 17H12.5L15 13H13.8L12 16L10.2 13H9Z" fill="white"/>
            </svg>
            Lead-Template
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-gray-400 mb-2">CSV-Datei mit Spalten: Anrede, Vorname, Nachname, Email, Firmenname, Variable 1, Variable 2, Variable 3</p>
            <input type="file" accept=".csv" onChange={handleFile} className="text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white file:text-sm file:cursor-pointer hover:file:bg-blue-500" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Oder Excel-Zellen kopieren und hier einfügen (Strg+V) — ohne Kopfzeile, Reihenfolge: Anrede, Vorname, Nachname, Email, Firmenname, Variable 1, Variable 2, Variable 3</p>
            <textarea
              rows={3}
              placeholder="Hier klicken und Strg+V drücken…"
              className={`${input} resize-y font-mono`}
              onPaste={(e) => {
                e.preventDefault()
                const text = e.clipboardData.getData("text")
                const lines = text.trim().split(/\r?\n/).filter(Boolean)
                const items: Lead[] = []
                for (let i = 0; i < lines.length; i++) {
                  const fields = lines[i].split("\t").map((v) => v.trim())
                  if (fields.length < 5) { setError(`Zeile ${i + 1} hat ${fields.length} Spalten, erwartet werden mindestens 5.`); return }
                  const [anrede, vorname, nachname, email, firmenname, var1, var2, var3] = fields
                  if (!vorname || !nachname || !email) { setError(`Zeile ${i + 1}: Vorname, Nachname und Email dürfen nicht leer sein.`); return }
                  items.push({ id: i + 1, anrede, vorname, nachname, email, firmenname, var1, var2, var3, status: "pending" })
                }
                setError(null); setLeads(items)
              }}
              readOnly
            />
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">Fehler: {error}</p>}
      </div>

      {/* Lead-Tabelle */}
      {leads.length > 0 && (
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 overflow-x-auto">
          <h2 className="text-lg font-bold text-white">Importierte Leads <span className="text-gray-400 font-normal text-sm">({leads.length})</span></h2>
          <div className="overflow-auto max-h-72 rounded-xl border border-white/10 w-full">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-white/10 text-gray-300">
                  {["#","Anrede","Vorname","Nachname","Email","Firma","Var 1","Var 2","Var 3","Status","Details"].map((h) => (
                    <th key={h} className="px-2 py-2 font-medium whitespace-nowrap text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className={
                    lead.status === "success" ? "bg-green-500/10 text-green-300"
                    : lead.status === "failed" ? "bg-red-500/10 text-red-300"
                    : "text-gray-300 odd:bg-white/5"
                  }>
                    <td className="px-2 py-1 text-xs">{lead.id}</td>
                    <td className="px-2 py-1 text-xs">{lead.anrede}</td>
                    <td className="px-2 py-1 text-xs">{lead.vorname}</td>
                    <td className="px-2 py-1 text-xs">{lead.nachname}</td>
                    <td className="px-2 py-1 text-xs">{lead.email}</td>
                    <td className="px-2 py-1 text-xs">{lead.firmenname}</td>
                    <td className="px-2 py-1 text-xs">{lead.var1 ?? "–"}</td>
                    <td className="px-2 py-1 text-xs">{lead.var2 ?? "–"}</td>
                    <td className="px-2 py-1 text-xs">{lead.var3 ?? "–"}</td>
                    <td className="px-2 py-1 text-xs">{lead.status ?? "–"}</td>
                    <td className="px-2 py-1 text-xs">{lead.message ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Terminfenster */}
      <div className={card}>
        <h2 className="text-lg font-bold text-white">Terminfenster</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={label}>Start-Tag</label><input type="date" value={windowStartDate} onChange={(e) => setWindowStartDate(e.target.value)} className={input} /></div>
          <div><label className={label}>Start-Uhrzeit</label><input type="time" value={windowStartTime} onChange={(e) => setWindowStartTime(e.target.value)} className={input} /></div>
          <div><label className={label}>End-Tag</label><input type="date" value={windowEndDate} onChange={(e) => setWindowEndDate(e.target.value)} className={input} /></div>
          <div><label className={label}>End-Uhrzeit</label><input type="time" value={windowEndTime} onChange={(e) => setWindowEndTime(e.target.value)} className={input} /></div>
          <div><label className={label}>Termindauer (Minuten)</label><input type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={input} /></div>
          <div><label className={label}>Parallelität (Termine pro Slot)</label><input type="number" min={1} max={10} value={parallelCount} onChange={(e) => setParallelCount(Number(e.target.value))} className={input} /></div>
        </div>

        {leads.length > 0 && availableSlots > 0 && (
          <p className="text-sm text-blue-400">
            Im Zeitfenster passen <strong>{availableSlots} Slot(s)</strong> × {parallelCount} Parallelität = <strong>{schedulableLeads} Termin(e)</strong>.{" "}
            {pendingLeadsCount > schedulableLeads && <span className="text-orange-400">{pendingLeadsCount - schedulableLeads} Lead(s) bleiben ohne Slot.</span>}
          </p>
        )}

        <div>
          <label className={label}>Einladungstext <span className="ml-1 text-xs font-normal text-gray-500">Verwende Variablen als Platzhalter</span></label>

          {/* Vorlagen-Verwaltung */}
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <select
              className="bg-gray-800 border border-white/20 text-white rounded-lg px-3 py-2 text-sm flex-1 min-w-40"
              value={selectedTemplateId ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value)
                const t = templates.find((t) => t.id === id)
                if (t) { setSelectedTemplateId(t.id); setTemplateName(t.name); setEventBody(t.html); setEventSubject(t.subject || "Termin mit {{vorname}} {{nachname}}") }
              }}
            >
              {templates.length === 0 && <option value="" className="bg-gray-800">— Keine Vorlagen —</option>}
              {templates.map((t) => <option key={t.id} value={t.id} className="bg-gray-800">{t.name}</option>)}
            </select>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Vorlagenname…"
              className="flex-1 bg-white/10 border border-white/20 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={saveTemplate} disabled={tmplSaveStatus === "saving"} className={btnPrimary}>
              {tmplSaveStatus === "saving" ? "Speichert…" : tmplSaveStatus === "saved" ? "Gespeichert ✓" : tmplSaveStatus === "failed" ? "Fehler" : "Speichern"}
            </button>
            {selectedTemplateId && (
              <button onClick={deleteTemplate} className="rounded-xl bg-red-600/80 hover:bg-red-600 px-4 py-2 text-white text-sm transition-colors">
                Löschen
              </button>
            )}
            <button
              type="button"
              onClick={() => { setSelectedTemplateId(null); setTemplateName("Neue Vorlage"); setEventBody("<p>Hallo {{vorname}},</p>"); setEventSubject("Hier Terminbetreff eingeben"); resetAnalysis() }}
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-white text-sm font-semibold transition-colors shadow-md"
            >
              + Neu
            </button>
          </div>

          <div className="mb-3">
            <label className={label}>Terminbetreff <span className="ml-1 text-xs font-normal text-gray-500">Platzhalter möglich</span></label>
            <input
              type="text"
              value={eventSubject}
              onChange={(e) => setEventSubject(e.target.value)}
              placeholder="Termin mit {{vorname}} {{nachname}}"
              className={input}
            />
          </div>

          <RichTextEditor value={eventBody} onChange={setEventBody} />

          {/* KI-Analyse */}
          {analyzing && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <svg className="animate-spin w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              KI analysiert deinen Text…
            </div>
          )}

          {!analyzing && aiAnalysis && checkedSuggestions.length > 0 && checkedSuggestions.every(Boolean) && (
            <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🤖</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">KI-Schnellanalyse</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-3xl">🏆</span>
                <div>
                  <p className="text-green-400 font-bold text-lg">10 / 10 – Perfekt!</p>
                  <p className="text-sm text-gray-300 mt-0.5">Dein Text ist bereit zum Einsatz. Viel Erfolg beim Versand!</p>
                </div>
              </div>
            </div>
          )}
          {!analyzing && aiAnalysis && !(checkedSuggestions.length > 0 && checkedSuggestions.every(Boolean)) && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">KI-Schnellanalyse</span>
              </div>
              <p className="text-sm text-gray-300">{aiAnalysis.motivation}</p>
              <ul className="space-y-2">
                {aiAnalysis.suggestions.map((s, i) => {
                  const checked = checkedSuggestions[i]
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 cursor-pointer group"
                      onClick={() => setCheckedSuggestions(prev => prev.map((v, j) => j === i ? !v : v))}
                    >
                      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'bg-green-500 border-green-500' : 'border-white/30 group-hover:border-white/60'}`}>
                        {checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm transition-colors ${checked ? 'text-green-400 line-through' : 'text-gray-300'}`}>{s}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Signatur */}
      <div className={card}>
        <div>
          <h2 className="text-lg font-bold text-white">Meine Signatur</h2>
          <p className="text-sm text-gray-400">Wird automatisch an jeden Einladungstext angehängt.</p>
        </div>
        <RichTextEditor value={signature} onChange={setSignature} showVariables={false} />
        <button onClick={saveSignature} disabled={sigSaveStatus === "saving"} className={btnPrimary}>
          {sigSaveStatus === "saving" ? "Wird gespeichert…" : sigSaveStatus === "saved" ? "Gespeichert ✓" : sigSaveStatus === "failed" ? "Fehler beim Speichern" : "Signatur speichern"}
        </button>
      </div>

      {/* Test-Versand */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Test-Einladung</h2>
          <p className="text-sm text-gray-400">Sendet eine Einladung mit dem aktuellen Text an eine einzelne Adresse. Platzhalter: Herr Max Mustermann, Beispiel GmbH, var1/2/3 = Beispiel1/2/3</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => { setTestEmail(e.target.value); setTestStatus("idle"); setTestMessage(null) }}
            placeholder="test@beispiel.de"
            className={`flex-1 min-w-48 ${input}`}
          />
          <button onClick={sendTestInvite} disabled={testStatus === "sending"} className="rounded-xl bg-yellow-500 hover:bg-yellow-400 px-5 py-2.5 text-gray-900 font-semibold text-sm transition-colors disabled:opacity-40">
            {testStatus === "sending" ? "Wird gesendet…" : "Test senden"}
          </button>
        </div>
        {testMessage && <p className={`text-sm ${testStatus === "success" ? "text-green-400" : "text-red-400"}`}>{testMessage}</p>}
      </div>

      {/* Versand */}
      <div className="flex flex-wrap items-center gap-4 pb-8">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={sendStatus === "sending" || leads.length === 0}
          className={`${btnPrimary} text-base px-6 py-3`}
        >
          {sendStatus === "sending"
            ? "Wird versendet…"
            : leads.some((l) => l.status === "failed")
              ? `Fehlgeschlagene erneut senden (${pendingLeadsCount} Leads)`
              : `Termine versenden (${Math.min(pendingLeadsCount, schedulableLeads)} von ${pendingLeadsCount} Leads)`
          }
        </button>
        {sendStatus === "success" && <p className="text-green-400 text-sm">Einladungen wurden versendet.</p>}
        {sendStatus === "failed" && <p className="text-red-400 text-sm">Versand fehlgeschlagen: {error}</p>}
      </div>

      {/* Versand-Overlay */}
      {sendStatus === "sending" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-6">
            <div className="w-14 h-14 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            <div className="text-center w-full">
              <p className="text-white text-xl font-semibold mb-1">Termine werden versendet…</p>
              <p className="text-gray-400 text-sm mb-5">Bitte nicht schließen oder wegnavigieren.</p>

              {progress && (() => {
                const remaining = progress.total - progress.sent
                let etaText = ""
                const AVG_DELAY = 9.5
                if (remaining > 0) {
                  let etaSec: number
                  if (progress.sent > 0 && sendStartTime) {
                    const elapsed = (Date.now() - sendStartTime) / 1000
                    // The delay after the last send is currently running but not yet in elapsed,
                    // so add the average delay to get an accurate per-invite rate.
                    const adjustedElapsed = elapsed + (remaining > 0 ? AVG_DELAY : 0)
                    const secPerInvite = adjustedElapsed / progress.sent
                    etaSec = Math.round(secPerInvite * remaining)
                  } else {
                    etaSec = Math.round(remaining * (AVG_DELAY + 1))
                  }
                  if (etaSec >= 60) {
                    const m = Math.floor(etaSec / 60)
                    const s = etaSec % 60
                    etaText = `ca. ${m} Min. ${s} Sek. verbleibend`
                  } else {
                    etaText = `ca. ${etaSec} Sek. verbleibend`
                  }
                }
                return (
                  <>
                    <div className="flex justify-between text-sm text-gray-300 mb-2">
                      <span>{progress.sent} von {progress.total} versendet</span>
                      <span className="font-semibold text-blue-400">
                        {Math.round((progress.sent / progress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden mb-3">
                      <div
                        className="h-3 rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${(progress.sent / progress.total) * 100}%` }}
                      />
                    </div>
                    {etaText && <p className="text-blue-400 text-sm font-medium mb-2">{etaText}</p>}
                    <p className="text-gray-500 text-xs">Der Versand läuft absichtlich langsam, um das Spam-Risiko zu reduzieren.</p>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Bestätigungs-Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-white">Termine wirklich versenden?</h2>
            <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Anzahl Termine</span>
                <span className="font-semibold text-white">{Math.min(pendingLeadsCount, schedulableLeads)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Zeitfenster Start</span>
                <span className="font-semibold text-white">{new Date(`${windowStartDate}T${windowStartTime}`).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Zeitfenster Ende</span>
                <span className="font-semibold text-white">{new Date(`${windowEndDate}T${windowEndTime}`).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Termindauer</span>
                <span className="font-semibold text-white">{durationMinutes} Minuten</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Parallelität</span>
                <span className="font-semibold text-white">{parallelCount} parallel</span>
              </div>
              {pendingLeadsCount > schedulableLeads && (
                <p className="text-orange-400 pt-1">{pendingLeadsCount - schedulableLeads} Lead(s) erhalten keinen Slot und werden übersprungen.</p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Vorschau Einladungstext</p>
              <div
                className="bg-white rounded-xl p-4 text-gray-900 text-base max-h-[500px] overflow-y-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
                dangerouslySetInnerHTML={{ __html: (signature ? `${eventBody}<br>${signature}` : eventBody)
                  .replace(/<p>/gi, '<p style="margin:0;padding:0;">')
                  .replace(/<p style="margin:0;padding:0;"><\/p>/gi, '<p style="margin:0;padding:0;"><br></p>') }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); sendInvites() }}
                className={`flex-1 ${btnPrimary} py-3 text-base`}
              >
                Ja, versenden
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 px-5 py-3 text-gray-300 font-medium text-base transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}
