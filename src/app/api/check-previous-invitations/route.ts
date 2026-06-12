import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { emails } = await req.json()
  if (!Array.isArray(emails) || emails.length === 0) return NextResponse.json({ previouslySent: {} })

  const userDomain = session.user.email.split("@")[1]

  const invitations = await prisma.sentInvitation.findMany({
    where: {
      leadEmail: { in: emails },
      sendLog: {
        userEmail: { endsWith: `@${userDomain}` },
      },
    },
    select: {
      leadEmail: true,
      sendLog: {
        select: { sentAt: true },
      },
    },
    orderBy: { id: "desc" },
  })

  // Keep only the most recent sentAt per email
  const previouslySent: Record<string, string> = {}
  for (const inv of invitations) {
    if (!previouslySent[inv.leadEmail]) {
      previouslySent[inv.leadEmail] = inv.sendLog.sentAt.toISOString()
    }
  }

  return NextResponse.json({ previouslySent })
}
