import {dealerVersionPath} from './dealer-version-switcher.mjs';
import {populateRehearsalDealers} from './dealer-picker.mjs';

export function createDealerRehearsal({panel,lineSelect,status,bank={},LINES,localPresentationEnabled,setMuted,speechTurn,playRecorded,state,tableReady}) {
  let rehearsalInitialized = false, closed = false, reviewing = false, waitTimer, releaseWait;
  const update = () => {
    if(closed)return;
    if (!rehearsalInitialized) { status.textContent = 'Preparing the table for rehearsal…'; return; }
    const id = lineSelect.value;
    if (localPresentationEnabled) {
      status.textContent = (bank[id]?.text ?? LINES[id] ?? id) + ' — shared Studio presentation; exact clip selected at playback.';
      return;
    }
  };
  lineSelect.onchange = update; update();
  const play = async () => {
    if(closed)return false;
    const id = lineSelect.value;
    setMuted(false);
    let completed;
    await speechTurn(async signal => { completed = await playRecorded(id, signal); });
    if (localPresentationEnabled && completed !== true) throw new Error('Shared Studio clip did not complete; check playback status.');
    return completed;
  };
  const review = async count => {
    if (!rehearsalInitialized || closed || reviewing) return;
    reviewing=true;
    const controls=[...panel.querySelectorAll('button,select')];
    controls.forEach(control=>control.disabled=true);
    update();
    if (localPresentationEnabled) status.textContent = `0/${count} completed — reviewing ${lineSelect.value} with the shared Studio presentation.`;
    try { for(let i=0;i<count;i++){
      // The first gesture can unlock the automatic greeting. Queue the
      // requested review behind it instead of silently dropping both plays.
      while(state.speaking&&!closed)await new Promise(resolve=>{
        releaseWait=resolve;waitTimer=setTimeout(()=>{waitTimer=undefined;releaseWait=null;resolve();},50);
      });
      if(closed)return;
      const completed = await play();
      if(closed)return;
      if (localPresentationEnabled && completed === true) status.textContent = `${i + 1}/${count} completed — ${lineSelect.value}, shared Studio clip.`;
    } }
    catch(error){if(!closed)status.textContent=`Playback failed: ${error.message}`;}
    finally{reviewing=false;if(!closed)controls.forEach(control=>control.disabled=false);}
  };
  const initialControls = [...panel.querySelectorAll('button,select')];
  const settle = failed => {
    if(closed)return;
    if (failed) { status.textContent = 'The table could not start. Sign in and reload to rehearse.'; return; }
    rehearsalInitialized = true;
    initialControls.forEach(control => { control.disabled = false; });
    update();
  };

  tableReady.then(()=>settle(false),()=>settle(true));
  return {update,play,review,close(){
    closed=true;clearTimeout(waitTimer);releaseWait?.();releaseWait=null;
    lineSelect.onchange=null;initialControls.forEach(control=>control.disabled=true);
  }};
}

export function mountDealerRehearsal({document,$,location,entrySelection,DEALERS,DEALER,VOICE_LINES,LINES,localPresentationEnabled,setMuted,speechTurn,playRecorded,state,tableReady,activeBoxHighlight}) {
  if (new URLSearchParams(location.search).get('rehearsal') !== '1') return null;
  const panel = document.createElement('details'); panel.id = 'rehearsal'; panel.open = true;
  const onToggle=()=>{if(state.round&&!state.busy)activeBoxHighlight();};
  panel.addEventListener('toggle',onToggle);
  panel.innerHTML = `<summary>Dealer rehearsal</summary>
    <label>Dealer<select id="rehearsal-dealer" aria-label="Rehearsal dealer" disabled></select></label>
    <label>Recorded line<select id="rehearsal-line" aria-label="Recorded line" disabled></select></label>
    <p id="rehearsal-status" aria-live="polite">Preparing the table for rehearsal…</p>
    <button id="rehearsal-play" disabled>Play line</button><button id="rehearsal-repeat" disabled>Play twice</button>`;
  $('#scene').appendChild(panel);
  const dealerSelect = panel.querySelector('#rehearsal-dealer');
  populateRehearsalDealers(dealerSelect,{document,entrySelection,DEALERS,DEALER});
  dealerSelect.onchange=()=>{location.href=dealerVersionPath(dealerSelect.value,'original',location.search);};
  const lineSelect = panel.querySelector('#rehearsal-line');
  const bank = {};
  for (const id of new Set([...VOICE_LINES, ...Object.keys(bank)])) {
    lineSelect.add(Object.assign(document.createElement('option'),{textContent:id.replaceAll('_',' '),value:id}));
  }
  const status = panel.querySelector('#rehearsal-status');
  const controller=createDealerRehearsal({panel,lineSelect,status,bank,LINES,localPresentationEnabled,setMuted,speechTurn,playRecorded,state,tableReady});
  panel.querySelector('#rehearsal-play').onclick=()=>controller.review(1);
  panel.querySelector('#rehearsal-repeat').onclick=()=>controller.review(2);
  return {...controller,close(){controller.close();panel.removeEventListener('toggle',onToggle);panel.remove();}};
}
