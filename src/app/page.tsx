'use client'

import { useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Terminator</h1>
          <p className="text-gray-400 mt-1 text-sm tracking-widest uppercase">Automatisierter Terminversand</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl space-y-5">
          {status === 'loading' && (
            <p className="text-center text-gray-400 text-sm">Lade...</p>
          )}

          {session ? (
            <>
              <div className="text-center">
                <p className="text-gray-300 text-sm">Angemeldet als</p>
                <p className="text-white font-semibold mt-1">{session.user?.email}</p>
              </div>

              <button
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-white font-semibold transition-colors shadow-lg"
                onClick={() => router.push('/app')}
              >
                Weiter zur App →
              </button>

              <button
                className="w-full rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3 text-gray-300 font-medium transition-colors"
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-gray-300 text-sm">Melde dich mit deinem Microsoft-Unternehmenskonto an.</p>
              </div>

              <button
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-white font-semibold transition-colors shadow-lg"
                onClick={() => signIn('azure-ad', { callbackUrl: '/app' })}
              >
                <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Mit Microsoft anmelden
              </button>
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">© 2025 Smartflow Consulting</p>
      </div>
    </main>
  )
}
