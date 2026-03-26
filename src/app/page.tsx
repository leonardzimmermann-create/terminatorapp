'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()

  return (
    <main className="min-h-screen p-10">
      <h1 className="text-4xl font-bold mb-4">Lead Meeting App (öffentlich)</h1>

      {status === 'loading' && <p>Lade...</p>}

      {session ? (
        <>
          <p className="mb-2">Angemeldet als {session.user?.email}</p>
          <p className="mb-4">Name: {session.user?.name ?? 'unbekannt'}</p>

          <button
            className="rounded bg-red-600 px-4 py-2 text-white"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            Logout
          </button>

          <button
            className="ml-4 rounded bg-green-600 px-4 py-2 text-white"
            onClick={() => router.push('/app')}
          >
            Weiter zum geschützten Bereich
          </button>

          <p className="mt-2 text-sm text-gray-600">Alternativ:</p>
          <Link href="/app" className="text-blue-600 underline">
            /app (direkter Link)
          </Link>
        </>
      ) : (
        <>
          <p className="mb-4">Bitte melde dich mit deinem Microsoft-Unternehmenskonto an.</p>

          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => signIn('azure-ad', { callbackUrl: '/app' })}
          >
            Mit Azure AD anmelden
          </button>

          <p className="mt-3 text-sm text-gray-600">Falls nichts passiert, verwende bitte den manuellen Link:</p>
          <a
            className="text-blue-600 underline"
            href="/api/auth/signin/azure-ad"
          >
            /api/auth/signin/azure-ad
          </a>
        </>
      )}
    </main>
  )
}
