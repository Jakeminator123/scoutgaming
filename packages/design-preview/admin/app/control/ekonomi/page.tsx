import type { Metadata } from "next"
import { EconomyView } from "@/components/ops/economy-view"

export const metadata: Metadata = { title: "Ekonomi · scout/gaming" }

export default function Page() {
  return <EconomyView />
}
