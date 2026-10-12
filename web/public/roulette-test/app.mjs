const get = id => document.getElementById(id);
const spin = get('spin'), status = get('status'), ring = get('result-ring');
const history = get('history'), clear = get('clear'), copy = get('copy');
const red = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorFor = number => number === 0 ? 'green' : red.has(number) ? 'red' : 'black';
const colorLabel = { green: 'Grön nolla', red: 'Röd', black: 'Svart' };
let count = 0, currentJson = '', busy = false;

for (let number = 0; number <= 36; number++) {
  const pocket = document.createElement('span');
  pocket.className = `pocket ${colorFor(number)}`; pocket.id = `pocket-${number}`;
  pocket.textContent = String(number); pocket.setAttribute('aria-label', `${number}, ${colorLabel[colorFor(number)]}`);
  get('number-board').append(pocket);
}

function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }

spin.addEventListener('click', async () => {
  if (busy) return;
  busy = true; spin.disabled = true; clear.disabled = true; copy.disabled = true; ring.classList.add('pending');
  message('Väntar på spelserverns utfall…');
  const started = performance.now();
  try {
    const response = await fetch('/api/roulette-test/spin', {
      method: 'POST', headers: { 'X-Roulette-Preview': '1' }, credentials: 'omit',
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(response.status === 429 ? 'Vänta en sekund och prova igen.' : 'Servern kunde inte lämna ett utfall.');
    const payload = await response.json(), event = payload.event, outcome = event?.outcome;
    if (payload.demo !== true || event?.type !== 'roulette.spin.resolved' || event.schemaVersion !== 1
        || event.game !== 'roulette' || event.variant !== 'european-single-zero'
        || !Number.isInteger(outcome?.number) || outcome.number < 0 || outcome.number > 36
        || outcome.color !== colorFor(outcome.number)) throw new Error('Serverns svar kunde inte verifieras.');
    get('latency').textContent = `${Math.round(performance.now() - started)} ms`;
    get('result-number').textContent = String(outcome.number); get('result-color').textContent = colorLabel[outcome.color];
    ring.dataset.color = outcome.color;
    document.querySelector('.pocket.selected')?.classList.remove('selected');
    get(`pocket-${outcome.number}`).classList.add('selected');
    const item = document.createElement('li'); item.textContent = String(outcome.number); item.className = outcome.color;
    item.setAttribute('aria-label', `${outcome.number}, ${colorLabel[outcome.color]}`); history.prepend(item);
    if (history.children.length > 20) history.lastElementChild.remove();
    get('empty-history').hidden = true; get('spin-count').textContent = String(++count);
    currentJson = JSON.stringify(event, null, 2); get('event-json').textContent = currentJson;
    message(`Serverutfall: ${outcome.number}, ${colorLabel[outcome.color].toLowerCase()}. Ny demorunda skapad.`);
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    message(timeout ? 'Svaret dröjde. Inget automatiskt återförsök görs; nästa klick skapar en ny runda.'
      : error instanceof TypeError ? 'Kunde inte nå servern. Kontrollera anslutningen och prova igen.' : error.message, true);
  } finally {
    busy = false; spin.disabled = false; clear.disabled = count === 0; copy.disabled = !currentJson; ring.classList.remove('pending');
  }
});

clear.addEventListener('click', () => {
  history.replaceChildren(); count = 0; currentJson = ''; get('spin-count').textContent = '0'; get('latency').textContent = '—';
  get('empty-history').hidden = false; get('result-number').textContent = '—'; get('result-color').textContent = 'Redo att snurra';
  delete ring.dataset.color; document.querySelector('.pocket.selected')?.classList.remove('selected');
  get('event-json').textContent = '// Snurra för att se det verkliga svaret från servern.';
  clear.disabled = true; copy.disabled = true; message('Flikens historik är rensad. Ingen serverdata har ändrats.');
});

copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(currentJson); message('Eventet har kopierats som JSON.'); }
  catch { message('Kunde inte kopiera automatiskt. Markera och kopiera JSON-texten manuellt.', true); }
});
