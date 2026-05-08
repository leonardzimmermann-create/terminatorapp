"use client"

import { useState } from "react"
import SendCharts from "./SendCharts"
import AdminTable from "./AdminTable"

type Invitation = {
  id: number
  leadEmail: string
  leadName: string
  response: string
  slotStart: string | Date | null
  slotEnd: string | Date | null
}

type Log = {
  id: number
  userEmail: string
  sentAt: Date | string
  totalLeads: number
  successCount: number
  failedCount: number
  acceptedCount: number | null
  declinedCount: number | null
  tentativeCount: number | null
  subject: string | null
  eventBody: string | null
  signature: string | null
  invitations: Invitation[]
}

export default function VersandClient({
  logs,
  isAdmin,
  currentUserEmail,
}: {
  logs: Log[]
  isAdmin: boolean
  currentUserEmail: string
}) {
  const [domainFilter, setDomainFilter] = useState("")

  return (
    <>
      <SendCharts logs={logs} isAdmin={isAdmin} domainFilter={domainFilter} onDomainFilterChange={setDomainFilter} />
      <AdminTable logs={logs} currentUserEmail={currentUserEmail} domainFilter={isAdmin ? domainFilter : undefined} />
    </>
  )
}
