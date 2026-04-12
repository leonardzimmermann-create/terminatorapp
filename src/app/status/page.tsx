export default function StatusPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-600/20 border border-yellow-500/30 mb-6">
          <span className="text-3xl">⚙️</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-3">Service nicht verfügbar</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Der Dienst ist vorübergehend nicht erreichbar. Bitte versuche es später erneut
          oder kontaktiere den Support.
        </p>
      </div>
    </main>
  )
}
