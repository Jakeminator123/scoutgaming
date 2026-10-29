import {useEffect,useRef,useState} from 'react';
import {Card,Chip,Note} from '../ui/hub';
import {Button,Footnote,cn} from '../ui/kit';
import {labBasePath} from '../../../../lib/lab-url.mjs';
import {ASSIGNMENT_ALLOW_KEYS,allowLocked,assignmentDirty,assignmentDraft,assignmentLabel,assignmentProblem,publishAssignment,toggleAllow,toggleListItem} from '../../../../lib/operator-assignment-client.mjs';

export type AssignmentView={allow:Record<string,boolean>;adjustable:Record<string,boolean>;limitPresets:string[];languages:string[];options:{limitPresets:string[];languages:string[]}};
type Props={operatorId:string;revision:number|null;view:AssignmentView|null|undefined;disabled:boolean;onChanged:()=>void};

const choice='flex cursor-pointer items-start gap-3 rounded-xl border border-sg-border bg-sg-surface p-3 text-[13px] leading-snug transition-colors hover:bg-sg-surface-2 has-[:checked]:border-sg-text has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 [&_input]:mt-0.5 [&_input]:size-4 [&_input]:accent-[var(--sg-ink)]';
const hints:Record<string,string>={dealer:'Bolaget väljer dealer bland de tilldelade',tableAsset:'Bolaget väljer bordsgrafik i miljön',background:'Bolaget väljer bakgrund i miljön',
  language:'Bolaget väljer bordsspråk bland språken nedan',limit:'Bolaget väljer insatsprofil bland profilerna nedan',pause:'Bolaget pausar och öppnar egna spelbord'};

// Bolag › Tilldelat: vad bolaget får ändra själv (allow) och vilka insatsprofiler och språk det
// väljer bland. Publiceras som en ny paketrevision; servern kontrollerar behörighet och miljö igen.
export function AssignmentField({operatorId,revision,view,disabled,onChanged}:Props) {
  const [draft,setDraft]=useState(()=>assignmentDraft(view));
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const lock=useRef(false),seen=useRef(JSON.stringify([operatorId,revision,view??null]));
  // En ny publicerad revision (eller ett annat bolag) ersätter utkastet.
  useEffect(()=>{const key=JSON.stringify([operatorId,revision,view??null]);if(seen.current!==key){seen.current=key;setDraft(assignmentDraft(view));setError('');}},[operatorId,revision,view]);
  if(view===undefined)return null;
  if(!view||revision===null)return <Card title="Tilldelat bolaget"><Note>Bolaget har ingen publicerad miljö ännu. Välj miljöer nedan och publicera, sedan kan du låsa upp val här.</Note></Card>;
  const dirty=assignmentDirty(view,draft),problem=dirty?assignmentProblem(view,draft):'';
  async function publish() {
    if(!view||revision===null||!dirty||problem||disabled||lock.current)return;
    lock.current=true;setBusy(true);setMessage('');setError('');
    try {
      const result=await publishAssignment({endpoint:labBasePath()+'/api/admin/operator-package',operatorId,revision,draft,fetchImpl:fetch});
      if(!result.ok){setError(result.error);if(result.needsRefresh)onChanged();return;}
      setMessage(`Tilldelningen är publicerad. Version ${result.revision}.`);onChanged();
    } finally {lock.current=false;setBusy(false);}
  }
  return <Card title="Tilldelat bolaget" aside={dirty?<Chip tone="warn">ändrat, inte publicerat</Chip>:<Chip tone="ok">publicerat</Chip>}>
    <fieldset className="m-0 border-0 p-0" disabled={disabled||busy}>
      <legend className="mb-2 text-[13px] font-semibold text-sg-text">Bolaget får ändra själv</legend>
      <div className="grid gap-2 sm:grid-cols-2" data-assignment="allow">
        {ASSIGNMENT_ALLOW_KEYS.map(key=>{const locked=allowLocked(view,key);return <label key={key} className={choice}>
          <input type="checkbox" name={'allow-'+key} checked={draft.allow[key]===true} disabled={locked&&draft.allow[key]!==true} onChange={event=>setDraft(current=>toggleAllow(current,key,event.target.checked))}/>
          <span><span className="block font-semibold">{assignmentLabel(key)}</span><span className="text-sg-muted">{locked?'Låst i miljön':hints[key]}</span></span></label>;})}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(['limitPresets','languages'] as const).map(list=><div key={list} data-assignment={list}>
          <div className="mb-2 text-[13px] font-semibold text-sg-text">{list==='limitPresets'?'Insatsprofiler att välja bland':'Språk att välja bland'}</div>
          <div className="grid gap-2">{view.options[list].map(id=><label key={id} className={choice}>
            <input type="checkbox" name={list+'-'+id} checked={draft[list].includes(id)} onChange={event=>setDraft(current=>toggleListItem(current,list,id,event.target.checked,view.options[list]))}/>
            <span className="font-semibold">{assignmentLabel(id)}</span></label>)}</div>
        </div>)}
      </div>
    </fieldset>
    {problem&&<p role="alert" className="m-0 mt-3 text-[13px] text-sg-warn">{problem}</p>}
    {error&&<p role="alert" className="m-0 mt-3 text-[13px] text-sg-danger">{error}</p>}
    {message&&!dirty&&<p role="status" className="m-0 mt-3 text-[13px] text-sg-ok">{message}</p>}
    <div className={cn('mt-4 flex flex-wrap items-center gap-2')}>
      <Button variant="primary" disabled={disabled||busy||!dirty||Boolean(problem)} onClick={()=>void publish()}>{busy?'Publicerar…':'Publicera tilldelningen'}</Button>
      {dirty&&<Button disabled={busy} onClick={()=>{setDraft(assignmentDraft(view));setError('');}}>Ångra</Button>}
    </div>
    <Footnote className="mt-3">Publiceringen ger bolaget en ny version av paketet. Dealer, bordsgrafik och bakgrund kan bara låsas upp där miljön tillåter det. Språk och insatsprofil gäller spelbordens spelinställningar.</Footnote>
  </Card>;
}
