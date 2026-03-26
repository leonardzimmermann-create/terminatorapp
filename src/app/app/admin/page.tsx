import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = 'leonard.zimmermann@smartflow-consulting.com'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) redirect('/app')

  const logs = await prisma.sendLog.findMany({ orderBy: { sentAt: 'desc' } })

  const domainOf = (email: string) => email.split('@')[1] ?? email

  return (
    <main className="min-h-screen p-10">
      <h1 className="text-3xl font-bold mb-2">Admin – Versand-Übersicht</h1>
      <p className="text-sm text-gray-500 mb-6">{logs.length} Versand-Aktionen gesamt</p>

      {logs.length === 0 ? (
        <p className="text-gray-500">Noch keine Versendungen protokolliert.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-3 py-2">Zeitpunkt</th>
                <th className="border px-3 py-2">User</th>
                <th className="border px-3 py-2">Firma (Domain)</th>
                <th className="border px-3 py-2 text-right">Leads</th>
                <th className="border px-3 py-2 text-right">Versendet</th>
                <th className="border px-3 py-2 text-right">Fehler</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="odd:bg-white even:bg-gray-50">
                  <td className="border px-3 py-2 whitespace-nowrap">
                    {new Date(log.sentAt).toLocaleString('de-DE')}
                  </td>
                  <td className="border px-3 py-2">{log.userEmail}</td>
                  <td className="border px-3 py-2">{domainOf(log.userEmail)}</td>
                  <td className="border px-3 py-2 text-right">{log.totalLeads}</td>
                  <td className="border px-3 py-2 text-right text-green-700 font-medium">{log.successCount}</td>
                  <td className="border px-3 py-2 text-right text-red-600">{log.failedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <a href="/app" className="mt-8 inline-block text-blue-600 underline text-sm">
        ← Zurück zur App
      </a>
    </main>
  )
}
