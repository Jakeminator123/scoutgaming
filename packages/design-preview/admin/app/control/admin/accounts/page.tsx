import type { Metadata } from "next"
import { AccountsAdmin } from "@/components/ops/accounts-admin"

export const metadata: Metadata = { title: "Konton & åtkomst · scout/gaming" }

export default function Page() {
  return <AccountsAdmin />
}
