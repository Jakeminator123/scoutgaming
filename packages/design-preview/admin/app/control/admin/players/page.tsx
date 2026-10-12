import type { Metadata } from "next"
import { PlayersAdmin } from "@/components/ops/players-admin"

export const metadata: Metadata = { title: "Spelare & integritet · scout/gaming" }

export default function Page() {
  return <PlayersAdmin />
}
