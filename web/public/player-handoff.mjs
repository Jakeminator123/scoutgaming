import {approvedGameQuery} from './game-entry-contract.mjs';
import { isOperatorSlug } from '../../packages/navigation/operator-slug.mjs';

// Document returns only: never an API, login loop, external URL or bearer token.
export function playerHandoffPath(value,{origin='https://player.invalid'}={}) {
  if(typeof value!=='string' || value.length>2048 || !value.startsWith('/') || value.startsWith('//') || /[\\#\x00-\x20]/.test(value)) return null;
  const url=new URL(value,origin);
  if(url.origin!==new URL(origin).origin || value.split('?')[0]!==url.pathname) return null;
  if(['/play/profil','/play/historik'].includes(url.pathname)) return url.search ? null : url.pathname;
  if(url.pathname==='/play') {
    if(!url.search) return url.pathname;
    return url.searchParams.size===1 && url.searchParams.has('operator') && isOperatorSlug(url.searchParams.get('operator')) ? url.pathname+url.search : null;
  }
  if(!['/blackjack','/play/blackjack','/roulette','/play/roulette'].includes(url.pathname)) return null;
  const query=approvedGameQuery(url.searchParams,{origin:url.origin,includeLaunch:false}).toString();
  return url.pathname+(query?'?'+query:'');
}
export function playerHandoffDestination(value,options) {
  const path=playerHandoffPath(value,options);
  return path ? '/api/auth/bo/start?next='+encodeURIComponent(path) : null;
}
