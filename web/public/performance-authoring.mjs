// Capture the actual game camera for performance authoring. This changes only
// presentation; it never creates cards, changes a bet, or calls the game API.
export function installPerformanceAuthoring({ panel, tableScene }) {
  const button = document.createElement('button');
  button.textContent = 'Capture clean camera reference';
  button.id = 'performance-capture';
  const status = document.createElement('p');
  status.id = 'performance-capture-status';
  panel.append(button, status);
  button.onclick = () => {
    const registration = tableScene?.registration();
    if (!registration) { status.textContent = '3D camera unavailable.'; return; }
    status.dataset.registration = JSON.stringify(registration);
    const blob = new Blob([JSON.stringify(registration, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'astrid-camera.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.documentElement.dataset.performanceCapture = 'true';
    console.info('[performance] Clean camera reference; Escape restores controls.', registration);
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') delete document.documentElement.dataset.performanceCapture;
  });
  if(new URLSearchParams(location.search).get('performance')==='staged') {
    const review=document.createElement('button');review.textContent='Inspect generated source';
    panel.append(review);
    const showReview=(kind='source')=>{
      const dialog=document.createElement('dialog');dialog.id='performance-source-review';
      const heading=document.createElement('h2');heading.textContent={source:'Astrid source performance',initial:'Left, centre, right and dealer cards in the game',dealer:'Astrid dealing her own cards',continuity:'Centre delivery returning directly to the shoe',leftReturn:'Left delivery returning to the shoe'}[kind];
      const note=document.createElement('p');note.textContent=kind==='source'
        ?'The source card is a tracking prop. Gameplay replaces it with the server-issued card and foreground finger occlusion.'
        :kind==='dealer'?'An excerpt of Astrid dealing her initial upcard in the actual game. Silent recording; the complete initial deal also includes her face-down card.'
        :'Recorded in the actual game with an isolated demo wallet. This recording is silent; see the handoff for remaining visual and device checks.';
      const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';
      video.src=`dealers/astrid/performance/${{source:'centre-source',initial:'cac-followup-deal',dealer:'dealer-turn-review',continuity:'continuous-return-game',leftReturn:'left-return-game'}[kind]}.mp4`;
      const close=document.createElement('button');close.textContent='Return to game';close.onclick=()=>dialog.close();
      dialog.append(heading,note,video,close);document.body.append(dialog);dialog.showModal();
      dialog.addEventListener('close',()=>{video.pause();dialog.remove();},{once:true});
    };
    review.onclick=()=>showReview();
    for(const [kind,label] of [['initial','Watch updated three-seat deal'],['dealer','Watch own-card delivery'],['continuity','Watch centre return test'],['leftReturn','Watch left return test']]){
      const button=document.createElement('button');button.textContent=`${label} · silent recording`;button.onclick=()=>showReview(kind);panel.append(button);
    }
  }
}
