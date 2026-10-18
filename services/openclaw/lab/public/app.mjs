const $ = (selector) => document.querySelector(selector);
const SOURCE_LABELS = { speak: 'Tal & repliker', deal: 'Kort delas ut', reveal: 'Kort vänds upp', settle: 'Rundan avgörs', turn: 'Spelarens tur', idle: 'Mellan rundorna' };
const ANIMATIONS = ['wave', 'nod', 'deal-left', 'deal-centre', 'deal-right', 'deal-dealer', 'reveal', 'point', 'celebrate', 'reassure', 'neutral', 'idle'];
const CONDITION_PATHS = [
  ['context.chat.signal', 'Chattsignal'], ['context.playerHistory.returning', 'Återkommande spelare'],
  ['context.playerHistory.preferredLanguage', 'Språkpreferens'], ['context.session.recentWins', 'Vinster i följd'],
  ['context.session.recentLosses', 'Förluster i följd'], ['event.line', 'Talets kod'], ['event.type', 'Källtyp'],
  ['event.dealerTotal', 'Dealerns synliga total'], ['event.dealerBlackjack', 'Dealern har blackjack'],
  ['event.box', 'Plats vid bordet'], ['event.to', 'Kortets mottagare'], ['event.faceDown', 'Kort med baksidan upp'],
  ['event.hands.outcome', 'Publicerade handresultat'], ['event.hands.box', 'Publicerade handplatser'], ['event.legalActions', 'Tillåtna spelhandlingar'],
  ['event.clip.action', 'Rörelsens källkod'], ['event.blocking', 'Blockerande presentation'], ['event.handIndex', 'Handens index'],
  ['event.shoeDraw', 'Publicerat kortindex'], ['event.card.r', 'Synlig kortvalör'], ['event.card.s', 'Synlig kortfärg']
];
const OPERATOR_LABELS = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', in: 'finns i', includes: 'innehåller', all_eq: 'alla =', exists: 'finns' };
const STAGE_LABELS = { received: 'Händelse mottagen', event: 'Händelse mottagen', matched: 'Händelse i katalogen', match: 'Händelse i katalogen', mapping: 'Händelse i katalogen', triggers: 'Villkor utvärderade', eligible: 'Tillåtna varianter', baseline: 'Standardlinje vald', advice: 'OpenClaws förslag', openclaw: 'OpenClaws anslutning', gate: 'Gaten kontrollerar', selected: 'Variant vald', selection: 'Variant vald', playback: 'Animation spelas', animation: 'Animation vald', policy: 'Policy kontrollerad' };
const ERROR_MESSAGES = { openclaw_not_configured: 'OpenClaw är inte konfigurerad ännu. Servern behöver en Gateway-adress och OPENCLAW_API_KEY.', openclaw_timeout: 'OpenClaw svarade inte inom tidsgränsen.', openclaw_unreachable: 'Servern kunde inte nå OpenClaw Gateway.', invalid_gateway_url: 'OpenClaws Gateway-adress är ogiltig.', catalog_conflict: 'Katalogens revision har ändrats.', forbidden_origin: 'Servern tillät inte anropet från den här adressen.' };
const state = { catalog: null, status: null, scenarios: [], nodeId: null, variantId: null, dirty: false, busy: false, saving: false, run: null, scenarioIndex: 0, conversationId: crypto.randomUUID(), chatBusy: false, lastDecision: null };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showMessage(message, error = false) {
  const box = $('#global-message');
  box.textContent = message;
  box.classList.toggle('error', error);
  box.hidden = !message;
}

async function api(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body === undefined ? undefined : JSON.stringify(body), signal });
  let result;
  try { result = await response.json(); } catch { throw new Error(`Servern gav ett oväntat svar (${response.status}).`); }
  if (!response.ok) {
    const error = new Error(ERROR_MESSAGES[result.error] || result.error || `Förfrågan misslyckades (${response.status}).`);
    error.status = response.status;
    error.details = result.errors;
    throw error;
  }
  return result;
}

const currentNode = () => state.catalog?.events.find((node) => node.id === state.nodeId);
const currentVariant = () => currentNode()?.variants.find((variant) => variant.id === state.variantId);
const selectedMode = () => $('input[name="mode"]:checked')?.value || 'off';
const currentScenario = () => state.scenarios.find((scenario) => scenario.id === $('#scenario-select').value);

