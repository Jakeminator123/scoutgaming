import type { Metadata } from "next"
import { ApiAdmin } from "@/components/ops/api-admin"

export const metadata: Metadata = { title: "API & integrationer · scout/gaming" }

export default function Page() {
  return <ApiAdmin />
}
