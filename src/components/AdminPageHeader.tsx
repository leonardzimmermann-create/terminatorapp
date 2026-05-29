"use client"
import { useLanguage } from "@/components/LanguageProvider"
import { t } from "@/lib/i18n"

export default function AdminPageHeader({ userCount, blockedCount }: { userCount: number; blockedCount: number }) {
  const { lang } = useLanguage()
  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-purple-600 shadow-lg">
          <span className="text-lg">🛡️</span>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Admin</h1>
          <p className="text-gray-400 text-sm">{userCount} {t("known_users", lang)} · {blockedCount} {t("blocked", lang)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <a href="/app/versand-uebersicht" className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm text-gray-300 font-medium transition-colors">
          {t("back_to_send_overview", lang)}
        </a>
      </div>
    </>
  )
}
