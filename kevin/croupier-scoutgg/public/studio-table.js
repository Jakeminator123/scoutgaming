// A Table Studio table (?table=<slug>): the operator's logo in the header and/or printed on the felt.
// Its felt colour is applied by table-style.js; its limits and name come with the table state (shared-table.js).
import { readLogo } from './felt-logo.js';
const slug = new URLSearchParams(location.search).get('table');
if (slug && /^[a-z0-9_-]{1,40}$/.test(slug)) {
  try {
    const r = await fetch('/api/studio/table?slug=' + encodeURIComponent(slug));
    if (r.ok) {
      const t = await r.json();
      document.title = `${t.name} | Live Blackjack`;
      // Back to the studio (it reopens on this table's Ready screen): beside the stage on wide screens, in Settings on phones.
      const back = document.createElement('a'); back.href = '/studio/?resume'; back.className = 'studio-back'; back.textContent = '← Back to Table Studio';
      document.body.append(back);
      const inSettings = back.cloneNode(true); inSettings.className = 'studio-back-setting';
      document.querySelector('.settings-popover h3')?.after(inSettings);
      // The felt carries a printed brand slot: the Scout wordmark until the operator's logo replaces it.
      // SVG elements have no .hidden property: the attribute itself has to go.
      document.querySelector('#feltBrand').removeAttribute('hidden');
      // Only a raster data URL (the server refuses anything else); set as a source, never as markup.
      if (typeof t.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(t.logo)) {
        const ink = await readLogo(t.logo);
        if (t.logoPos !== 'felt') { const img = document.querySelector('#tableLogo'); img.src = t.logo; img.alt = t.name; img.classList.toggle('dark-logo', Boolean(ink?.dark)); img.removeAttribute('hidden'); }
        if (t.logoPos !== 'header' && ink) {
          const logo = document.querySelector('#feltLogo'); logo.setAttribute('href', ink.mask); logo.removeAttribute('hidden');
          document.querySelector('#feltWordmark').setAttribute('hidden', '');
        }
      }
    }
  } catch {}
}
