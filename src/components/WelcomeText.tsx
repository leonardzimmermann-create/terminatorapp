"use client"
import { useLanguage } from "@/components/LanguageProvider"
import { t } from "@/lib/i18n"

export default function WelcomeText({ nameOrEmail }: { nameOrEmail: string }) {
  const { lang } = useLanguage()
  return (
    <p className="text-gray-400 text-sm ml-12">{t("welcome", lang)}, {nameOrEmail}</p>
  )
}
