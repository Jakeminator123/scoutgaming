import type { Metadata } from "next"
import { PaymentsAdmin } from "@/components/ops/payments-admin"

export const metadata: Metadata = { title: "Betalningar & journal · scout/gaming" }

export default function Page() {
  return <PaymentsAdmin />
}
