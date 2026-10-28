import {canonicalGameDestination} from '../../../packages/navigation/game-entry.mjs';
let pending, generation=0, capabilityReady=false;
const dialog=document.createElement('dialog');dialog.id='auth-modal';
dialog.innerHTML=`<button class="auth-close" type="button" aria-label="Close sign in">×</button><div class="auth-brand" role="img" aria-label="scout/gaming">scout<span>/</span>gaming</div><p class="auth-eyebrow">BLACKJACK</p><h2 id="auth-title">Sign in</h2><p id="auth-purpose"></p><form><label for="auth-email">Email or username</label><input id="auth-email" type="text" autocomplete="username" maxlength="254" required placeholder="Email or username"><label for="auth-password">Password</label><input id="auth-password" type="password" autocomplete="current-password" minlength="1" maxlength="128" required><small id="auth-account">Accounts and passwords are managed in Backoffice.</small><p id="auth-error" role="alert"></p><button id="auth-submit" type="submit" disabled>Sign in →</button></form><p><a id="auth-player-login" hidden>Player account? Sign in here.</a></p><p class="auth-note">Demo credits only. Your table stays here.</p>`;
dialog.setAttribute('aria-labelledby','auth-title');document.body.appendChild(dialog);
const $=s=>dialog.querySelector(s);
const playerLoginPath = '/blackjack';
const playerEntry = $('#auth-player-login');
playerEntry.href = document.documentElement.dataset.gamePath === '/blackjack'
  ? canonicalGameDestination(new URL(location.href),{includeLaunch:false}).replace(/^\/(?:game|blackjack)(?=\?|$)/,'/player-login') : playerLoginPath;
$('.auth-close').onclick=()=>dialog.close('cancel');
function loginError(code){return ({401:'Unable to verify your username and password.',403:'This account cannot access the game.',429:'Too many attempts. Wait before trying again.'})[code] || 'Sign in is temporarily unavailable. Try again later.';}
async function loadCapability(attempt){
  try{
    const response=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('session_unavailable');
    const session=await response.json();
    if(!session || typeof session!=='object' || Array.isArray(session) || typeof session.authenticated!=='boolean')throw Error('session_unavailable');
    if(attempt!==generation || !dialog.open)return;
    $('#auth-password').maxLength=session.sharedCredentials===true ? 256 : 128;
    playerEntry.hidden=session.sharedCredentials===true || session.playerAccounts!==true;
    $('#auth-account').textContent=session.sharedCredentials===true ? 'Use your Croupier account. Accounts and passwords are managed in Backoffice.'
      : 'Use your existing Croupier account. Player accounts use the separate sign-in link until shared sign-in is enabled.';
    capabilityReady=true;$('#auth-submit').disabled=false;$('#auth-error').textContent='';
  }catch{if(attempt===generation && dialog.open)$('#auth-error').textContent=loginError(503);}
}
$('form').onsubmit=async e=>{
  e.preventDefault();if(!capabilityReady || $('#auth-submit').disabled || !dialog.open)return;
  const attempt=generation,body={email:$('#auth-email').value.trim(),password:$('#auth-password').value};
  $('#auth-submit').disabled=true;$('#auth-error').textContent='';$('#auth-password').value='';
  try{
    const r=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok){if(attempt===generation && dialog.open)$('#auth-error').textContent=loginError(r.status);return;}
    const out=await r.json();if(out?.ok!==true)throw Error('login_unconfirmed');
    if(attempt===generation && dialog.open)dialog.close('authenticated');
  }catch{if(attempt===generation && dialog.open)$('#auth-error').textContent=loginError(503);}
  finally{delete body.password;if(attempt===generation)$('#auth-submit').disabled=false;}
};
export function requestLogin(purpose){
  if(pending)return pending;
  // The dialog names the same table as the page heading (#table-profile), never a fixed stake profile.
  const eyebrow=$('.auth-eyebrow');if(eyebrow)eyebrow.textContent=document.querySelector?.('#table-profile')?.textContent?.trim()||'Blackjack';
  generation++;capabilityReady=false;$('#auth-submit').disabled=true;$('#auth-error').textContent='Checking sign-in…';$('#auth-purpose').textContent=purpose;$('#auth-password').value='';playerEntry.hidden=true;dialog.returnValue='';
  pending=new Promise(resolve=>dialog.addEventListener('close',()=>{const ok=dialog.returnValue==='authenticated';pending=null;$('#auth-password').value='';resolve(ok);},{once:true}));dialog.showModal();void loadCapability(generation);return pending;
}
