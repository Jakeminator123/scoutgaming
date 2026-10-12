import type { Metadata } from "next"
import { AuditView } from "@/components/ops/audit-view"

export const metadata: Metadata = { title: "Protokoll · scout/gaming" }

export default function Page() {
  return <AuditView />
}
