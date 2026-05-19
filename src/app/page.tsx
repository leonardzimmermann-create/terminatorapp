'use client'

import { useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useLanguage } from '@/components/LanguageProvider'
import { t } from '@/lib/i18n'

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { lang } = useLanguage()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4">
            <img src="/LogoWeißSales.png" alt="Sales Culture Logo" className="w-48 h-auto mx-auto" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Terminator</h1>
          <p className="text-gray-400 mt-1 text-sm tracking-widest uppercase">{t("start_subtitle", lang)}</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl space-y-5">
          {status === 'loading' && (
            <p className="text-center text-gray-400 text-sm">{t("loading", lang)}</p>
          )}

          {session ? (
            <>
              <div className="text-center">
                <p className="text-gray-300 text-sm">{t("start_logged_in_as", lang)}</p>
                <p className="text-white font-semibold mt-1">{session.user?.email}</p>
              </div>

              <button
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-white font-semibold transition-colors shadow-lg"
                onClick={() => router.push('/app')}
              >
                {t("start_go_to_app", lang)}
              </button>

              <button
                className="w-full rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3 text-gray-300 font-medium transition-colors"
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                {t("start_logout", lang)}
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-gray-300 text-sm">{t("start_sign_in_hint", lang)}</p>
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
                {t("start_sign_in_btn", lang)}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">{t("start_footer", lang)}</p>
      </div>
    </main>
  )
}
