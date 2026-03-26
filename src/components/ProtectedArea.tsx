"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import RichTextEditor from "./RichTextEditor"

const ADMIN_EMAIL = "leonard.zimmermann@smartflow-consulting.com"

type Lead = {
  id: number
  anrede: string
  vorname: string
  nachname: string
  email: string
  firmenname: string
  status?: "pending" | "success" | "failed"
  message?: string
}

type SendStatus = "idle" | "sending" | "success" | "failed"

export default function ProtectedArea() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const [leads, setLeads] = useState<Lead[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle")
  const [testEmail, setTestEmail] = useState<string>("")
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "success" | "failed">("idle")
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [signature, setSignature] = useState<string>("")
  const [sigSaveStatus, setSigSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle")

  const [windowStartDate, setWindowStartDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [windowStartTime, setWindowStartTime] = useState<string>("09:00")
  const [windowEndDate, setWindowEndDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [windowEndTime, setWindowEndTime] = useState<string>("12:00")
  const [durationMinutes, setDurationMinutes] = useState<number>(30)
  const [parallelCount, setParallelCount] = useState<number>(1)
  const [eventBody, setEventBody] = useState<string>("<p>Hallo {{vorname}},</p><p>ich möchte Sie zu einem Teams-Termin einladen.</p>")

  useEffect(() => {
    fetch("/api/signature")
      .then((r) => r.json())
      .then((d) => { if (d.html) setSignature(d.html) })
      .catch(() => {})
  }, [])

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
    const lines = text
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length < 2) {
      setError("Die CSV muss mindestens eine Datenzeile enthalten.")
      return
    }

    const delimiter = lines[0].includes(";") ? ";" : ","
    const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase())
    if (
      header.length !== 5 ||
      header[0] !== "anrede" ||
      header[1] !== "vorname" ||
      header[2] !== "nachname" ||
      header[3] !== "email" ||
      header[4] !== "firmenname"
    ) {
      setError("Ungültiges CSV-Format. Erwartete Spalten: Anrede, Vorname, Nachname, Email, Firmenname")
      return
    }

    const items: Lead[] = []
    for (let i = 1; i < lines.length; i += 1) {
      const fields = lines[i].split(delimiter).map((v) => v.trim())
      if (fields.length !== 5) {
        setError(`Zeile ${i + 1} hat nicht 5 Felder.`)
        return
      }
      const [anrede, vorname, nachname, email, firmenname] = fields
      if (!vorname || !nachname || !email) {
        setError(`Zeile ${i + 1}: Vorname, Nachname und Email dürfen nicht leer sein.`)
        return
      }
      items.push({ id: i, anrede, vorname, nachname, email, firmenname, status: "pending" })
    }
    setError(null)
    setLeads(items)
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".csv")) {
      setError("Bitte eine .csv-Datei auswählen.")
      return
    }

    const text = await file.text()
    parseCsv(text)
  }

  const sendInvites = async () => {
    if (leads.length === 0) {
      setError("Keine Leads zum Senden vorhanden.")
      return
    }

    const start = new Date(`${windowStartDate}T${windowStartTime}:00`)
    const end = new Date(`${windowEndDate}T${windowEndTime}:00`)

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      setError("Ungültiges Zeitfenster: Bitte Start und Ende korrekt setzen.")
      return
    }
    if (durationMinutes <= 0) {
      setError("Dauer muss größer als 0 sein.")
      return
    }
    if (parallelCount <= 0) {
      setError("Parallelität muss mindestens 1 sein.")
      return
    }

    setSendStatus("sending")
    setError(null)

    try {
      const response = await fetch("/api/teams/send-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads,
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
          durationMinutes,
          parallelCount,
          eventBody: signature ? `${eventBody}<br><br>${signature}` : eventBody,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || "Fehler beim Versenden")
      }

      const data = await response.json()
      setLeads((prev) =>
        prev.map((lead, i) => ({
          ...lead,
          status: data.results[i]?.status === "success" ? "success" : "failed",
          message: data.results[i]?.message,
        }))
      )
      setSendStatus("success")
    } catch (err) {
      setError((err as Error).message)
      setSendStatus("failed")
    }
  }

  const sendTestInvite = async () => {
    if (!testEmail) {
      setTestMessage("Bitte eine Test-E-Mail-Adresse eingeben.")
      setTestStatus("failed")
      return
    }

    const start = new Date(`${windowStartDate}T${windowStartTime}:00`)
    const end = new Date(`${windowEndDate}T${windowEndTime}:00`)

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      setTestMessage("Ungültiges Zeitfenster.")
      setTestStatus("failed")
      return
    }

    setTestStatus("sending")
    setTestMessage(null)

    try {
      const response = await fetch("/api/teams/send-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: [{ id: 0, vorname: "Test", nachname: "Person", email: testEmail }],
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
          durationMinutes,
          parallelCount: 1,
          eventBody: signature ? `${eventBody}<br><br>${signature}` : eventBody,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || "Fehler beim Test-Versand")
      }

      const data = await response.json()
      const result = data.results?.[0] as { status: string; message: string } | undefined
      if (result?.status === "success") {
        setTestStatus("success")
        setTestMessage(`Test-Einladung an ${testEmail} versendet.`)
      } else {
        throw new Error(result?.message || "Unbekannter Fehler")
      }
    } catch (err) {
      setTestStatus("failed")
      setTestMessage((err as Error).message)
    }
  }

  // Berechne wie viele Leads tatsächlich einen Slot bekommen
  const start = new Date(`${windowStartDate}T${windowStartTime}:00`)
  const end = new Date(`${windowEndDate}T${windowEndTime}:00`)
  const rangeMs = end.getTime() - start.getTime()
  const slotMs = durationMinutes * 60 * 1000
  const availableSlots = slotMs > 0 && rangeMs > 0 ? Math.floor(rangeMs / slotMs) : 0
  const schedulableLeads = availableSlots * parallelCount

  return (
    <section className="max-w-3xl space-y-6">
      {isAdmin && (
        <a
          href="/app/admin"
          className="inline-block rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Admin – Versand-Übersicht
        </a>
      )}

      {/* CSV Upload */}
      <div className="border rounded-xl p-4 bg-gray-50">
        <h2 className="text-2xl font-semibold mb-2">Lead-Upload</h2>
        <p className="mb-2 text-sm text-gray-600">CSV mit Spalten: Anrede, Vorname, Nachname, Email, Firmenname</p>
        <input type="file" accept=".csv" onChange={handleFile} className="mb-2" />
        {error && <div className="text-red-600 text-sm mt-1">Fehler: {error}</div>}
      </div>

      {/* Lead-Tabelle */}
      <div className="border rounded-xl p-4 bg-gray-50">
        <h2 className="text-2xl font-semibold mb-2">Importierte Leads</h2>
        {leads.length === 0 ? (
          <p className="text-gray-500 text-sm">Keine Leads importiert.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-2">{leads.length} Lead(s) geladen.</p>
            <div className="overflow-auto max-h-64">
              <table className="min-w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border px-2 py-1">#</th>
                    <th className="border px-2 py-1">Anrede</th>
                    <th className="border px-2 py-1">Vorname</th>
                    <th className="border px-2 py-1">Nachname</th>
                    <th className="border px-2 py-1">Email</th>
                    <th className="border px-2 py-1">Firmenname</th>
                    <th className="border px-2 py-1">Status</th>
                    <th className="border px-2 py-1">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={
                        lead.status === "success"
                          ? "bg-green-50"
                          : lead.status === "failed"
                          ? "bg-red-50"
                          : "odd:bg-white even:bg-gray-50"
                      }
                    >
                      <td className="border px-2 py-1">{lead.id}</td>
                      <td className="border px-2 py-1">{lead.anrede}</td>
                      <td className="border px-2 py-1">{lead.vorname}</td>
                      <td className="border px-2 py-1">{lead.nachname}</td>
                      <td className="border px-2 py-1">{lead.email}</td>
                      <td className="border px-2 py-1">{lead.firmenname}</td>
                      <td className="border px-2 py-1">{lead.status ?? "–"}</td>
                      <td className="border px-2 py-1">{lead.message ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Terminplanung */}
      <div className="border rounded-xl p-4 bg-gray-50">
        <h2 className="text-2xl font-semibold mb-4">Terminfenster</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-medium">Start-Tag</label>
            <input
              type="date"
              value={windowStartDate}
              onChange={(e) => setWindowStartDate(e.target.value)}
              className="w-full border px-2 py-1 rounded text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Start-Uhrzeit</label>
            <input
              type="time"
              value={windowStartTime}
              onChange={(e) => setWindowStartTime(e.target.value)}
              className="w-full border px-2 py-1 rounded text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">End-Tag</label>
            <input
              type="date"
              value={windowEndDate}
              onChange={(e) => setWindowEndDate(e.target.value)}
              className="w-full border px-2 py-1 rounded text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">End-Uhrzeit</label>
            <input
              type="time"
              value={windowEndTime}
              onChange={(e) => setWindowEndTime(e.target.value)}
              className="w-full border px-2 py-1 rounded text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Termindauer (Minuten)</label>
            <input
              type="number"
              min={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full border px-2 py-1 rounded text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Parallelität (Termine pro Slot)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={parallelCount}
              onChange={(e) => setParallelCount(Number(e.target.value))}
              className="w-full border px-2 py-1 rounded text-sm"
            />
          </div>
        </div>

        {leads.length > 0 && availableSlots > 0 && (
          <p className="mt-3 text-sm text-blue-700">
            Im Zeitfenster passen <strong>{availableSlots} Slot(s)</strong> × {parallelCount} Parallelität
            = <strong>{schedulableLeads} Termin(e)</strong>.{" "}
            {leads.length > schedulableLeads && (
              <span className="text-orange-600">
                {leads.length - schedulableLeads} Lead(s) bleiben ohne Slot.
              </span>
            )}
          </p>
        )}

        <div className="mt-4">
          <label className="block mb-2 text-sm font-medium">
            Einladungstext / Terminbeschreibung
            <span className="ml-2 text-xs font-normal text-gray-500">
              Verwende {"{{vorname}}"}, {"{{nachname}}"}, {"{{email}}"} als Platzhalter
            </span>
          </label>
          <RichTextEditor value={eventBody} onChange={setEventBody} />
        </div>
      </div>

      {/* Signatur */}
      <div className="border rounded-xl p-4 bg-gray-50">
        <h2 className="text-xl font-semibold mb-1">Meine Signatur</h2>
        <p className="text-sm text-gray-500 mb-3">Wird automatisch an jeden Einladungstext angehängt.</p>
        <RichTextEditor value={signature} onChange={setSignature} />
        <button
          type="button"
          onClick={saveSignature}
          disabled={sigSaveStatus === "saving"}
          className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {sigSaveStatus === "saving" ? "Wird gespeichert…" : sigSaveStatus === "saved" ? "Gespeichert ✓" : sigSaveStatus === "failed" ? "Fehler beim Speichern" : "Signatur speichern"}
        </button>
      </div>

      {/* Test-Versand */}
      <div className="border rounded-xl p-4 bg-yellow-50 border-yellow-200">
        <h2 className="text-xl font-semibold mb-3">Test-Einladung senden</h2>
        <p className="text-sm text-gray-600 mb-3">
          Sendet eine Einladung mit dem aktuellen Text und Zeitfenster an eine einzelne Adresse.
          Als Platzhalter-Name wird &quot;Test Person&quot; verwendet.
        </p>
        <div className="flex gap-2 items-center">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => { setTestEmail(e.target.value); setTestStatus("idle"); setTestMessage(null) }}
            placeholder="test@beispiel.de"
            className="flex-1 border px-2 py-1 rounded text-sm"
          />
          <button
            className="rounded bg-yellow-500 px-4 py-2 text-white disabled:opacity-50 text-sm whitespace-nowrap"
            onClick={sendTestInvite}
            disabled={testStatus === "sending"}
          >
            {testStatus === "sending" ? "Wird gesendet…" : "Test senden"}
          </button>
        </div>
        {testMessage && (
          <p className={`mt-2 text-sm ${testStatus === "success" ? "text-green-700" : "text-red-700"}`}>
            {testMessage}
          </p>
        )}
      </div>

      {/* Versand */}
      <div className="flex items-center gap-4">
        <button
          className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
          onClick={sendInvites}
          disabled={sendStatus === "sending" || leads.length === 0}
        >
          {sendStatus === "sending"
            ? "Wird versendet…"
            : `Termine versenden (${Math.min(leads.length, schedulableLeads)} von ${leads.length} Leads)`}
        </button>
      </div>

      {sendStatus === "success" && (
        <p className="text-green-700">Einladungen wurden versendet.</p>
      )}
      {sendStatus === "failed" && (
        <p className="text-red-700">Versand fehlgeschlagen: {error}</p>
      )}

    </section>
  )
}
