export default function NotAuthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/30 mb-6">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-3">Zugang nicht freigeschalten</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Dein Account wurde noch nicht für die Nutzung dieser App freigeschalten.
          Bitte kontaktiere den Administrator.
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
