import {canonicalGameDestination} from './game-entry-contract.mjs';
const form = document.querySelector('form');
const status = document.querySelector('#status');
const submit = document.querySelector('#submit');
const password = document.querySelector('#password');
const username = document.querySelector('#username');
const help = document.querySelector('#login-help');
const administratorEntry = document.querySelector('#legacy-admin');
const destination = '/?dealer=astrid&presentation=local';
const gameDestination = document.documentElement.dataset.gamePath === '/blackjack'
  ? canonicalGameDestination(new URL(location.href,location.origin),{includeLaunch:false}) : destination;
let busy = false, loginEndpoint = null, localLogin = false;
submit.disabled = true;
function loginError(code) {
  return ({401:'Inloggningen kunde inte verifieras. Kontrollera användarnamn och lösenord.',
    403:'Kontot har inte tillgång till spelet.',429:'För många försök. Vänta och försök igen.'})[code]
    || 'Inloggningen är tillfälligt otillgänglig. Försök igen senare.';
}
form.onsubmit = async event => {
  event.preventDefault(); if (busy || !loginEndpoint) return;
  busy = true; submit.disabled = true; status.textContent = 'Loggar in…';
  const body = {[localLogin ? 'username' : 'email']:username.value.trim(),password:password.value};
  password.value = '';
  try {
    const response = await fetch(loginEndpoint, {
      method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),
    });
    if (!response.ok) { status.textContent = loginError(response.status); return; }
    const result = await response.json();
    if (result?.ok !== true) throw Error('login_unconfirmed');
    location.assign(gameDestination);
  } catch { status.textContent = loginError(503); }
  finally { delete body.password; busy = false; submit.disabled = false; }
};
try {
  const response = await fetch('/api/auth/session', {credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
  if (!response.ok) throw Error('session_unavailable');
  const session = await response.json();
  if (!session || typeof session !== 'object' || Array.isArray(session) || typeof session.authenticated !== 'boolean') throw Error('session_unavailable');
  password.maxLength = session.sharedCredentials === true ? 256 : 128;
  localLogin = session.sharedCredentials !== true && session.playerAccounts === true;
  loginEndpoint = localLogin ? '/api/auth/player/login' : '/api/auth/login';
  if (session.authenticated && !session.localDemoProfiles) location.replace(gameDestination);
  else {
    help.textContent = session.sharedCredentials === true
      ? 'Administratörer använder samma konto och lösenord i spelet och Studio.'
      : localLogin ? 'Här loggar du in med ditt befintliga spelarkonto. Administratörer loggar in via Studio tills spelserverns gemensamma inloggning är aktiverad.'
        : 'Logga in med ditt befintliga Croupier-konto. Spelserverns gemensamma inloggning är ännu inte aktiverad.';
    administratorEntry.hidden = !localLogin;
    username.maxLength = localLogin ? 32 : 254;
    status.textContent = ''; form.hidden = false; submit.disabled = false;
  }
} catch { status.textContent = 'Inloggningen är inte tillgänglig. Ladda om för att försöka igen.'; }
