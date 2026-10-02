const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const administrator = role => ['admin', 'superadmin'].includes(role);
const transitions = {active: ['blocked', 'closed'], blocked: ['active', 'closed'], closed: []};
const labels = {active: 'ACTIVE', blocked: 'BLOCKED', closed: 'CLOSED'};

export function playerAdministrationHtml(players, role, available = true) {
  const writable = available && administrator(role);
  return `<div class="panel"><div class="t">DEMO PLAYERS · LIVE FROM THE GAME DATABASE</div>
    <div class="pad">Virtual credits only. Blocking revokes sessions. Closing is permanent; account history and balances are preserved.</div>
    <table><thead><tr><th>NAME / USERNAME</th><th>ID</th><th>STATE</th><th>CURRENCY</th><th>DEMO BALANCE</th><th>OPENED</th>${writable ? '<th>ACTIONS</th>' : ''}</tr></thead><tbody>
    ${players.map(player => {
      const status = labels[player.status] ? player.status : 'unknown';
      const actions = writable ? (transitions[status] ?? []).map(next => `<button type="button" data-player="${escape(player.id)}" data-status="${next}">${next === 'active' ? 'REACTIVATE' : next === 'blocked' ? 'BLOCK' : 'CLOSE PERMANENTLY'}</button>`).join(' ') : '';
      return `<tr><td>${escape(player.name)}<br><small>${escape(player.username)}</small></td><td class="mono" title="${escape(player.id)}">${escape(String(player.id).slice(0, 8))}…</td><td>${labels[status] ?? 'UNKNOWN'}</td><td>${escape(player.currency)}</td><td>${escape(Number(player.balance).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}))}</td><td>${escape((player.created_at ?? '').slice(0, 10))}</td>${writable ? `<td>${actions || 'No available changes'}</td>` : ''}</tr>`;
    }).join('')}</tbody></table></div>${writable ? `<div class="panel"><div class="t">CREATE DEMO ACCOUNT · 1,000 VIRTUAL CREDITS</div>
    <form id="player-create" class="pad" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <label>Username <input name="username" required minlength="3" maxlength="32" pattern="[a-z0-9][a-z0-9._-]{2,31}" autocomplete="off"></label>
    <label>Name <input name="name" required maxlength="40" autocomplete="off"></label>
    <label>Password <input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>
    <label>Currency <select name="currency"><option>USD</option><option>EUR</option><option>SEK</option></select></label>
    <label>Reason <input name="reason" required maxlength="500" autocomplete="off"></label>
    <button type="submit">CREATE DEMO ACCOUNT</button></form></div>` : `<div class="panel"><div class="pad">Read-only player access. ${available ? 'Account changes require ADMIN or SUPERADMIN.' : 'Account administration is unavailable in this storage mode.'}</div></div>`}`;
}

export async function changePlayerStatus({player, status, reason, role}, {api, confirmClose}) {
  if (!administrator(role)) throw Error('Account changes require ADMIN or SUPERADMIN.');
  if (!(transitions[player.status] ?? []).includes(status)) throw Error('This account state cannot be changed.');
  const explanation = String(reason ?? '').trim();
  if (!explanation || explanation.length > 500) throw Error('Enter a reason of 1–500 characters.');
  if (status === 'closed' && !confirmClose(`Permanently close ${player.username || player.name} (${player.id})?\n\nThis cannot be undone. Sessions and game access will be revoked. Account history and balances remain. An ongoing hand must be collected first.`)) return false;
  const result = await api('/api/bo/players/status', {playerId: player.id, status, reason: explanation});
  if (!result.ok) throw Error(result.error || result.message || 'The account change was rejected.');
  return true;
}

export function mountPlayerAdministration(container, {players, role, available = true, api, refresh, notify, promptReason = window.prompt.bind(window), confirmClose = window.confirm.bind(window)}) {
  container.innerHTML = playerAdministrationHtml(players, role, available);
  const form = container.querySelector('#player-create');
  if (form) form.onsubmit = async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const body = Object.fromEntries(new FormData(form));
    for (const key of ['username', 'name', 'reason']) body[key] = body[key].trim();
    const button = form.querySelector('button');
    button.disabled = true;
    // The password is retained only in the request being submitted.
    form.elements.password.value = '';
    try {
      const result = await api('/api/bo/players/create', body);
      if (!result.ok) throw Error(result.error || result.message || 'The demo account could not be created.');
      notify('Demo account created with 1,000 virtual credits.'); await refresh();
    } catch (error) { notify(error.message); }
    finally { body.password = ''; button.disabled = false; }
  };
  for (const button of container.querySelectorAll('[data-player]')) button.onclick = async () => {
    const player = players.find(item => item.id === button.dataset.player);
    if (!player) return;
    const reason = promptReason(`Reason for ${button.dataset.status === 'closed' ? 'permanently closing' : button.dataset.status === 'active' ? 'reactivating' : 'blocking'} ${player.username || player.name}:`);
    if (reason === null) return;
    button.disabled = true;
    try {
      if (await changePlayerStatus({player, status: button.dataset.status, reason, role}, {api, confirmClose})) {
        notify('Account state updated; history preserved.'); await refresh();
      }
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  };
}
