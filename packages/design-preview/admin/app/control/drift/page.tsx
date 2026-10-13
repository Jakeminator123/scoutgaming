import type { Metadata } from "next"
import { DriftView } from "@/components/ops/drift-view"

export const metadata: Metadata = { title: "Drift · scout/gaming" }

export default function Page() {
  return <DriftView />
}
