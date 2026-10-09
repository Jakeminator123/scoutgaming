// Separate presentation routes share the same origin, session and game API.
import {approvedGameQuery} from './game-entry-contract.mjs';
import {GAME_LANES} from './game-lanes.mjs';
export const V2_DEALERS = ['astrid', 'amira'];
const INDEXED_DEALERS = ['vera', 'astrid', 'amira', 'mei'];
// Dragge and Paow have no indexed table; their link opens their own portrait lane.
const portraitLane = dealer => INDEXED_DEALERS.includes(dealer) ? null
  : GAME_LANES.find(lane => lane.renderer === 'portrait-video' && lane.dealer === dealer)?.id ?? null;
export function dealerVersionPath(dealer, version, observerSearch = '') {
  const key = ['vera', 'astrid', 'amira', 'mei', 'nora'].includes(dealer) ? dealer : 'vera';
  const query=new URLSearchParams({dealer:key});
  const previous=new URLSearchParams(observerSearch);
  const noraLane=key==='nora' ? previous.get('lane') || (globalThis.document?.documentElement?.dataset.gameDealer==='nora' ? globalThis.document.documentElement.dataset.gameLane : null) : null;
  // The clean Blackjack URL carries its saved presentation in the document.
  // An explicit dealer change must not keep a lane override that forces Astrid.
  if (!previous.has('presentation') && (previous.get('lane') === 'mobile-phone'
    || globalThis.document?.documentElement?.dataset.gamePresentation === 'local')) previous.set('presentation','local');
  previous.delete('lane');
  if (lane) { previous.set('lane', lane); previous.set('presentation', 'local'); query.set('lane', lane); }
  for(const name of ['labObserverOrigin','labObserverChannel']){
    const value=previous.get(name);if(value)query.set(name,value);
  }
  // Keep the explicitly selected shared Astrid presentation when visiting
  // another dealer and returning. Other dealers ignore this preference.
  // An explicit V2 comparison remains a separate opt-in presentation.
  if(version !== 'v2' && previous.get('presentation') === 'local')query.set('presentation','local');
  if(previous.has('rehearsal'))query.set('rehearsal','1');
  const originalPath = globalThis.document?.documentElement?.dataset.gamePath === '/blackjack' ? '/blackjack' : '/';
  if(key==='nora'){
    previous.set('dealer','nora');previous.set('presentation','local');
    if(noraLane && noraLane!=='mobile-phone')previous.set('lane',noraLane);
    return originalPath+'?'+approvedGameQuery(previous,{origin:globalThis.location?.origin,includeLaunch:false});
  }
  if (originalPath === '/blackjack' && !(version === 'v2' && V2_DEALERS.includes(key))) {
    previous.set('dealer',key);
    return originalPath+'?'+approvedGameQuery(previous,{origin:globalThis.location?.origin,includeLaunch:false});
  }
  return `${version === 'v2' && V2_DEALERS.includes(key) ? '/v2/' : originalPath}?${query}`;
}

export function installDealerVersionSwitcher({ dealer, version, isBusy }) {
  if(version === 'original' && (new URLSearchParams(location.search).get('presentation') === 'local'
    || new URLSearchParams(location.search).get('lane') === 'mobile-phone'
    || document.documentElement?.dataset.gamePresentation === 'local'))return;
  const picker = document.querySelector('#dealer-picker');
  if (!picker || picker.dataset.versions) return;
  picker.dataset.versions = version;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('./dealer-version-switcher.css', import.meta.url).href;
  document.head.appendChild(css);
  const status = picker.querySelector('#dealer-switch-status');
  const original = document.createElement('div'); original.className = 'dealer-original-row';
  for (const child of [...picker.children]) if (child !== status) original.appendChild(child);
  picker.prepend(original);
  const navigate = (key, nextVersion) => {
    if (key === dealer && nextVersion === version) return;
    if (isBusy()) {
      status.textContent = 'Finish this round to change tables.';
      return;
    }
    location.assign(dealerVersionPath(key, nextVersion, location.search));
  };
  for (const button of original.querySelectorAll('[data-dealer]')) {
    button.setAttribute('aria-pressed', String(version === 'original' && button.dataset.dealer === dealer));
    button.onclick = () => navigate(button.dataset.dealer, 'original');
  }
  const row = document.createElement('div'); row.id = 'dealer-v2-options';
  row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'V2 dealer tables');
  const label = document.createElement('span'); label.className = 'dealer-version-label'; label.textContent = 'V2 TABLES'; row.appendChild(label);
  for (const key of V2_DEALERS) {
    const name = key === 'astrid' ? 'Astrid' : 'Amira';
    const button = document.createElement('button'); button.type = 'button'; button.dataset.dealer = key;
    button.setAttribute('aria-label', `${name} V2`);
    button.setAttribute('aria-pressed', String(version === 'v2' && key === dealer));
    const image = document.createElement('img'); image.src = `/dealers/${key}/poster.jpg`; image.alt = '';
    const text = document.createElement('span'); text.textContent = `${name} V2`;
    button.append(image, text); button.onclick = () => navigate(key, 'v2'); row.appendChild(button);
  }
  picker.insertBefore(row, status);
  const measure = () => document.documentElement.style.setProperty('--dealer-picker-height', `${Math.ceil(picker.getBoundingClientRect().height)}px`);
  new ResizeObserver(measure).observe(picker); measure();
}
