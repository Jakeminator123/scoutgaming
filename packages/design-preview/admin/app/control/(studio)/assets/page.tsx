import type { Metadata } from "next"
import { AssetLibrary } from "@/components/studio/asset-library"

export const metadata: Metadata = {
  title: "Bord & bakgrunder · Croupier Studio",
}

export default function AssetsPage() {
  return (
    <>
      <header className="border-b border-sg-line px-6 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">{"// Studio · Bord & bakgrunder"}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Bord & bakgrunder</h1>
        <p className="mt-1 max-w-2xl text-sm text-sg-muted">
          Lägg upp bilder eller loopar genom att dra in dem. Dubbletter stoppas automatiskt. Välj vilka grundloopar som
          får användas med varje tillgång – dealerns sammansättning väljs på klippkartan.
        </p>
      </header>
      <AssetLibrary />
    </>
  )
}
