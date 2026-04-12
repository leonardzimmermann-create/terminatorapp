import NextAuth from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = 'leonard.zimmermann@smartflow-consulting.com'

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_at: number } | null> {
  try {
    const tenantId = process.env.AZURE_AD_TENANT_ID || 'organizations'
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID || '',
        client_secret: process.env.AZURE_AD_CLIENT_SECRET || '',
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'openid profile email offline_access Calendars.ReadWrite User.Read',
      }),
    })

    const refreshed = await response.json()
    if (!response.ok) throw refreshed

    return {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    }
  } catch {
    return null
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      tenantId: process.env.AZURE_AD_TENANT_ID || 'organizations',
      authorization: {
        params: {
          scope: 'openid profile email offline_access Calendars.ReadWrite User.Read',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/' },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false
      try {
        const blocked = await prisma.blacklistEntry.findUnique({ where: { email: user.email } })
        if (blocked) return '/not-authorized'

        // Seats-Check: nur für neue User (nicht bereits registrierte)
        const domain = user.email.split('@')[1]
        if (domain && domain !== ADMIN_EMAIL.split('@')[1]) {
          const domainLimit = await prisma.domainLimit.findUnique({ where: { domain } })
          if (domainLimit?.userLimit) {
            const existingUser = await prisma.user.findUnique({ where: { email: user.email } })
            if (!existingUser) {
              const userCount = await prisma.user.count({ where: { email: { endsWith: `@${domain}` } } })
              if (userCount >= domainLimit.userLimit) return '/seats-exceeded'
            }
          }
        }

        // Upsert user in DB
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          create: { email: user.email, name: user.name ?? null },
          update: { name: user.name ?? null },
        })

        // Store tokens in Account table (not in cookie)
        if (account) {
          await prisma.account.upsert({
            where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
            create: {
              userId: dbUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token ?? null,
              refresh_token: account.refresh_token ?? null,
              expires_at: account.expires_at ?? null,
              ext_expires_in: (account.ext_expires_in as number) ?? null,
              token_type: account.token_type ?? null,
              scope: account.scope ?? null,
              id_token: account.id_token ?? null,
            },
            update: {
              access_token: account.access_token ?? null,
              refresh_token: account.refresh_token ?? null,
              expires_at: account.expires_at ?? null,
            },
          })
        }

        await prisma.loginEvent.create({ data: { userEmail: user.email, userName: user.name ?? null } })
      } catch (e) {
        console.error('[signIn] DB error:', e)
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return `${baseUrl}/app`
    },
    async jwt({ token }) {
      // Tokens are stored in DB — keep JWT cookie small
      return token
    },
    async session({ session, token }) {
      if (token.email) {
        try {
          const account = await prisma.account.findFirst({
            where: { user: { email: token.email }, provider: 'azure-ad' },
          })
          if (account?.access_token) {
            const isExpired = account.expires_at && Date.now() / 1000 > account.expires_at - 30
            if (isExpired && account.refresh_token) {
              const refreshed = await refreshAccessToken(account.refresh_token)
              if (refreshed) {
                await prisma.account.update({
                  where: { id: account.id },
                  data: { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: refreshed.expires_at },
                })
                session.accessToken = refreshed.access_token
              }
            } else {
              session.accessToken = account.access_token
            }
          }
        } catch (e) {
          console.error('[session] DB error:', e)
        }
      }
      return session
    },
  },
}

export const handler = NextAuth(authOptions)
