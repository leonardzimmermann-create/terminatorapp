"use client"
import { useLanguage } from "@/components/LanguageProvider"
import { t } from "@/lib/i18n"

export default function StatusPage() {
  const { lang } = useLanguage()
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-600/20 border border-yellow-500/30 mb-6">
          <span className="text-3xl">⚙️</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-3">{t("service_unavailable", lang)}</h1>
        <p className="text-gray-400 text-sm leading-relaxed">{t("service_body", lang)}</p>
      </div>
    </main>
  )
}
