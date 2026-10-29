import {Chip,Note} from '../ui/hub';
import {Button,Footnote} from '../ui/kit';
import {ASSIGNMENT_ALLOW_KEYS,allowLocked,assignmentDirty,assignmentDraft,assignmentLabel,assignmentProblem,toggleAllow,toggleListItem} from '../../../../lib/operator-assignment-client.mjs';

export type AssignmentView={allow:Record<string,boolean>;adjustable:Record<string,boolean>;limitPresets:string[];languages:string[];options:{limitPresets:string[];languages:string[]}};
export type AssignmentDraft=ReturnType<typeof assignmentDraft>;
type Props={revision:number|null|undefined;view:AssignmentView|null|undefined;draft:AssignmentDraft;onDraft:(update:(current:AssignmentDraft)=>AssignmentDraft)=>void;disabled:boolean};

const choice='flex cursor-pointer items-start gap-3 rounded-xl border border-sg-border bg-sg-surface p-3 text-[13px] leading-snug transition-colors hover:bg-sg-surface-2 has-[:checked]:border-sg-text has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 [&_input]:mt-0.5 [&_input]:size-4 [&_input]:accent-[var(--sg-ink)]';
const hints:Record<string,string>={dealer:'Bolaget väljer dealer bland de tilldelade',tableAsset:'Bolaget väljer bordsgrafik i miljön',background:'Bolaget väljer bakgrund i miljön',
  language:'Bolaget väljer bordsspråk bland språken nedan',limit:'Bolaget väljer insatsprofil bland profilerna nedan',pause:'Bolaget pausar och öppnar egna spelbord'};

// Bolag › Tilldelat: vad bolaget får ändra själv (allow) och vilka insatsprofiler och språk det
// väljer bland. Utkastet ägs av tilldelningens form (registered-studio.tsx), som publicerar det med samma
// knapp som urvalet, som en ny paketrevision; servern kontrollerar behörighet och miljö igen.
export function AssignmentField({revision,view,draft,onDraft,disabled}:Props) {
  if(view===undefined)return null;
  if(!view||revision==null)return <Note>Bolaget har ingen publicerad miljö ännu. Välj miljöer ovan och publicera, sedan kan du låsa upp val här.</Note>;
  const dirty=assignmentDirty(view,draft),problem=dirty?assignmentProblem(view,draft):'';
  return <div className="grid gap-3 border-t border-sg-line-2 pt-4" data-assignment="">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="m-0 text-[14px] font-semibold">Tilldelat bolaget</h4>{dirty?<Chip tone="warn">ändrat, inte publicerat</Chip>:<Chip tone="ok">publicerat</Chip>}</div>
    <fieldset className="m-0 border-0 p-0" disabled={disabled}>
      <legend className="mb-2 text-[13px] font-semibold text-sg-text">Bolaget får ändra själv</legend>
      <div className="grid gap-2 sm:grid-cols-2" data-assignment="allow">
        {ASSIGNMENT_ALLOW_KEYS.map(key=>{const locked=allowLocked(view,key);return <label key={key} className={choice}>
          <input type="checkbox" name={'allow-'+key} checked={draft.allow[key]===true} disabled={locked&&draft.allow[key]!==true} onChange={event=>{const on=event.target.checked;onDraft(current=>toggleAllow(current,key,on));}}/>
          <span><span className="block font-semibold">{assignmentLabel(key)}</span><span className="text-sg-muted">{locked?'Låst i miljön':hints[key]}</span></span></label>;})}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(['limitPresets','languages'] as const).map(list=><div key={list} data-assignment={list}>
          <div className="mb-2 text-[13px] font-semibold text-sg-text">{list==='limitPresets'?'Insatsprofiler att välja bland':'Språk att välja bland'}</div>
          <div className="grid gap-2">{view.options[list].map(id=><label key={id} className={choice}>
            <input type="checkbox" name={list+'-'+id} checked={draft[list].includes(id)} onChange={event=>{const on=event.target.checked;onDraft(current=>toggleListItem(current,list,id,on,view.options[list]));}}/>
            <span className="font-semibold">{assignmentLabel(id)}</span></label>)}</div>
        </div>)}
      </div>
      {dirty&&<p className="m-0 mt-3"><Button size="sm" onClick={()=>onDraft(()=>assignmentDraft(view))}>Ångra</Button></p>}
    </fieldset>
    {problem&&<p role="alert" className="m-0 text-[13px] text-sg-warn">{problem}</p>}
    <Footnote className="mt-0">Dealer, bordsgrafik och bakgrund kan bara låsas upp där miljön tillåter det. Språk och insatsprofil gäller spelbordens spelinställningar.</Footnote>
  </div>;
}
