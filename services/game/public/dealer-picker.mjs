import {dealerVersionPath} from './dealer-version-switcher.mjs';

export function allowedDealers(entrySelection,DEALERS,DEALER) {
  const keys=new Set(Array.isArray(entrySelection.choices?.dealers)?entrySelection.choices.dealers:[DEALER.key]);
  return Object.values(DEALERS).filter(dealer=>keys.has(dealer.key));
}

export function mountDealerPicker({document,$,entrySelection,DEALERS,DEALER,previewSession,state,location}) {
for (const dealer of allowedDealers(entrySelection,DEALERS,DEALER)) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.dealer = dealer.key;
  const available=previewSession?.dealerAvailability.find(row=>row.id===dealer.key);
  if(previewSession&&available?.playable!==true){button.disabled=true;button.title='Saknar spelbart grundklipp. Lägg till det under Dealers & klipp.';}
  button.setAttribute('aria-label', `${dealer.name}'s table`);
  button.setAttribute('aria-pressed', String(dealer.key === DEALER.key));
  const portrait = document.createElement('span');
  portrait.textContent = dealer.name.slice(0,1); portrait.setAttribute('aria-hidden','true');
  const name = document.createElement('span'); name.textContent = dealer.name;
  button.append(portrait, name);
  button.onclick = () => {
    if (button.disabled || dealer.key === DEALER.key) return;
    if (state.round || state.busy) {
      $('#dealer-switch-status').textContent = 'Finish this round to change tables.';
      return;
    }
    location.href = dealerVersionPath(dealer.key, 'original', location.search);
  };
  $('#dealer-options').appendChild(button);
}


}

export function populateRehearsalDealers(select,{document,entrySelection,DEALERS,DEALER}) {
  for(const dealer of allowedDealers(entrySelection,DEALERS,DEALER)){
    const option=document.createElement('option');option.textContent=dealer.name;option.value=dealer.key;select.add(option);
  }
  select.value=DEALER.key;
}
