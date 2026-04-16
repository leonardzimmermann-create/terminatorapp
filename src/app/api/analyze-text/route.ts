import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const AZURE_ENDPOINT = 'https://openai-terminator.openai.azure.com/openai/deployments/gpt-5.4-nano/chat/completions?api-version=2024-12-01-preview'
const AZURE_KEY = '8WBhgNIiXU6YIiFEA8o0qJhBMzkzCZ30p3pDTcJQuBGUiZQt5b5gJQQJ99CDACPV0roXJ3w3AAABACOGghUS'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { html, subject } = await req.json()
  const text = stripHtml(html || '')

  if (!text) return NextResponse.json({ error: 'Kein Text vorhanden' }, { status: 400 })

  const prompt = `Du bist ein wohlwollender Coach für Business-Kommunikation. Analysiere folgende deutsche Termineinladung.

Wichtiger Kontext:
- Der Text wird als Beschreibung einer Microsoft Teams Kalendereinladung verschickt. Datum, Uhrzeit und Terminlink sind bereits in der Einladung enthalten – kritisiere das NICHT.
- Ausdrücke wie {{anrede}}, {{vorname}}, {{nachname}}, {{firmenname}} sind Template-Variablen die automatisch ersetzt werden – kein Fehler, sondern gewollt.
- Es handelt sich um einen Massenversand-Template – fehlende Individualität ist kein Mangel.
- Dies ist nur Betreff und Texttemplate der Einladung. Die Signatur (Name, Kontakt, etc.) wird separat automatisch angehängt – kritisiere das Fehlen einer Signatur NICHT.

Betreff: "${subject || '(kein Betreff)'}"

Text:
"""
${text}
"""

Prüfe nur diese drei Kriterien:
1. Termingrund: Wird klar, warum die Einladung verschickt wird?
2. Freundlicher Schluss: Ist eine höfliche Schlussformel vorhanden?
3. Rechtschreibung & Grammatik: Ist der Text sprachlich korrekt? Nur wenn tatsächlich eine gemischte Anrede (z.B. „Sie" und „du" im selben Text) oder ein echter Rechtschreibfehler vorkommt, darauf hinweisen – NICHT präventiv warnen wenn alles korrekt ist.

Gib zuerst einen konkreten lobenden Satz zurück, der explizit hervorhebt was der User in diesem Text besonders gut macht – nenne ein spezifisches Stärke aus dem Text (z.B. „Dein Einstieg mit dem LinkedIn-Bezug wirkt sofort persönlich" oder „Der Nutzen für den Empfänger ist klar auf den Punkt gebracht"). Kein generisches Lob. Dann 1 bis 3 Verbesserungsvorschläge – aber nur wenn wirklich relevant. Sei sparsam: lieber 1 wichtiger Hinweis als 3 erzwungene. Nur echte Schwächen nennen (z.B. inkonsistente Anrede, fehlender Termingrund, unklarer Betreff). Die Vorschläge sollen machbar und motivierend klingen, nicht kritisch.

Antworte ausschließlich mit einem JSON-Objekt (kein Markdown, kein Codeblock):
{"motivation": "<1 lobender, motivierender Satz>", "suggestions": ["<Verbesserung 1>", "<Verbesserung 2>", "<Verbesserung 3>"]}`

  try {
    const response = await fetch(AZURE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Du bist ein motivierender Coach für Business-Kommunikation. Antworte ausschließlich mit validem JSON.' },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 400,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Azure OpenAI error:', err)
      return NextResponse.json({ error: 'AI-Analyse fehlgeschlagen' }, { status: 500 })
    }

    const data = await response.json()
    const content: string = data.choices?.[0]?.message?.content ?? ''

    if (!content) {
      console.error('Unexpected Azure response shape:', JSON.stringify(data).slice(0, 500))
      return NextResponse.json({ error: 'Ungültige AI-Antwort' }, { status: 500 })
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'JSON nicht parsebar' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    const suggestions: string[] = Array.isArray(result.suggestions) ? result.suggestions.slice(0, 3) : []

    return NextResponse.json({
      motivation: String(result.motivation),
      suggestions,
    })
  } catch (e) {
    console.error('Analyze error:', e)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500 })
  }
}
