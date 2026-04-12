export default function SeatsExceededPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-600/20 border border-orange-500/30 mb-6">
          <span className="text-3xl">🪑</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-3">Maximale Nutzeranzahl erreicht</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Für deine Organisation wurde die maximale Anzahl an Seats bereits vergeben.
          Bitte kontaktiere den Administrator, um weitere Lizenzen zu erhalten.
        </p>
        <p className="mt-4 text-gray-500 text-xs">
          leonard.zimmermann@smartflow-consulting.com
        </p>
        <a
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 text-sm text-gray-300 font-medium transition-colors"
        >
          ← Zurück zur Startseite
        </a>
      </div>
    </main>
  )
}
