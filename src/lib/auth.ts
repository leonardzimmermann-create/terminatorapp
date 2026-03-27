import NextAuth from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import AzureADProvider from 'next-auth/providers/azure-ad'

async function refreshAccessToken(token: JWT): Promise<JWT> {
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
        refresh_token: token.refreshToken as string,
        scope: 'openid profile email offline_access Calendars.ReadWrite User.Read',
      }),
    })

    const refreshed = await response.json()
    if (!response.ok) throw refreshed

    return {
      ...token,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      error: undefined,
    }
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' }
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
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return `${baseUrl}/app`
    },
    async jwt({ token, account }) {
      // Erstes Login — Token speichern
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        }
      }

      // Token noch gültig (30s Puffer)
      if (Date.now() < ((token.expiresAt as number) * 1000 - 30_000)) {
        return token
      }

      // Token abgelaufen — erneuern
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token?.accessToken as string | undefined
      return session
    },
  },
}

export const handler = NextAuth(authOptions)
