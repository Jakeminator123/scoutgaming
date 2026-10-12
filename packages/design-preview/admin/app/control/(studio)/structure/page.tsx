import type { Metadata } from "next"
import { StructureView } from "@/components/studio/structure-view"

export const metadata: Metadata = {
  title: "Struktur · Croupier Studio",
  description: "Spelbolag, spel, rum och dealers i Scout Gaming Croupier Studio.",
}

export default function StructurePage() {
  return <StructureView />
}
