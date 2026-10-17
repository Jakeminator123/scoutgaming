// Player table choices inside the lane the server already published.
// Storage is per company in this browser. The account columns are N3.3's later step.
// A baked background has no separate layer in the production film, so that
// control stays disabled. Table colour paints DOM and SVG only: the felt mark,
// the wallet edge and the chip row. It does not change the dealer film.
import { isOperatorSlug } from '../../../packages/navigation/operator-slug.mjs';

const TABLE_COLOR = /^#[0-9a-f]{6}$/;
const DEALER_NAMES = Object.freeze({ vera: 'Vera', astrid: 'Astrid', amira: 'Amira', mei: 'Mei', paow: 'Paow', dragge: 'Dragge', nora: 'Nora' });

export function choicesStorageKey(operator, previewSessionId = null) {
  if(previewSessionId!==null){
    if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(previewSessionId))throw Error('Invalid preview storage');
    return 'croupier.studio-preview.'+previewSessionId+'.choices';
  }
  return `croupier.choices.${isOperatorSlug(operator) ? operator : 'default'}`;
}

export function parseStoredChoices(raw) {
  if (typeof raw !== 'string' || raw.length > 4000) return {};
  let value;
  try { value = JSON.parse(raw); } catch { return {}; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const stored = {};
  if (typeof value.dealer === 'string') stored.dealer = value.dealer;
  if (typeof value.tableColor === 'string') stored.tableColor = value.tableColor;
  if (typeof value.tableAsset === 'string') stored.tableAsset=value.tableAsset;
  if (typeof value.background === 'string') stored.background = value.background;
  return stored;
}

export function readChoices(storage, operator, previewSessionId = null) {
  try { return parseStoredChoices(storage.getItem(choicesStorageKey(operator,previewSessionId))); }
  catch { return {}; }
}

export function writeChoices(storage, operator, nextStored, previewSessionId = null) {
  const key = choicesStorageKey(operator,previewSessionId);
  try {
    if (!nextStored || !Object.keys(nextStored).length) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(nextStored));
  } catch { /* A private-mode store keeps this visit in memory only. */ }
}

export function lobbyChoiceText(stored) {
  if (!stored || typeof stored !== 'object') return '';
  const parts = [];
  if (DEALER_NAMES[stored.dealer]) parts.push(`Dealer ${DEALER_NAMES[stored.dealer]}`);
  if (TABLE_COLOR.test(stored.tableColor)) parts.push(`bord ${stored.tableColor}`);
  return parts.join(' · ');
}

function one(params, key) {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : '';
}

// URL wins over the player, the player over the company's colour, the company
// over the lane default. A value outside gameChoices is dropped from storage.
// Background is stored only; this pass does not paint it.
export function resolvePlayerSelection({ choices, search = '', stored = {}, branding = null, currentDealer = '', composition = null } = {}) {
  const dealers = Array.isArray(choices?.dealers) ? choices.dealers : [];
  const colors = Array.isArray(choices?.tableColors) ? choices.tableColors : [];
  const background = choices?.background && typeof choices.background === 'object' ? choices.background : {};
  const allowedBackground = Array.isArray(background.allowed) ? background.allowed : [];
  const baked = background.mode === 'baked' && !allowedBackground.length;
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const urlDealer = dealers.includes(one(params, 'dealer')) ? one(params, 'dealer') : '';
  const urlColor = colors.includes(one(params, 'table')) ? one(params, 'table') : '';
  const storedDealer = dealers.includes(stored?.dealer) ? stored.dealer : '';
  const storedColor = colors.includes(stored?.tableColor) ? stored.tableColor : '';
  const tableAssets=composition?.table?.allowed??[];
  const tableValue=tableAssets.includes(stored?.tableAsset)?stored.tableAsset:tableAssets.includes(branding?.table)?branding.table:composition?.table?.default??null;
  const companyBackground=allowedBackground.includes(branding?.background)?branding.background:background.default??null;
  const storedBackground = !baked && allowedBackground.includes(stored?.background) ? stored.background : '';
  const companyColor = TABLE_COLOR.test(branding?.color) && (colors.length === 0 || colors.includes(branding.color)) ? branding.color : '';
  const laneColor = colors.includes(choices?.tableDefault) ? choices.tableDefault : '';
  const companyDealer=dealers.includes(branding?.dealer)?branding.dealer:'';
  let dealer = currentDealer;
  let navigateDealer = null;
  if (urlDealer) {
    dealer = urlDealer;
    if (urlDealer !== currentDealer) navigateDealer = urlDealer;
  } else if (storedDealer) {
    dealer = storedDealer;
    if (storedDealer !== currentDealer) navigateDealer = storedDealer;
  }
  if(!urlDealer&&!storedDealer&&companyDealer&&companyDealer!==currentDealer){dealer=companyDealer;navigateDealer=companyDealer;}
  const nextStored = {};
  if (urlDealer || storedDealer) nextStored.dealer = urlDealer || storedDealer;
  if (urlColor || storedColor) nextStored.tableColor = urlColor || storedColor;
  if (storedBackground) nextStored.background = storedBackground;
  if(tableAssets.includes(stored?.tableAsset))nextStored.tableAsset=stored.tableAsset;
  return {
    dealer,
    navigateDealer,
    tableColor: urlColor || storedColor || companyColor || laneColor || null,
    backgroundDisabled: baked,
    backgroundValue: baked?null:storedBackground || companyBackground,
    ...(composition?{tableValue}:{}),
    applyBackground: Boolean(composition&&!baked),
    nextStored,
  };
}

