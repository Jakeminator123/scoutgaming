import { StudioHeader } from "@/components/studio/studio-header"
import { ClipCanvas } from "@/components/studio/clip-canvas"
import { useState } from "react"
import { DealerImportAssistant } from "@/components/studio/dealer-import-assistant"
import { StudioProvider } from "@/components/studio/studio-provider"
import { HierarchyBar } from "@/components/studio/hierarchy-bar"

export default function ClipsPage({active=true}:{active?:boolean} = {}) {
  const [tab,setTab] = useState<'import'|'map'>('import')
  return (
    <>
      <nav className="dealer-import-tabs" aria-label="Klippverktyg">
        <button aria-pressed={tab==='import'} onClick={()=>setTab('import')}>Importassistent · klippbank</button>
        <button aria-pressed={tab==='map'} onClick={()=>setTab('map')}>Klippkarta · designexempel</button>
      </nav>
      <div hidden={tab!=='import'}><DealerImportAssistant active={active} /></div>
      <div hidden={tab!=='map'} className="dealer-import-map"><StudioProvider>
        <p className="dealer-import-design-note" role="note">Designexempel · Klippkartan är simulerad. Ändringarna här påverkar inga riktiga register. Importassistenten har en separat anslutning till klippbanken.</p>
        <HierarchyBar /><StudioHeader />
        <section aria-label="Klippkarta" className="min-h-0 flex-1"><ClipCanvas /></section>
      </StudioProvider></div>
    </>
  )
}
