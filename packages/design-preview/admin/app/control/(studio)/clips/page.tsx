import { StudioHeader } from "@/components/studio/studio-header"
import { ClipCanvas } from "@/components/studio/clip-canvas"
import { useState } from "react"
import { DealerAssistantShell } from "@/components/studio/dealer-assistant-shell"
import { useRouter } from "next/navigation"
import { StudioProvider } from "@/components/studio/studio-provider"
import { HierarchyBar } from "@/components/studio/hierarchy-bar"

export default function ClipsPage({active=true}:{active?:boolean} = {}) {
  const [tab,setTab] = useState<'import'|'map'>('import')
  const [mapStarted,setMapStarted] = useState(false)
  const router=useRouter()
  return (
    <>
      <nav className="dealer-import-tabs" aria-label="Klippverktyg" hidden={!active}>
        <button aria-pressed={tab==='import'} onClick={()=>setTab('import')}>Importassistent · klippbank</button>
        <button aria-pressed={tab==='map'} onClick={()=>{setMapStarted(true);setTab('map');}}>Klippkarta · designexempel</button>
      </nav>
      <DealerAssistantShell pageAvailable={active&&tab==='import'} onShowPage={()=>{setTab('import');if(!active)router.push('/control/clips');}}/>
      {mapStarted&&<div hidden={!active||tab!=='map'} className="dealer-import-map"><StudioProvider>
        <p className="dealer-import-design-note" role="note">Designexempel · Klippkartan är simulerad. Ändringarna här påverkar inga riktiga register. Importassistenten har en separat anslutning till klippbanken.</p>
        <HierarchyBar /><StudioHeader />
        <section aria-label="Klippkarta" className="min-h-0 flex-1"><ClipCanvas /></section>
      </StudioProvider></div>}
    </>
  )
}