export function applyTableColor(document, color) {
  if (!TABLE_COLOR.test(color) || !document?.documentElement) return false;
  const root = document.documentElement;
  root.style.setProperty('--table-felt', color);
  root.dataset.tableColor = color;
  const paint = (selector, property, value) => {
    const node = document.querySelector(selector);
    if (node) node.style.setProperty(property, value);
  };
  paint('#felt-brand', 'color', color);
  paint('#wallet', 'border-left-color', color);
  paint('#chip-row', 'box-shadow', `inset 0 0 0 2px ${color}`);
  paint('#table-pick', 'border-color', color);
  return true;
}

function choiceButton(document, label, pressed) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('aria-pressed', String(pressed));
  return button;
}

export function mountPlayerChoices(document, {
  choices, names = DEALER_NAMES, currentDealer, tableColor, backgroundValue,
  isBusy = () => false, onDealer, onTableColor, onBackground, onTable, tableValue, composition, dealerAvailability = null, summaryLabel = 'Ditt bord',
} = {}) {
  const anchor = document.querySelector?.('#table-pick');
  if (!choices || !anchor) return null;
  const panel = document.createElement('details');
  panel.id = 'player-choices';
  const summary = document.createElement('summary');
  summary.textContent = summaryLabel;
  panel.append(summary);
  const status = document.createElement('p');
  status.id = 'player-choices-status';
  status.setAttribute('role', 'status');

  const dealerRow = document.createElement('div');
  dealerRow.className = 'choice-row';
  const dealerLabel = document.createElement('span');
  dealerLabel.textContent = 'Dealer';
  dealerRow.append(dealerLabel);
  for (const id of choices.dealers) {
    const button = choiceButton(document, names[id] || id, id === currentDealer);
    button.dataset.dealer = id;
    if(dealerAvailability&&!dealerAvailability.some(row=>row.id===id&&row.playable)){
      button.disabled=true;button.title='Saknar spelbart grundklipp. Lägg till det under Dealers & klipp.';button.textContent+=' · grundklipp saknas';
    }
    button.onclick = () => {
      if (button.disabled || id === currentDealer) return;
      if (isBusy()) { status.textContent = 'Avsluta rundan innan du byter dealer.'; return; }
      onDealer?.(id);
    };
    dealerRow.append(button);
  }
  panel.append(dealerRow);

  if (choices.tableColors.length) {
    const tableRow = document.createElement('div');
    tableRow.className = 'choice-row';
    const tableLabel = document.createElement('span');
    tableLabel.textContent = 'Bordsfärg';
    tableRow.append(tableLabel);
    for (const color of choices.tableColors) {
      const button = choiceButton(document, '', color === tableColor);
      button.className = 'swatch';
      button.style.background = color;
      button.setAttribute('aria-label', `Bordsfärg ${color}`);
      button.dataset.tableColor = color;
      button.onclick = () => {
        for (const other of tableRow.querySelectorAll('.swatch')) other.setAttribute('aria-pressed', String(other === button));
        onTableColor?.(color);
      };
      tableRow.append(button);
    }
    panel.append(tableRow);
  }

  if(composition) {
    const row=document.createElement('div');row.className='choice-row';
    const label=document.createElement('span');label.textContent='Bord';row.append(label);
    for(const id of composition.table.allowed) {
      const button=choiceButton(document,composition.assets.find(asset=>asset.id===id)?.label??id,id===tableValue);
      button.dataset.tableAsset=id;button.onclick=()=>{if(isBusy()){status.textContent='Avsluta rundan innan du byter bord.';return;}for(const other of row.querySelectorAll('button'))other.setAttribute('aria-pressed',String(other===button));onTable?.(id);};row.append(button);
    }
    panel.append(row);
  }
  const backgroundRow = document.createElement('div');
  backgroundRow.className = 'choice-row';
  const backgroundLabel = document.createElement('span');
  backgroundLabel.textContent = 'Bakgrund';
  backgroundRow.append(backgroundLabel);
  if (choices.background?.mode === 'baked' && !(choices.background.allowed?.length)) {
    const button = choiceButton(document, 'Bakgrund saknas i paketet', false);
    button.disabled = true;
    backgroundRow.append(button);
  } else {
    for (const id of choices.background?.allowed ?? []) {
      const button = choiceButton(document, composition?.assets.find(asset=>asset.id===id)?.label??id, id === backgroundValue);
      button.dataset.background = id;
      button.onclick = () => {
        if(isBusy()){status.textContent='Avsluta rundan innan du byter bakgrund.';return;}
        for (const other of backgroundRow.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
        onBackground?.(id);
      };
      backgroundRow.append(button);
    }
  }
  panel.append(backgroundRow, status);
  anchor.before(panel);
  return panel;
}
