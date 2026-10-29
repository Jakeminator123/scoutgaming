import {useId,useRef,useState} from 'react';
import {ImageDown} from 'lucide-react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {validateProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type {VideoInventory} from '../../lib/connected-studio.mjs';
import {useScenePreviewMedia} from '../../lib/scene-preview-media.mjs';
import {exportSceneIllustration} from '../../lib/scene-export.mjs';
import {Button} from '../ui/kit';
import {Label,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '../ui/form';

const NONE='none';
export const environmentPictureLabel='Miljöbild – visas i lobbyn och Admin, aldrig i spelet';

/** The environment's miljöbild: choose one of its exported pictures, or export the saved scene as a new one.
 * The export renders the saved environment on the server and only adds a material; the choice is a draft edit
 * (saved with Spara utkast), and older pictures stay in the library. */
export function EnvironmentPicture({project,savedProject,inventory,laneId,blocked,dirty,onEdit,onExported}:{project:StudioProject;savedProject:StudioProject|null;inventory:VideoInventory;laneId:string;blocked:boolean;dirty:boolean;onEdit:(project:StudioProject)=>void;onExported:(remote:StudioProject,id:string)=>void}) {
  const id=useId(),lane=project.lanes?.find(row=>row.id===laneId),savedLane=savedProject?.lanes?.find(row=>row.id===laneId);
  const pictures=(project.layerAssets??[]).filter(row=>row.role==='illustration');
  const chosen=pictures.find(row=>row.id===lane?.illustration);
  // The dealer the saved environment starts with, through its idle clip: the frame the server keys and places.
  const {video}=useScenePreviewMedia({project:savedProject??undefined,inventory,lane:savedLane,game:'blackjack'});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const running=useRef<AbortController|null>(null);
  if(!lane)return null;
  function choose(value:string){
    if(blocked||busy||!lane)return;
    const next={...lane};if(value===NONE)delete next.illustration;else next.illustration=value;
    try{onEdit(validateProject({...project,lanes:project.lanes?.map(row=>row.id===lane.id?next:row)}));setError('');setMessage('');}
    catch(cause){setError((cause as Error).message);}
  }
  async function exportNow(){
    if(blocked||busy||dirty||!savedProject||!savedLane)return;
    const controller=new AbortController();running.current?.abort();running.current=controller;
    setBusy(true);setError('');setMessage('');
    try{
      const result=await exportSceneIllustration({laneId:savedLane.id,expectedRevision:savedProject.revision,video:video?{id:video.id,previewUrl:video.previewUrl}:null,signal:controller.signal});
      if(controller.signal.aborted)return;
      onExported(result.project,result.id);
      const left=[result.dealer==='missing'?'dealern (viloklippet kunde inte läsas här)':'',...result.skipped.map(role=>role==='background'?'videobakgrunden':'bordsvideon')].filter(Boolean);
      setMessage(`${result.label} är sparad som material och vald i utkastet. Spara utkastet för att använda den.${left.length?' Utan '+left.join(' och ')+'.':''}`);
    }catch(cause){if(!controller.signal.aborted)setError((cause as Error).message);}
    finally{if(running.current===controller){running.current=null;setBusy(false);}}
  }
  const hint=dirty?'Spara utkastet först, så blir bilden det du ser.':'Ritar den sparade scenen för dator, 1920 × 1080, med bakgrund, bordsgrafik och dealer på sin placering.';
  return <section aria-label="Miljöbild" className="grid gap-3">
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{environmentPictureLabel}</Label>
      <Select value={chosen?.id??NONE} onValueChange={choose} disabled={blocked||busy}>
        <SelectTrigger id={id} className="max-w-md"><SelectValue/></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Ingen miljöbild</SelectItem>
          {pictures.map(row=><SelectItem key={row.id} value={row.id}>{row.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {chosen?<img src={'/studio/api/layer-assets/'+encodeURIComponent(chosen.id)} alt={'Miljöbild för '+lane.label} loading="lazy" className="aspect-video w-full max-w-xl rounded-[10px] border border-sg-border bg-sg-surface-2 object-cover"/>
      :<p className="m-0 text-[12.5px] text-sg-muted">Utan miljöbild visar lobbyn den publicerade bakgrunden.</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" disabled={blocked||busy||dirty||!savedLane} aria-describedby={id+'-export'} onClick={()=>void exportNow()}><ImageDown aria-hidden="true"/>{busy?'Exporterar…':'Exportera miljöbild'}</Button>
      <span id={id+'-export'} className="text-[12.5px] text-sg-muted">{hint}</span>
    </div>
    {message&&<p role="status" className="m-0 text-[13px] text-sg-muted">{message}</p>}
    {error&&<p role="alert" className="m-0 text-[13px] text-sg-danger">{error}</p>}
  </section>;
}
