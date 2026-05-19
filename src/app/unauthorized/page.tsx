"use client"
import Link from "next/link"
import { useLanguage } from "@/components/LanguageProvider"
import { t } from "@/lib/i18n"

export default function UnauthorizedPage() {
  const { lang } = useLanguage()
  return (
    <main className="min-h-screen p-10">
      <h1 className="text-4xl font-bold mb-4 text-red-600">{t("unauth_title", lang)}</h1>
      <p className="mb-6 text-gray-700">{t("unauth_body", lang)}</p>
      <Link href="/" className="rounded bg-blue-600 px-4 py-2 text-white inline-block">
        {t("back_to_home", lang)}
      </Link>
    </main>
  )
}
