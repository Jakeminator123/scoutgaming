import {STUDIO_PREVIEW_NOTICE,requestEmbeddedStudioPreviewClose} from './studio-preview-client.mjs';
import {writeChoices} from '../../../packages/presentation/runtime/player-choices.mjs';

export async function initializePreviewControls({studioPreview,document,gameApi}) {
  const $=selector=>document.querySelector(selector);
  if (!studioPreview) return null;
  let previewSession=null;
  const notice=document.createElement('details');notice.id='studio-preview-status';
  const summary=document.createElement('summary');summary.textContent='Provspel · separat testsaldo';summary.title=STUDIO_PREVIEW_NOTICE;
  const explanation=document.createElement('p');explanation.textContent=STUDIO_PREVIEW_NOTICE;
  notice.append(summary,explanation);$('#top-right').append(notice);
  $('#chat').hidden=true;$('#chat').inert=true;
  $('#chat-input').disabled=true;$('#chat-send').disabled=true;
  try { previewSession=await gameApi.session(); }
  catch(error){notice.open=true;explanation.textContent=error.message;explanation.setAttribute('role','alert');throw error;}
  const label=document.querySelector('#wallet label');if(label)label.textContent='TESTSALDO';
  $('#add-funds').hidden=true;$('#sign-out').hidden=true;
  return previewSession;
}

export function mountPlayerReturn({studioPreview,entrySelection,document,gameApi,choiceStorage,previewSessionId,soundStorageKey,location,window}) {
  const lobbyReturn = document.querySelector('.casino-return');
  if(lobbyReturn){
  // Use the validated document context, never a return URL or room from the query.
  const returnQuery=new URLSearchParams(studioPreview
    ? {composition:studioPreview.presentationLaneId,...(entrySelection.dealer?{dealer:entrySelection.dealer}:{})}
    : entrySelection.operator?{operator:entrySelection.operator,...(entrySelection.roomId?{room:entrySelection.roomId}:{})}:{});
  lobbyReturn.href=(studioPreview?'/admin/compositions':'/lobby')+(returnQuery.size?'?'+returnQuery:'');
  if(studioPreview){
    lobbyReturn.textContent=window.parent===window?'Till Miljö':'Stäng provspel';
    lobbyReturn.onclick=async event=>{
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      try{await gameApi.close();}catch{ /* The expired session also permits returning to Studio. */ }
      try{writeChoices(choiceStorage,entrySelection.operator,{},previewSessionId);choiceStorage.removeItem(soundStorageKey);}catch{}
      if(!requestEmbeddedStudioPreviewClose(studioPreview,window))location.assign(lobbyReturn.href);
    };
  }
}
  return lobbyReturn;
}
