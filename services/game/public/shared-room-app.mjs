import { gameLaneFromDocument } from '../../../packages/presentation/contracts/game-selection.mjs';
import { createPresentationStartup } from './presentation-startup.mjs';
import { createSharedRoomClient } from './shared-room-client.mjs';
import { createSharedRoomCommandClient } from './shared-room-command-client.mjs';
import { createSharedRoomController } from './shared-room-controller.mjs';
import { createSharedRoomView } from './shared-room-view.mjs';
import { mountSharedRoomPresentation } from './shared-room-presentation.mjs';

export async function mountSharedRoomApp({document=globalThis.document,window=globalThis.window,
  createSocket=createSharedRoomClient,createCommands=createSharedRoomCommandClient,
  createView=createSharedRoomView,createPresentation=mountSharedRoomPresentation,presentationTransport=null}={}) {
  const dataset=document?.documentElement?.dataset;
  if(dataset?.sharedRoom!=='1')throw new Error('shared_room_entry_required');
  const selection=gameLaneFromDocument(dataset),roomId=selection.roomId;
  if(!roomId||!/^[a-z0-9_-]{1,128}$/.test(roomId))throw new Error('shared_room_entry_required');
  const startup=createPresentationStartup({document,dealerId:selection.dealer});
  const lifetime=new AbortController();
  let presentation,view,controller,socket,commands,closed=false;
  const fail=()=>{startup.fail();controller?.fail();};
  const close=()=>{if(closed)return;closed=true;lifetime.abort();window.removeEventListener('pagehide',close);socket?.stop();controller?.stop();
    if(!controller){commands?.stop();view?.close();presentation?.close();}startup.close();};
  window.addEventListener('pagehide',close,{once:true});
  try {
    commands=createCommands({roomId});
    presentation=await createPresentation({document,window,selection,signal:lifetime.signal,transport:presentationTransport,onReady:id=>startup.ready(id),onError:()=>{
      const caption=document.getElementById('caption');if(caption)caption.textContent='Presentationen är inte tillgänglig. Bordets spelstatus är oförändrad.';
    }});
    if(closed){presentation.close();return Object.freeze({close});}
    view=createView({document,onLayout:layout=>presentation.layout?.(layout)});
    controller=createSharedRoomController({roomId,commands,view,presentation});
    socket=createSocket({roomId,browserOrigin:window.location.origin,restoreSnapshot:controller.restoreSnapshot,
      present:controller.present,onError:fail,callbackTimeoutMs:30000});
    socket.start();
    return Object.freeze({close,controller});
  }catch(error){fail();close();throw error;}
}
if(globalThis.document?.documentElement?.dataset.sharedRoom==='1') {
  void mountSharedRoomApp().catch(()=>{
    const status=document.getElementById('presentation-loading');
    if(status){status.hidden=false;status.textContent='Spelbordet kunde inte starta. Ladda om sidan för att försöka igen.';status.setAttribute('role','alert');}
  });
}