function markDirty() {
  state.dirty = true;
  $('#dirty-indicator').hidden = false;
  $('#save-catalog').disabled = state.status?.editable === false || state.busy || state.saving;
  $('#save-message').textContent = 'Lokala ändringar. Spara katalogen före uppspelning för att använda dem.';
  $('#save-message').classList.remove('error');
}

function fillSelect(select, options, value) {
  select.replaceChildren(...options.map((option) => {
    const pair = Array.isArray(option) ? option : [option, option];
    const item = element('option', '', pair[1]);
    item.value = pair[0];
    return item;
  }));
  select.value = value ?? '';
}

function field(labelText, value, onChange, { tag = 'input', type = 'text', options, help } = {}) {
  const label = element('label', 'form-label', labelText);
  const input = element(tag);
  if (tag === 'input') input.type = type;
  if (tag === 'select') fillSelect(input, options, value);
  else input.value = value ?? '';
  input.addEventListener(tag === 'select' || type === 'color' ? 'change' : 'input', () => {
    onChange(input.value);
    markDirty();
  });
  label.append(input);
  if (help) label.append(element('span', 'field-help', help));
  return label;
}

function renderTree() {
  const nav = $('#event-tree');
  const search = $('#event-search').value.toLocaleLowerCase('sv');
  nav.replaceChildren();
  const events = state.catalog?.events || [];
  $('#event-count').textContent = events.length;
  for (const type of Object.keys(SOURCE_LABELS)) {
    const nodes = events.filter((node) => node.sourceType === type && `${node.id} ${node.label} ${node.description || ''}`.toLocaleLowerCase('sv').includes(search));
    if (!nodes.length) continue;
    const group = element('div', 'source-group');
    const heading = element('div', 'source-title', SOURCE_LABELS[type]);
    heading.append(element('code', '', type));
    group.append(heading);
    for (const node of nodes) {
      const button = element('button', `event-item${node.id === state.nodeId ? ' active' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-current', node.id === state.nodeId ? 'true' : 'false');
      button.dataset.nodeId = node.id;
      button.append(element('span', 'event-name', node.label), element('code', '', node.id));
      button.addEventListener('click', () => selectNode(node.id));
      group.append(button);
    }
    nav.append(group);
  }
  if (!nav.children.length) nav.append(element('p', 'empty-state', 'Ingen händelse matchar sökningen.'));
}

function selectNode(id, variantId) {
  state.nodeId = id;
  const node = currentNode();
  state.variantId = variantId || node?.baselineVariantId || node?.variants[0]?.id;
  renderTree();
  renderEditor();
}

function parseConditionValue(raw) {
  if (raw === '') return '';
  try { return JSON.parse(raw); } catch { return raw; }
}

function renderConditions(variant) {
  const box = element('div', 'trigger-box');
  const heading = element('div', 'trigger-title');
  heading.append(element('h3', '', 'Triggers · alla villkor ska stämma'));
  if (variant.id === currentNode()?.baselineVariantId) {
    box.append(heading, element('p', 'trigger-empty', 'Standardlinjen är alltid tillgänglig. Lägg villkor på den andra varianten för att styra när den får väljas.'));
    return box;
  }
  const add = element('button', 'text-button', '+ Villkor');
  add.type = 'button';
  add.addEventListener('click', () => {
    variant.when ||= { all: [] };
    variant.when.all ||= [];
    variant.when.all.push({ path: 'context.chat.signal', op: 'eq', value: 'praise' });
    markDirty(); renderEditor();
  });
  heading.append(add); box.append(heading);
  const conditions = variant.when?.all || [];
  if (!conditions.length) box.append(element('p', 'trigger-empty', 'Inga extra villkor. Varianten kan användas när händelsen matchar.'));
  conditions.forEach((condition, index) => {
    const row = element('div', 'condition-row');
    const path = element('select');
    path.setAttribute('aria-label', `Villkor ${index + 1}, källa`);
    const paths = CONDITION_PATHS.some(([key]) => key === condition.path) ? CONDITION_PATHS : [...CONDITION_PATHS, [condition.path, condition.path]];
    fillSelect(path, paths, condition.path);
    const pathCode = element('code', 'condition-code', condition.path);
    path.addEventListener('change', () => { condition.path = path.value; pathCode.textContent = path.value; markDirty(); });
    const values = element('div', 'condition-values');
    const operator = element('select');
    operator.setAttribute('aria-label', `Villkor ${index + 1}, jämförelse`);
    const operators = Object.entries(OPERATOR_LABELS);
    if (!OPERATOR_LABELS[condition.op]) operators.push([condition.op, condition.op]);
    fillSelect(operator, operators, condition.op);
    operator.addEventListener('change', () => { condition.op = operator.value; markDirty(); });
    const value = element('input');
    value.setAttribute('aria-label', `Villkor ${index + 1}, värde`);
    value.value = typeof condition.value === 'string' ? condition.value : JSON.stringify(condition.value);
    value.addEventListener('input', () => { condition.value = parseConditionValue(value.value); markDirty(); });
    const remove = element('button', 'remove-condition', '×');
    remove.type = 'button'; remove.setAttribute('aria-label', `Ta bort villkor ${index + 1}`);
    remove.addEventListener('click', () => { conditions.splice(index, 1); markDirty(); renderEditor(); });
    values.append(operator, value, remove); row.append(path, pathCode, values); box.append(row);
  });
  if (conditions.length) box.append(element('p', 'field-help', 'Text: praise / inappropriate / de. Booleskt: true / false. Tal: 3.'));
  return box;
}

function renderEditor() {
  const editor = $('#event-editor');
  const node = currentNode();
  editor.replaceChildren();
  if (!node) { editor.append(element('p', 'empty-state', 'Välj en händelse.')); return; }
  const source = element('div', 'event-source');
  source.append(element('span', 'tiny-label', 'FRYST KÄLLKONTRAKT'), element('code', '', `presentation[].type = ${node.sourceType}`), element('span', 'field-help', typeof node.sourceRef === 'string' ? node.sourceRef : 'services/game/partner-presentation.mjs'));
  editor.append(source);
  editor.append(field('Namn i labbet', node.label, (value) => { node.label = value; renderTree(); }));
  editor.append(field('Förklaring', node.description, (value) => { node.description = value; }, { tag: 'textarea' }));
  const path = element('div', 'variant-path');
  path.append(element('p', 'tiny-label', 'HÄNDELSEN FÖRGRENAS TILL'));
  for (const variant of node.variants) {
    const button = element('button', `variant-option${variant.id === state.variantId ? ' active' : ''}`);
    button.type = 'button'; button.dataset.variantId = variant.id;
    button.setAttribute('aria-pressed', variant.id === state.variantId ? 'true' : 'false');
    button.append(element('span', 'lane-label', variant.id === node.baselineVariantId ? 'STANDARD' : 'VARIANT'), element('strong', '', variant.label), element('code', '', variant.id));
    button.addEventListener('click', () => { state.variantId = variant.id; renderEditor(); });
    path.append(button);
  }
  editor.append(path);
  const variant = currentVariant();
  if (variant) {
    const form = element('div', 'variant-editor');
    const row = element('div', 'field-row');
    row.append(field('Variantens namn', variant.label, (value) => { variant.label = value; }), field('Prioritet', variant.priority, (value) => { variant.priority = Number(value); }, { type: 'number' }));
    form.append(row, renderConditions(variant));
    const assets = state.catalog.assets || [];
    form.append(field('Spela den här resursen', variant.assetId, (value) => { variant.assetId = value; renderEditor(); }, { tag: 'select', options: assets.map((asset) => [asset.id, `${asset.label} · ${asset.id}`]) }));
    const asset = assets.find((item) => item.id === variant.assetId);
    if (asset) {
      const assetEditor = element('div', 'asset-editor');
      assetEditor.append(element('p', 'tiny-label', 'VARIANT → RESURS'));
      const assetRow = element('div', 'field-row');
      assetRow.append(field('Resursens namn', asset.label, (value) => { asset.label = value; }), field('Färg', /^#[\da-f]{6}$/i.test(asset.color) ? asset.color : '#315ae8', (value) => { asset.color = value; }, { type: 'color' }));
      assetEditor.append(assetRow);
      if (asset.kind === 'animation') assetEditor.append(field('Enkel rörelse', asset.animation, (value) => { asset.animation = value; }, { tag: 'select', options: ANIMATIONS }));
      else assetEditor.append(element('code', '', asset.src || asset.kind));
      const references = state.catalog.events.flatMap((event) => event.variants).filter((item) => item.assetId === asset.id).length;
      assetEditor.append(element('p', 'asset-preview', `${asset.id} · ${references} ${references === 1 ? 'variant använder' : 'varianter använder'} resursen. Videobanken kan senare kopplas till samma utgång.`));
      form.append(assetEditor);
    }
    const play = element('button', 'button secondary play-selected', '▶ Prova händelsen');
    play.id = 'play-event'; play.type = 'button'; play.disabled = state.busy;
    play.addEventListener('click', () => runEvents([eventForNode(node)], { label: node.label }));
    const preview = element('button', 'button secondary play-selected', 'Förhandsvisa markerad variant');
    preview.id = 'preview-variant'; preview.type = 'button'; preview.disabled = state.busy;
    preview.addEventListener('click', () => previewVariant(node, variant));
    form.append(play, preview, element('p', 'field-help', 'Prova händelsen följer mellanlagrets beslut. Förhandsvisning visar bara markerad variant lokalt.'));
    editor.append(form);
  }
  syncControlLocks();
}

function normalizeScenarios(data) {
  const scenarios = Array.isArray(data) ? data : data.scenarios || [];
  return scenarios.map((scenario) => ({ ...scenario, events: scenario.events || (scenario.input?.event ? [scenario.input.event] : []), context: scenario.context || scenario.input?.context || {} }));
}

function setContext(context = {}) {
  const signal = context.chat?.signal || 'none';
  const signalSelect = $('#chat-signal');
  if (![...signalSelect.options].some((option) => option.value === signal)) signalSelect.add(new Option(signal, signal));
  signalSelect.value = signal;
  const language = context.playerHistory?.preferredLanguage || '';
  const languageSelect = $('#preferred-language');
  if (![...languageSelect.options].some((option) => option.value === language)) languageSelect.add(new Option(language, language));
  languageSelect.value = language;
  $('#returning-player').checked = context.playerHistory?.returning === true;
  $('#recent-wins').value = context.session?.recentWins || 0;
  $('#recent-losses').value = context.session?.recentLosses || 0;
}

function getContext() {
  return { chat: { signal: $('#chat-signal').value }, playerHistory: { returning: $('#returning-player').checked, preferredLanguage: $('#preferred-language').value || null }, session: { recentWins: Math.max(0, Math.min(100, Math.round(Number($('#recent-wins').value) || 0))), recentLosses: Math.max(0, Math.min(100, Math.round(Number($('#recent-losses').value) || 0))) } };
}

function eventForNode(node) {
  if (node.exampleEvent) return structuredClone(node.exampleEvent);
  if (node.example) return structuredClone(node.example);
  const matchedScenario = state.scenarios.find((scenario) => scenario.nodeId === node.id || scenario.id === node.id || scenario.input?.nodeId === node.id);
  if (matchedScenario?.events[0]) return structuredClone(matchedScenario.events[0]);
  const event = { type: node.sourceType };
  const conditions = node.match?.all || [];
  for (const condition of conditions) {
    if (condition.op !== 'eq') continue;
    const parts = condition.path.replace(/^event\./, '').split('.');
    let cursor = event;
    parts.forEach((part, index) => { if (index === parts.length - 1) cursor[part] = structuredClone(condition.value); else cursor = cursor[part] ||= {}; });
  }
  if (node.sourceType === 'deal') {
    const action = event.clip?.action || ['deal-left', 'deal-centre', 'deal-right', 'deal-dealer'].find((item) => node.id.includes(item)) || 'deal-centre';
    Object.assign(event, { to: action === 'deal-dealer' ? 'dealer' : 'box', box: action === 'deal-dealer' ? null : action === 'deal-left' ? 0 : action === 'deal-right' ? 6 : 3, handIndex: 0, card: { r: '8', s: 'S' }, faceDown: false, shoeDraw: 10, clip: { action, fallback: 'slide' } });
  }
  if (node.sourceType === 'settle') Object.assign(event, { dealerTotal: 19, dealerBlackjack: false, hands: [{ box: 3, stake: 5, returned: 10, outcome: 'win' }], ...event });
  if (node.sourceType === 'turn') Object.assign(event, { box: 3, handIndex: 0, legalActions: ['hit', 'stand'], ...event });
  if (node.sourceType === 'reveal') Object.assign(event, { to: 'dealer', card: { r: '9', s: 'H' }, shoeDraw: 11, ...event });
  return event;
}

function setBusy(busy) {
  state.busy = busy;
  syncControlLocks();
}

function syncControlLocks() {
  const locked = state.busy || state.saving;
  const readOnly = state.status?.editable === false;
  for (const selector of ['#play-scenario', '#step-scenario', '#play-import', '#play-event', '#preview-variant']) {
    const button = $(selector);
    if (button) button.disabled = locked || !state.catalog || (['#play-scenario', '#step-scenario'].includes(selector) && !state.scenarios.length);
  }
  $('#save-catalog').disabled = locked || readOnly || !state.dirty;
  $('#stop-playback').disabled = !state.busy;
  $('#scenario-select').disabled = locked;
  document.querySelectorAll('input[name="mode"]').forEach((input) => { input.disabled = locked; });
  document.querySelectorAll('.context-panel input,.context-panel select,#import-events').forEach((input) => { input.disabled = state.busy; });
  $('#event-editor').querySelectorAll('input,select,textarea,button').forEach((control) => {
    if (['play-event', 'preview-variant'].includes(control.id)) return;
    if (control.classList.contains('variant-option')) return;
    control.disabled = locked || readOnly;
  });
}

function compactDetail(detail) {
  if (typeof detail === 'string') return detail;
  if (detail == null) return '';
  return JSON.stringify(detail);
}

function renderDecision(decision) {
  state.lastDecision = decision;
  const node = state.catalog.events.find((item) => item.id === decision.nodeId);
  const selected = typeof decision.selected === 'string' ? node?.variants.find((variant) => variant.id === decision.selected) : decision.selected;
  $('#stage-title').textContent = node?.label || decision.event?.type || 'Händelse';
  $('#stage-event').textContent = decision.nodeId || decision.event?.type || 'Okänd';
  $('#selected-variant').textContent = selected?.label || selected?.id || 'Standardlinje';
  $('#selected-asset').textContent = decision.asset?.id || selected?.assetId || 'Ingen resurs';
  const gate = $('#gate-result');
  gate.className = `pill ${decision.gate?.accepted ? 'success' : decision.provider?.status === 'off' ? 'muted' : 'warning'}`;
  gate.textContent = decision.gate?.accepted ? 'Förslag godkänt' : decision.gate?.reason?.includes('shadow') ? 'Shadow · standard' : 'Standardlinje';
  gate.title = decision.gate?.reason || '';
  $('#stage-caption').textContent = selected?.label || 'Inget val';
  const trace = $('#decision-trace');
  trace.replaceChildren();
  const entries = decision.trace || [];
  entries.forEach((entry, index) => {
    const item = element('li');
    const badge = element('span', `trace-step ${entry.status === 'accepted' || entry.status === 'ok' ? 'accepted' : entry.status === 'fallback' || entry.status === 'rejected' ? 'fallback' : ''}`, String(index + 1).padStart(2, '0'));
    const copy = element('div', 'trace-copy');
    copy.append(element('strong', '', STAGE_LABELS[entry.stage] || entry.stage), element('p', '', compactDetail(entry.detail)));
    item.append(badge, copy, element('span', 'trace-status', entry.status || ''));
    trace.append(item);
  });
  if (!entries.length) trace.append(element('li', 'empty-state', decision.gate?.reason || 'Inget spår returnerades.'));
  $('#decision-json').textContent = JSON.stringify(decision, null, 2);
}

function abortError() { return new DOMException('Uppspelningen stoppades.', 'AbortError'); }

function playAnimation(asset, decision, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const stage = $('#animation-stage');
    const motion = ANIMATIONS.includes(asset?.animation) ? asset.animation : 'idle';
    const duration = Math.max(550, Math.min(3500, Number(asset?.durationMs) || 1600));
    stage.className = 'animation-stage';
    stage.style.setProperty('--asset-color', /^#[\da-f]{6}$/i.test(asset?.color) ? asset.color : '#315ae8');
    stage.style.setProperty('--motion-duration', `${duration}ms`);
    $('#asset-kind').textContent = `Schematisk animation · ${motion}`;
    $('#dealer-scene').hidden = false;
    let done = false, timer = null, firstFrame = null, secondFrame = null;
    const cleanup = () => {
      clearTimeout(timer);
      if (firstFrame !== null) cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
      signal.removeEventListener('abort', aborted);
      stage.className = 'animation-stage';
    };
    const finish = (error) => {
      if (done) return;
      done = true;
      cleanup();
      error ? reject(error) : resolve();
    };
    const aborted = () => finish(abortError());
    signal.addEventListener('abort', aborted, { once: true });
    // Background tabs can suspend animation frames. Completion must not depend
    // on either paint callback, and a late callback must not touch the next event.
    timer = setTimeout(() => finish(), duration + 80);
    firstFrame = requestAnimationFrame(() => {
      if (done || signal.aborted) return;
      secondFrame = requestAnimationFrame(() => {
        if (done || signal.aborted) return;
        stage.classList.add('playing', `motion-${motion}`);
        if (decision.selected?.id !== decision.baseline?.id) stage.classList.add('variant-extra');
      });
    });
  });
}

function safeVideoSource(source) {
  if (typeof source !== 'string' || source.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(source)) return null;
  try {
    const url = new URL(source, location.origin);
    if (url.username || url.password) return null;
    if (url.origin === location.origin && url.pathname.startsWith('/media/')) return url.href;
    if (url.protocol === 'https:') return url.href;
  } catch { /* Invalid source is handled by the visible fallback. */ }
  return null;
}

async function playAsset(asset, decision, signal) {
  if (asset?.kind !== 'video') return playAnimation(asset, decision, signal);
  const source = safeVideoSource(asset.src);
  if (!source) {
    showMessage('Videons källa är ogiltig. Labbet visar en enkel reservanimation.', true);
    return playAnimation({ animation: 'neutral', color: asset.color }, decision, signal);
  }
  try {
    await new Promise((resolve, reject) => {
      if (signal.aborted) { reject(abortError()); return; }
      const video = $('#asset-video');
      let done = false;
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener('ended', ended); video.removeEventListener('error', failed); signal.removeEventListener('abort', aborted);
        video.pause(); video.removeAttribute('src'); video.load(); video.hidden = true; $('#dealer-scene').hidden = false;
      };
      const finish = (error) => { if (done) return; done = true; cleanup(); error ? reject(error) : resolve(); };
      const ended = () => finish();
      const failed = () => finish(new Error('Videon kunde inte spelas.'));
      const aborted = () => finish(abortError());
      const timer = setTimeout(() => finish(new Error('Videon avslutades inte inom labbets tidsgräns.')), 20000);
      video.addEventListener('ended', ended, { once: true }); video.addEventListener('error', failed, { once: true }); signal.addEventListener('abort', aborted, { once: true });
      video.loop = false; video.src = source; video.hidden = false; $('#dealer-scene').hidden = true;
      $('#asset-kind').textContent = 'Exakt videokälla · ingen loop';
      Promise.resolve(video.play()).catch(finish);
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    showMessage(`${error.message} En enkel reservanimation visas.`, true);
    await playAnimation({ animation: 'neutral', color: asset.color }, decision, signal);
  }
}

async function runEvents(events, { label = 'Scenario', startIndex = 0 } = {}) {
  if (state.busy || !events.length) return;
  if (state.dirty) { showMessage('Spara katalogändringarna innan du spelar, så att editorn och besluten använder samma revision.'); return; }
  showMessage('');
  const controller = new AbortController();
  state.run = controller; setBusy(true);
  const context = structuredClone(getContext());
  const mode = selectedMode();
  try {
    for (let index = 0; index < events.length; index++) {
      if (controller.signal.aborted) throw abortError();
      $('#playback-counter').textContent = `${index + 1 + startIndex} / ${events.length + startIndex}`;
      $('#stage-caption').textContent = 'Mellanlagret utvärderar händelsen…';
      const decision = await api('/api/decide', { method: 'POST', body: { requestId: `lab-${crypto.randomUUID()}`, event: events[index], context, mode }, signal: controller.signal });
      renderDecision(decision);
      if (decision.nodeId) selectNode(decision.nodeId, decision.selected?.id);
      await playAsset(decision.asset, decision, controller.signal);
    }
    $('#stage-caption').textContent = `${label} · klart`;
  } catch (error) {
    if (error.name === 'AbortError') $('#stage-caption').textContent = 'Uppspelningen stoppades.';
    else { showMessage(error.message, true); $('#stage-caption').textContent = 'Händelsen kunde inte spelas.'; }
  } finally {
    if (state.run === controller) { state.run = null; setBusy(false); }
  }
}

async function previewVariant(node, variant) {
  if (state.busy) return;
  const asset = state.catalog.assets.find((item) => item.id === variant.assetId);
  if (!asset) { showMessage('Varianten saknar en registrerad resurs.', true); return; }
  const controller = new AbortController();
  state.run = controller; setBusy(true); showMessage('');
  const decision = { nodeId: node.id, event: eventForNode(node), catalogRevision: state.catalog.revision, selected: variant, baseline: node.variants.find((item) => item.id === node.baselineVariantId), asset, provider: { status: 'not_called' }, gate: { accepted: false, reason: 'manual_preview' }, trace: [{ stage: 'Förhandsvisning', status: 'manual', detail: 'Du valde varianten i editorn. Varken triggers, OpenClaw eller besluts-gaten används i den här visuella förhandsvisningen.' }, { stage: 'playback', status: 'local', detail: `${variant.id} → ${asset.id}` }] };
  renderDecision(decision);
  $('#gate-result').textContent = 'Manuell visning';
  $('#gate-result').className = 'pill blue';
  $('#playback-counter').textContent = 'PREVIEW';
  try {
    await playAsset(asset, decision, controller.signal);
    $('#stage-caption').textContent = `${variant.label} · manuell förhandsvisning`;
  } catch (error) {
    if (error.name === 'AbortError') $('#stage-caption').textContent = 'Förhandsvisningen stoppades.';
    else showMessage(error.message, true);
  } finally { if (state.run === controller) { state.run = null; setBusy(false); } }
}

async function saveCatalog() {
  if (!state.dirty || state.busy || state.saving || state.status?.editable === false) return;
  const button = $('#save-catalog');
  const message = $('#save-message');
  state.saving = true; syncControlLocks();
  button.disabled = true; message.classList.remove('error'); message.textContent = 'Validerar och sparar…';
  try {
    const result = await api('/api/catalog', { method: 'PUT', body: { catalog: state.catalog, expectedRevision: state.catalog.revision } });
    state.catalog = result.catalog || result;
    state.dirty = false; $('#dirty-indicator').hidden = true;
    $('#catalog-revision').textContent = `revision ${state.catalog.revision}`;
    message.textContent = 'Sparat. Nästa uppspelning använder den här revisionen.';
    renderTree(); renderEditor();
  } catch (error) {
    message.classList.add('error');
    message.textContent = error.status === 409 ? 'Katalogen har ändrats på servern. Dina ändringar finns kvar här. Kopiera dem innan du laddar om och jämför revisionerna.' : `${error.message}${error.details ? `\n${Array.isArray(error.details) ? error.details.map(compactDetail).join('\n') : compactDetail(error.details)}` : ''}`;
  } finally { state.saving = false; syncControlLocks(); }
}

function appendChat(role, text, error = false) {
  const bubble = element('p', `chat-bubble ${role === 'Du' ? 'user' : ''}${error ? ' error' : ''}`);
  bubble.append(element('span', 'chat-role', role), document.createTextNode(text));
  const log = $('#chat-messages'); log.append(bubble); log.scrollTop = log.scrollHeight;
}

async function sendChat(event) {
  event.preventDefault();
  const input = $('#chat-input');
  const message = input.value.trim();
  if (!message || state.chatBusy) return;
  state.chatBusy = true; $('#send-chat').disabled = true;
  appendChat('Du', message); input.value = '';
  try {
    const response = await api('/api/chat', { method: 'POST', body: { message, conversationId: state.conversationId } });
    if (!response.reply) throw new Error('OpenClaw returnerade inget chatsvar.');
    state.conversationId = response.conversationId || state.conversationId;
    appendChat('OpenClaw', response.reply);
  } catch (error) { appendChat('Anslutning', error.message, true); }
  finally { state.chatBusy = false; $('#send-chat').disabled = false; input.focus(); }
}

function renderStatus() {
  const provider = state.status?.provider || {};
  const configured = provider.configured === true;
  $('#provider-dot').className = `status-dot ${configured ? 'connected' : 'warning'}`;
  $('#provider-status').textContent = configured ? 'OpenClaw konfigurerad' : 'OpenClaw väntar på konfiguration';
  $('#provider-status').title = provider.detail || 'Konfiguration är inte samma sak som verifierad anslutning.';
  $('#service-info').textContent = state.status?.remote?.configured ? 'Lokal yta → fjärrmellanlager' : 'Lokalt mellanlager';
  if (state.status?.editable === false) $('#save-message').textContent = 'Katalogen är skrivskyddad i den här miljön. Redigera lokalt och publicera revisionen.';
}

$('#event-search').addEventListener('input', renderTree);
$('#save-catalog').addEventListener('click', saveCatalog);
$('#scenario-select').addEventListener('change', () => { state.scenarioIndex = 0; const scenario = currentScenario(); setContext(scenario?.context); $('#stage-caption').textContent = scenario?.description || 'Redo att spela.'; });
$('#play-scenario').addEventListener('click', () => { const scenario = currentScenario(); if (scenario) { state.scenarioIndex = 0; runEvents(scenario.events, { label: scenario.label }); } });
$('#step-scenario').addEventListener('click', () => {
  const scenario = currentScenario(); if (!scenario?.events.length) return;
  if (state.dirty) { showMessage('Spara katalogändringarna före nästa steg.'); return; }
  if (state.scenarioIndex >= scenario.events.length) state.scenarioIndex = 0;
  const index = state.scenarioIndex++;
  runEvents([scenario.events[index]], { label: `${scenario.label} · steg ${index + 1}`, startIndex: index });
});
$('#stop-playback').addEventListener('click', () => state.run?.abort());
document.querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener('change', () => {
  $('#mode-description').textContent = { off: 'Standardlinje: kodens standardval spelas. OpenClaw anropas inte.', shadow: 'Shadow: OpenClaw föreslår en variant och beslutet loggas. Kodens standardlinje spelas.', active: 'Aktiv: OpenClaw kan välja en tillåten variant. Vid timeout eller avvisat förslag spelas standardlinjen.' }[selectedMode()];
}));
$('#clear-trace').addEventListener('click', () => { $('#decision-trace').replaceChildren(element('li', 'empty-state', 'Spela en händelse för att följa nästa beslut.')); $('#decision-json').textContent = '{}'; });
$('#play-import').addEventListener('click', () => {
  const result = $('#import-result');
  try {
    const data = JSON.parse($('#import-events').value);
    const events = Array.isArray(data) ? data : Array.isArray(data.presentation) ? data.presentation : data.type ? [data] : null;
    if (!events || !events.length || events.length > 100 || events.some((item) => !item || typeof item !== 'object' || !Object.hasOwn(SOURCE_LABELS, item.type))) throw new Error('Använd 1–100 publika händelser med type: speak, deal, reveal, settle, turn eller idle.');
    result.textContent = `${events.length} händelser inlästa. Servern kontrollerar kontraktet.`;
    runEvents(events, { label: 'Inlästa händelser' });
  } catch (error) { result.textContent = error instanceof SyntaxError ? 'JSON kunde inte läsas. Kontrollera citattecken och kommatecken.' : error.message; }
});
$('#chat-form').addEventListener('submit', sendChat);
$('#chat-input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); $('#chat-form').requestSubmit(); } });
window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });

async function initialize() {
  const results = await Promise.allSettled([api('/api/catalog'), api('/api/scenarios'), api('/api/status')]);
  const [catalog, scenarios, status] = results;
  if (status.status === 'fulfilled') { state.status = status.value; renderStatus(); }
  if (catalog.status !== 'fulfilled') { showMessage(`Labbet kunde inte läsa katalogen: ${catalog.reason.message}`, true); return; }
  state.catalog = catalog.value.catalog || catalog.value;
  if (!Array.isArray(state.catalog.events) || !Array.isArray(state.catalog.assets)) { showMessage('Katalogen har fel format. Events och assets måste vara listor.', true); return; }
  state.scenarios = scenarios.status === 'fulfilled' ? normalizeScenarios(scenarios.value) : [];
  fillSelect($('#scenario-select'), state.scenarios.map((scenario) => [scenario.id, scenario.label]), state.scenarios[0]?.id);
  $('#catalog-revision').textContent = `revision ${state.catalog.revision}`;
  selectNode(state.catalog.events[0]?.id);
  setContext(state.scenarios[0]?.context);
  setBusy(false);
  if (!state.scenarios.length) { $('#play-scenario').disabled = true; $('#step-scenario').disabled = true; }
  if (scenarios.status === 'rejected') showMessage(`Katalogen fungerar, men scenarierna kunde inte läsas: ${scenarios.reason.message}`, true);
  if (status.status === 'rejected') showMessage(`Katalogen fungerar, men anslutningsstatus kunde inte läsas: ${status.reason.message}`, true);
}

initialize().catch((error) => showMessage(error.message, true));
