import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen p-10">
      <h1 className="text-4xl font-bold mb-4 text-red-600">Kein Zugriff</h1>
      <p className="mb-6 text-gray-700">
        Du bist nicht angemeldet oder hast keine Berechtigung, diesen Bereich zu betreten.
      </p>
      <Link
        href="/"
        className="rounded bg-blue-600 px-4 py-2 text-white inline-block"
      >
        Zurück zur Startseite
      </Link>
    </main>
  )
}
