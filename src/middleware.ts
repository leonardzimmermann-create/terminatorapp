import { withAuth } from 'next-auth/middleware'

export default withAuth({
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/',
  },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
  matcher: ['/app/:path*'],
}
