"use client"

import {useEffect,useState} from 'react'
import {dealerVoiceProfileView,validElevenLabsModelId,validElevenLabsVoiceId,DEALER_VOICE_DEFAULT_MODEL} from '../../../../../../packages/presentation/contracts/dealer-voice-profile.mjs'
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs'

const errors:Record<string,string>={
  studio_conflict:'Projektet har ändrats sedan det lästes. Läs om och försök igen.',
  studio_dealer_voice_invalid:'Röstprofilen godtogs inte. Kontrollera röst-ID och modell.',
  studio_dealer_missing:'Dealern finns inte längre i projektet.',
  studio_login_required:'Logga in igen.',
  studio_request_rejected:'Du saknar behörighet att ändra röstprofilen.',
}
async function saveVoice(body:unknown):Promise<{project:StudioProject}>{
  const response=await fetch('/studio/api/dealers/voice',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const result=await response.json().catch(()=>({}))
  if(!response.ok||!result.project)throw Error(errors[result.code]??errors[result.error]??'Röstprofilen kunde inte sparas.')
  return result
}

/** Röstprofil: the dealer's saved ElevenLabs voice in the Studio project.
 * Saving writes the server document directly (journalled), never the draft. */
export function DealerVoiceProfile({project,dealer,blocked=false,projectDirty=false,onSaved}:{project:StudioProject;dealer:StudioProject['dealers'][number];blocked?:boolean;projectDirty?:boolean;onSaved:(project:StudioProject)=>void}){
  const view=dealerVoiceProfileView(dealer)
  const [editing,setEditing]=useState(false),[voiceId,setVoiceId]=useState(''),[modelId,setModelId]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  useEffect(()=>{setEditing(false);setError('');setNotice('')},[dealer.id])
  const id=voiceId.trim(),model=modelId.trim()
  const formError=!id?'':!validElevenLabsVoiceId(id)?'Ett ElevenLabs-röst-ID är 20 bokstäver och siffror.':model&&!validElevenLabsModelId(model)?'Modellen ska börja med eleven_, till exempel eleven_v3.':''
  const disabled=blocked||busy||projectDirty
  async function submit(voice:{provider:'elevenlabs';voiceId:string;modelId?:string}){
    if(disabled)return
    setBusy(true);setError('');setNotice('')
    try{const result=await saveVoice({dealerId:dealer.id,expectedRevision:project.revision,voice});onSaved(result.project);setEditing(false);setNotice('Röstprofilen är sparad.')}
    catch(cause){setError(cause instanceof Error?cause.message:'Röstprofilen kunde inte sparas.')}
    finally{setBusy(false)}
  }
  function open(){setVoiceId(view.provider==='elevenlabs'?view.voiceId??'':'');setModelId(view.provider==='elevenlabs'?view.modelId??'':'');setError('');setNotice('');setEditing(true)}
  return <section className="mt-4 space-y-2 rounded-lg border border-border p-3" aria-label="Röstprofil" data-voice-source={view.source}>
    <p className="text-sm"><strong>Röstprofil:</strong> {view.voiceId?<>{view.name??'Egen röst'} · ID <code data-field="voice-profile-current" className="break-all">{view.voiceId}</code></>:'Ingen röstprofil'}</p>
    {view.voiceId&&<p className="text-xs text-muted-foreground">{view.provider==='elevenlabs'?'ElevenLabs':view.provider==='cartesia'?'Cartesia':view.provider} · modell {view.modelId} · {view.source==='saved'?'sparad i projektet':'förslag från röstkatalogen, inte sparad'}</p>}
    {projectDirty&&<p className="text-xs text-muted-foreground">Spara eller återställ utkastet först. Röstprofilen sparas direkt i projektet.</p>}
    {!editing&&<div className="flex flex-wrap gap-2">
      <button className="studio-button" type="button" data-action="edit-voice" disabled={disabled} onClick={open}>Ändra</button>
      {view.source==='catalog'&&view.provider==='elevenlabs'&&<button className="studio-button" type="button" data-action="save-suggested-voice" disabled={disabled} onClick={()=>void submit({provider:'elevenlabs',voiceId:view.voiceId!,modelId:view.modelId!})}>Spara förslaget</button>}
    </div>}
    {editing&&<form className="space-y-2" onSubmit={event=>{event.preventDefault();if(id&&!formError)void submit({provider:'elevenlabs',voiceId:id,...(model?{modelId:model}:{})})}}>
      <label className="studio-field">ElevenLabs röst-ID<input data-field="voice-profile-id" value={voiceId} onChange={event=>setVoiceId(event.target.value)} maxLength={20} autoComplete="off" spellCheck={false} placeholder="20 tecken, ingen API-nyckel"/></label>
      <label className="studio-field">Modell (valfri)<input data-field="voice-profile-model" value={modelId} onChange={event=>setModelId(event.target.value)} maxLength={67} autoComplete="off" spellCheck={false} placeholder={DEALER_VOICE_DEFAULT_MODEL}/></label>
      {formError&&<p role="alert" className="text-xs text-red-400">{formError}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="studio-button" type="submit" data-action="save-voice" disabled={disabled||!id||Boolean(formError)}>Spara röstprofil</button>
        <button className="studio-button" type="button" data-action="cancel-voice" disabled={busy} onClick={()=>setEditing(false)}>Avbryt</button>
      </div>
      <p className="text-xs text-muted-foreground">Gäller dealerns genererade tal. Ett pågående tal stoppas och den nya rösten kontrolleras före nästa replik. Inget publiceras.</p>
    </form>}
    {busy&&<p role="status" className="text-xs">Sparar röstprofilen…</p>}{notice&&<p role="status" className="text-xs">{notice}</p>}{error&&<p role="alert" className="text-xs text-red-400">{error}</p>}
  </section>
}
