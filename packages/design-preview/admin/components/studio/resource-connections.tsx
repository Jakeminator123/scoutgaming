import { useEffect, useState } from 'react';
import { createStudioClient, roomChoicesPath, type Workspace } from '../../lib/connected-studio.mjs';
import { isActiveOperator } from '../../lib/studio-resource-lifecycle.mjs';

const client=createStudioClient();
const gameName=(id:string)=>({blackjack:'Blackjack',roulette:'Roulette'}[id]??id);
export function ResourceConnections() {
  const [workspace,setWorkspace]=useState<Workspace|null>(null),[error,setError]=useState('');
  const [loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
  useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');
    void client.load(abort.signal).then(value=>{if(!abort.signal.aborted)setWorkspace(value);})
      .catch(cause=>{if(!abort.signal.aborted){setWorkspace(null);setError(cause.message);}})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return ()=>abort.abort();
  },[refresh]);
  const operators=workspace?.catalog.administration.operators.filter(isActiveOperator)??[];
  const names=(ids:string[],role:'dealer'|'asset')=>ids.map(id=>role==='dealer'?workspace?.project.dealers.find(row=>row.id===id)?.label??id:workspace?.project.layerAssets?.find(row=>row.id===id)?.label??id).join(', ')||'Inga val';
  return <section className="dealer-import" aria-labelledby="connections-title">
    <header className="dealer-import-header"><div><p className="dealer-import-eyebrow">Nivå 1 · Spelbolag och material</p><h1 id="connections-title">Kopplingar</h1><p>Spelbolag → spel → rum/bakgrund → dealers och bord. Nivå 1 styr biblioteket och kopplingarna.</p></div><button disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Uppdatera</button></header>
    <div className="dealer-import-actions"><a href="/admin/admin/operators">Hantera spelbolag</a><a href="/admin/dealers">Hantera dealers</a><a href="/admin/assets">Hantera bord och bakgrunder</a></div>
    {loading&&<p role="status">Läser kopplingar…</p>}{error&&<p role="alert">{error}</p>}
    {!loading&&workspace&&!operators.length&&<p>Inga aktiva spelbolag.</p>}
    <ul className="space-y-4" aria-label="Spelbolagens kopplingar">{operators.map(operator=>{
      const rooms=workspace!.catalog.administration.rooms.filter(room=>room.operatorId===operator.id&&room.state!=='archived');
      return <li className="dealer-import-panel" key={operator.id}><h2>{operator.name}</h2><p>{rooms.length} rum</p>
        <ul className="space-y-4 border-l border-sg-line pl-5">{[...new Set(rooms.map(room=>room.game))].map(game=><li key={game}><h3>{gameName(game)}</h3><ul className="grid gap-3 lg:grid-cols-2">{rooms.filter(room=>room.game===game).map(room=>{
          const lane=workspace!.project.lanes?.find(row=>row.id===room.compositionId);
          const uses=workspace!.catalog.administration.rooms.filter(row=>row.state!=='archived'&&row.compositionId===room.compositionId);
          const roomPath=roomChoicesPath(operator,room);
          const edit='/admin/clips?'+new URLSearchParams({operator:operator.id,table:room.id,composition:room.compositionId,game:room.game,panel:'layers'});
          return <li className="rounded border border-sg-line p-4" key={room.id}><h4 className="font-semibold">{room.name}</h4><p className="text-xs text-sg-muted">{room.published?'Publicerat':'Utkast'} · {room.playable?'Spelbart':'Inte spelbart'}</p>
            {lane?<><dl className="my-3 space-y-2 text-sm"><div><dt className="text-sg-muted">Bakgrund i sparad mall</dt><dd>{names(lane.layers.background.allowed,'asset')}</dd></div><div><dt className="text-sg-muted">Tillåtna dealers i sparad mall</dt><dd>{names(lane.layers.dealer.allowed,'dealer')}</dd></div><div><dt className="text-sg-muted">Tillåtna bord i sparad mall</dt><dd>{names(lane.layers.table.allowed,'asset')}</dd></div></dl>
              <details><summary>Delad mall · {uses.length} rum</summary><ul>{uses.map(use=><li key={use.id}>{workspace!.catalog.administration.operators.find(row=>row.id===use.operatorId)?.name} · {use.name}</li>)}</ul></details>
              <a className="studio-button mt-3" href={edit}>Ändra mallens kopplingar</a></>:<p>Rummets sparade mall saknas. Granska rummet innan du ändrar.</p>}
            {room.published&&<p className="mt-3 text-xs text-sg-muted">Publicerade dealers: {room.dealers.map(row=>row.name).join(', ')||'Inga'}. Malländringar blir inte automatiskt spelarens val.</p>}
            {roomPath&&<a className="studio-button mt-3" href={roomPath}>Ändra bara rummets val ↗</a>}
          </li>;
        })}</ul></li>)}</ul>{!rooms.length&&<p>Inga rum kopplade ännu.</p>}
      </li>;
    })}</ul>
    <p className="text-sm text-sg-muted">Bolaget äger sina rum. Dealers, bakgrunder och bord kan användas av flera bolag. Borttagning visar berörda kopplingar före bekräftelse.</p>
  </section>;
}
