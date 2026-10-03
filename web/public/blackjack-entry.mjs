import {canonicalGameDestination} from './game-entry-contract.mjs';
const form = document.querySelector('form');
const status = document.querySelector('#status');
const submit = document.querySelector('#submit');
const toggle = document.querySelector('#toggle');
const password = document.querySelector('#password');
const username = document.querySelector('#username');
const destination = '/?dealer=astrid&presentation=local';
const gameDestination = document.documentElement.dataset.gamePath === '/blackjack'
  ? canonicalGameDestination(new URL(location.search ? location.href : '/player-login?dealer=astrid&presentation=local',location.origin),{includeLaunch:false}) : destination;
let registering = false, playerAccounts = false, busy = false;
const kind = () => form.elements.kind.value;
function render() {
  if (kind() !== 'player') registering = false;
  toggle.hidden = !playerAccounts || kind() !== 'player';
  toggle.textContent = registering ? 'Jag har redan ett spelarkonto' : 'Skapa spelarkonto';
  submit.textContent = registering ? 'Skapa konto och spela' : 'Logga in';
  password.autocomplete = registering ? 'new-password' : 'current-password';
  password.minLength = registering ? 12 : 1;
  username.maxLength = kind() === 'player' ? 32 : 254;
  username.previousElementSibling.textContent = kind() === 'player' ? 'Användarnamn (3–32 tecken)' : 'Scout-användarnamn eller e-post';
}
toggle.onclick = () => { if (!busy) { registering = !registering; password.value = ''; status.textContent = ''; render(); } };
form.onchange = event => { if (event.target.name === 'kind') { password.value = ''; render(); } };
form.onsubmit = async event => {
  event.preventDefault(); if (busy) return;
  busy = true; submit.disabled = toggle.disabled = true; status.textContent = 'Loggar in…';
  try {
    const local = kind() === 'player';
    const response = await fetch(local ? `/api/auth/player/${registering ? 'register' : 'login'}` : '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [local ? 'username' : 'email']: username.value, password: password.value }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Inloggningen misslyckades.');
    password.value = ''; location.assign(gameDestination);
  } catch (error) { status.textContent = error.message; }
  finally { busy = false; submit.disabled = toggle.disabled = false; }
};
try {
  const response = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!response.ok) throw Error('Inloggningen är inte tillgänglig. Ladda om för att försöka igen.');
  const session = await response.json();
  if (session.authenticated && !session.localDemoProfiles) location.replace(gameDestination);
  else {
    playerAccounts = session.playerAccounts === true;
    if (!playerAccounts) form.elements.kind.value = 'scout';
    document.querySelector('#account-kind').hidden = !playerAccounts;
    status.textContent = ''; form.hidden = false; render();
  }
} catch (error) { status.textContent = error.message; }
