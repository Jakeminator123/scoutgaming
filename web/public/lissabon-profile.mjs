export async function installLissabonProfileUi({ canSwitch, beforeSwitch = () => {} }) {
  const session = await fetch('/api/auth/session', { cache: 'no-store' }).then(r => r.json());
  if (!session.localDemoProfiles) return;
  document.documentElement.dataset.streamLane = 'lissabon-stream-lane';
  const bar = document.createElement('div'); bar.className = 'lissabon-profile-bar';
  const identity = document.createElement('span');
  const choose = document.createElement('button'); choose.type = 'button'; choose.textContent = 'Byt profil';
  bar.append(identity, choose); document.querySelector('#dealer-picker').append(bar);
  const dialog = document.createElement('dialog'); dialog.id = 'lissabon-profile';
  dialog.setAttribute('aria-labelledby', 'lissabon-profile-title');
  dialog.innerHTML = `<h2 id="lissabon-profile-title">Vem spelar med Astrid?</h2>
    <p>En lokal demoprofil sparar ditt namn och ditt samtal med Astrid även efter omstart.</p>
    <form id="lissabon-select"><label for="lissabon-saved">Sparad profil</label><select id="lissabon-saved"></select><button type="submit">Fortsätt med profilen</button></form>
    <form id="lissabon-create"><label for="lissabon-name">Nytt profilnamn</label><input id="lissabon-name" maxlength="40" required autocomplete="off" placeholder="Ditt namn"><button type="submit">Skapa profil</button></form>
    <p id="lissabon-profile-error" role="alert"></p>
    <button type="button" id="lissabon-guest">Fortsätt som gäst</button><button type="button" id="lissabon-profile-close">Stäng</button>
    <small>Profilerna på denna dator har inget lösenord. De senaste 30 chattinläggen sparas i högst 30 dagar utan nya meddelanden. Du kan radera chatthistoriken under Minne.</small>`;
  document.body.append(dialog);
  const error = dialog.querySelector('#lissabon-profile-error');
  const saved = dialog.querySelector('#lissabon-saved');
  const channel = new BroadcastChannel('lissabon-profile');
  channel.onmessage = () => location.reload();
  window.addEventListener('pagehide', () => channel.close(), { once: true });
  async function read() {
    const response = await fetch('/api/lissabon/profiles', { cache: 'no-store' });
    if (!response.ok) throw new Error('Profilerna kunde inte läsas.');
    const data = await response.json();
    identity.textContent = `Astrid · ${data.current?.name ?? 'Gäst'}`;
    saved.replaceChildren(...data.profiles.map(profile => {
      const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.name;
      option.selected = profile.id === data.current?.id; return option;
    }));
    dialog.querySelector('#lissabon-select').hidden = !data.profiles.length;
    return data;
  }
  let submitting = false;
  async function change(value) {
    if (submitting) return;
    if (!canSwitch()) { error.textContent = 'Avsluta handen och vänta tills Astrid svarat innan du byter profil.'; return; }
    beforeSwitch();
    submitting = true; error.textContent = '';
    dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      const response = await fetch('/api/lissabon/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      sessionStorage.setItem('lissabon-guest', value.action === 'guest' ? '1' : '0');
      channel.postMessage('changed'); location.reload();
    } catch (cause) { error.textContent = cause.message; }
    finally { submitting = false; dialog.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
  }
  choose.onclick = async () => {
    dialog.showModal(); error.textContent = '';
    try { await read(); } catch (cause) { error.textContent = cause.message; }
  };
  dialog.querySelector('#lissabon-select').onsubmit = event => { event.preventDefault(); void change({ action: 'select', id: saved.value }); };
  dialog.querySelector('#lissabon-create').onsubmit = event => { event.preventDefault(); void change({ action: 'create', name: dialog.querySelector('#lissabon-name').value }); };
  dialog.querySelector('#lissabon-guest').onclick = () => void change({ action: 'guest' });
  dialog.querySelector('#lissabon-profile-close').onclick = () => dialog.close();
  try {
    const data = await read();
    if (!data.current && sessionStorage.getItem('lissabon-guest') !== '1' && canSwitch()) dialog.showModal();
  } catch (cause) { identity.textContent = 'Astrid · profiler kunde inte läsas'; error.textContent = cause.message; }
}
