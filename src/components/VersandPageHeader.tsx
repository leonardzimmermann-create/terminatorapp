"use client"
import { useLanguage } from "@/components/LanguageProvider"
import { t } from "@/lib/i18n"

export default function VersandPageHeader({
  domain,
  logCount,
  isAdmin,
}: {
  domain: string
  logCount: number
  isAdmin: boolean
}) {
  const { lang } = useLanguage()
  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center">
          <img src="/LogoWeißSales.png" alt="Sales Culture Logo" className="w-32 h-auto" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{t("send_overview", lang)}</h1>
          <p className="text-gray-400 text-sm">{t("organisation", lang)}: {domain} · {logCount} {t("send_actions", lang)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <a href="/app" className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm text-gray-300 font-medium transition-colors">
          {t("back_to_send", lang)}
        </a>
        {isAdmin && (
          <a href="/app/admin" className="inline-flex items-center gap-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 px-4 py-2 text-sm text-purple-300 font-medium transition-colors">
            🛡️ {t("admin", lang)}
          </a>
        )}
      </div>
    </>
  )
}
