import type { Metadata } from "next"
import { OperatorsAdmin } from "@/components/ops/operators-admin"

export const metadata: Metadata = { title: "Spelbolag · scout/gaming" }

export default function Page() {
  return <OperatorsAdmin />
}
