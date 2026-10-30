import {useRef,useState} from 'react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {filmedProfileFor} from '../../../../../../packages/presentation/contracts/filmed-profiles/studio-profile.mjs';
import {nativeFilmedBankState} from '../../../../../../packages/presentation/contracts/filmed-bank-bindings.mjs';
import {importDealerFilmedProfile,readFilmedProfileFile} from '../../lib/dealer-filmed-profile.mjs';
import type {Workspace} from '../../lib/connected-studio.mjs';
import {Button,Footnote} from '../ui/kit';

type Props={dealerId:string;workspace:Workspace|null;saved:StudioProject|null;onSaved?:()=>void};
export function DealerFilmedProfilePanel({dealerId,workspace,saved,onSaved}:Props){
  const [pending,setPending]=useState<Awaited<ReturnType<typeof readFilmedProfileFile>>|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const lock=useRef(false),readId=useRef(0);
  const profile=saved?filmedProfileFor(dealerId,{project:saved}):null;
  const seed=Boolean(profile&&!saved?.dealers.find(row=>row.id===dealerId)?.filmedProfile);
  const dirty=Boolean(workspace&&saved&&JSON.stringify(workspace.project)!==JSON.stringify(saved));
  const bank=saved&&workspace?nativeFilmedBankState(saved,workspace.inventory,dealerId):null;
  async function choose(file?:File){
    const id=++readId.current;setPending(null);setError('');setNotice('');
    if(!file)return;
    try{const value=await readFilmedProfileFile(file);if(id===readId.current)setPending(value);}
    catch(cause){if(id===readId.current)setError((cause as Error).message);}
  }
  async function save(){
    if(lock.current||!pending||!saved||dirty||seed)return;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      await importDealerFilmedProfile(dealerId,saved.revision,pending);
      setPending(null);setNotice('Profilen är sparad. Koppla givbanken på Klippkarta och publicera spelbordet när klippen är granskade.');onSaved?.();
    }catch(cause){setError((cause as Error).message);}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className="grid gap-3">
    <p className="m-0 text-sm">{profile?`${profile.takes.length} tagningar i ${seed?'källprofilen':'dealerns sparade profil'}.`:'Ingen egen filmad profil har sparats.'}</p>
    {bank&&<p className="m-0 text-xs text-sg-muted">{bank.complete?'Alla givklipp som kan behövas finns i biblioteket.':`Givbanken behöver kompletteras: ${bank.missing.join(', ')||bank.reason||'kontrollera klippen'}.`}</p>}
    {!seed&&<>
      <label className="grid gap-1.5 text-sm">Profil från dealerfabriken
        <input type="file" accept=".json,application/json" disabled={busy||dirty||!saved} onChange={event=>void choose(event.target.files?.[0])}/>
      </label>
      {pending&&<p className="m-0 text-xs text-sg-muted">{pending.takes.length} tagningar · källa {pending.derivedFrom}. Klippen, rutnumren och poserna kontrolleras vid importen.</p>}
      <div><Button disabled={busy||dirty||!saved||!pending} onClick={()=>void save()}>{busy?'Importerar…':'Importera profil'}</Button></div>
      {dirty&&<p role="status" className="m-0 text-xs text-sg-warn">Spara eller ångra ändringarna i klippkartan innan du importerar en profil.</p>}
      <Footnote>Ladda upp och mät klippen först. Importen sparar landningar och rörelsekällor. Granska kortkontakt och läppsynk före publicering.</Footnote>
    </>}
    {error&&<p role="alert" className="m-0 text-sm text-sg-danger">{error}</p>}
    {notice&&<p role="status" className="m-0 text-sm text-sg-ok">{notice}</p>}
  </div>;
}
