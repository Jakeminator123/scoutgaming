import {useEffect,useState} from 'react';
import {MovingDriftControls,type MovingDriftTransport} from '../../../../components/moving-drift-controls';
import {createStudioAdminClient,studioAdminActor,StudioAdminUiError,type StudioAdminActor} from '../../../../components/studio-administration';
import {readAdminSession} from '../../lib/admin-session';

type DriftState={status:'loading'}|{status:'error';message:string}|{status:'ready';client:MovingDriftTransport;actor:StudioAdminActor};
/** The same native moving-drift reader/writer Drift used, bound to the freshly read N1 actor. */
export function TaldriftPanel() {
  const [state,setState]=useState<DriftState>({status:'loading'}),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setState({status:'loading'});
    void (async()=>{
      try {
        const session=await readAdminSession(controller.signal),actor=studioAdminActor(session);
        if(!actor)throw new StudioAdminUiError(401);
        if(!Array.isArray(session.availableActions)||!session.availableActions.every((item:unknown)=>typeof item==='string'))throw new StudioAdminUiError(503);
        const client=createStudioAdminClient({apiBase:'/studio/api/admin',session:readAdminSession,availableActions:session.availableActions,readIdentity:'response-headers-v1'});
        if(!controller.signal.aborted)setState({status:'ready',client,actor});
      }catch(error){if(!controller.signal.aborted)setState({status:'error',message:error instanceof StudioAdminUiError?error.message:'Driftstyrningen kunde inte nås. Försök igen.'});}
    })();
    return()=>controller.abort();
  },[refresh]);
  return <section className="admin-speech-panel" aria-label="Taldrift">
    <p className="admin-speech-lead">GPU-läget för dealerns tal. Av och Sparläge är anslutna; ett sparat önskemål är ingen driftbekräftelse.</p>
    {state.status==='loading'&&<p role="status">Läser session och driftbehörighet…</p>}
    {state.status==='error'&&<div className="admin-system-card" role="alert"><p>{state.message}</p><button className="studio-button" type="button" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>}
    {state.status==='ready'&&<MovingDriftControls client={state.client} expectedActor={state.actor}/>}
  </section>;
}
