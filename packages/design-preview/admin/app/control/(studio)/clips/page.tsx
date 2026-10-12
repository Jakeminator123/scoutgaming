import { StudioHeader } from "@/components/studio/studio-header"
import { ClipCanvas } from "@/components/studio/clip-canvas"

export default function ClipsPage() {
  return (
    <>
      <StudioHeader />
      <section aria-label="Klippkarta" className="min-h-0 flex-1">
        <ClipCanvas />
      </section>
    </>
  )
}
