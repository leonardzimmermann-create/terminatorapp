"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Language = "de" | "en"

const LanguageContext = createContext<{ lang: Language; setLang: (l: Language) => void }>({
  lang: "de",
  setLang: () => {},
})

export function useLanguage() {
  return useContext(LanguageContext)
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("de")

  useEffect(() => {
    const stored = localStorage.getItem("lang") as Language | null
    if (stored === "en" || stored === "de") setLangState(stored)
  }, [])

  const setLang = (l: Language) => {
    setLangState(l)
    localStorage.setItem("lang", l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
      <div className="fixed top-4 inset-x-0 z-50 pointer-events-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex justify-end">
          <div className="pointer-events-auto">
            <div className="relative flex items-center bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-lg shadow-black/20">
              <div
                className="absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-900/40 transition-transform duration-300 ease-in-out"
                style={{ transform: lang === "en" ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
              />
              <button
                onClick={() => setLang("de")}
                className={`relative z-10 px-3.5 py-1 rounded-full text-xs font-bold tracking-wider transition-colors duration-200 ${
                  lang === "de" ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                DE
              </button>
              <button
                onClick={() => setLang("en")}
                className={`relative z-10 px-3.5 py-1 rounded-full text-xs font-bold tracking-wider transition-colors duration-200 ${
                  lang === "en" ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>
    </LanguageContext.Provider>
  )
}
