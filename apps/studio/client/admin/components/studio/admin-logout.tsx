import {useRef,useState} from 'react';
import {LogOut} from 'lucide-react';
import {createStudioLoginClient,StudioLoginUiError} from '../../../../lib/studio-login-client.mjs';
import {studioHistory} from '../../../../lib/studio-history.mjs';

// The one logout in Admin: in the sidebar, and in the portal bar below 600 px where
// the sidebar is hidden. An editor with unsaved changes may refuse it, exactly as
// it refuses a menu link, before the session is ended.
export function AdminLogout() {
  const writing=useRef(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function logout() {
    if(writing.current||!studioHistory(window).canNavigate('/admin/login'))return;
    writing.current=true;setBusy(true);setError('');
    try{await createStudioLoginClient({authBase:'/studio/api/auth'}).request('logout',{});window.location.assign('/admin/login');}
    catch(cause){setError(cause instanceof StudioLoginUiError?cause.message:'Utloggningen kunde inte bekräftas.');}
    finally{writing.current=false;setBusy(false);}
  }
  return <>
    <button type="button" className="studio-logout" disabled={busy} aria-label="Logga ut" title="Logga ut" onClick={()=>void logout()}><LogOut size={17} aria-hidden="true"/><span>{busy?'Loggar ut…':'Logga ut'}</span></button>
    {error&&<p role="alert" className="studio-logout-error">{error}</p>}
  </>;
}
