// Separate presentation routes share the same origin, session and game API.
export const V2_DEALERS = ['astrid', 'amira'];
export function dealerVersionPath(dealer, version) {
  const key = ['vera', 'astrid', 'amira', 'mei'].includes(dealer) ? dealer : 'vera';
  return `${version === 'v2' && V2_DEALERS.includes(key) ? '/v2/' : '/'}?dealer=${key}`;
}

export function installDealerVersionSwitcher({ dealer, version, isBusy }) {
  const picker = document.querySelector('#dealer-picker');
  if (!picker || picker.dataset.versions) return;
  picker.dataset.versions = version;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('./dealer-version-switcher.css', import.meta.url).href;
  document.head.appendChild(css);
  const status = picker.querySelector('#dealer-switch-status');
  const original = document.createElement('div'); original.className = 'dealer-original-row';
  for (const child of [...picker.children]) if (child !== status) original.appendChild(child);
  picker.prepend(original);
  const navigate = (key, nextVersion) => {
    if (key === dealer && nextVersion === version) return;
    if (isBusy()) {
      status.textContent = 'Finish this round to change tables.';
      return;
    }
    location.assign(dealerVersionPath(key, nextVersion));
  };
  for (const button of original.querySelectorAll('[data-dealer]')) {
    button.setAttribute('aria-pressed', String(version === 'original' && button.dataset.dealer === dealer));
    button.onclick = () => navigate(button.dataset.dealer, 'original');
  }
  const row = document.createElement('div'); row.id = 'dealer-v2-options';
  row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'V2 dealer tables');
  const label = document.createElement('span'); label.className = 'dealer-version-label'; label.textContent = 'V2 TABLES'; row.appendChild(label);
  for (const key of V2_DEALERS) {
    const name = key === 'astrid' ? 'Astrid' : 'Amira';
    const button = document.createElement('button'); button.type = 'button'; button.dataset.dealer = key;
    button.setAttribute('aria-label', `${name} V2`);
    button.setAttribute('aria-pressed', String(version === 'v2' && key === dealer));
    const image = document.createElement('img'); image.src = `/dealers/${key}/poster.jpg`; image.alt = '';
    const text = document.createElement('span'); text.textContent = `${name} V2`;
    button.append(image, text); button.onclick = () => navigate(key, 'v2'); row.appendChild(button);
  }
  picker.insertBefore(row, status);
  const measure = () => document.documentElement.style.setProperty('--dealer-picker-height', `${Math.ceil(picker.getBoundingClientRect().height)}px`);
  new ResizeObserver(measure).observe(picker); measure();
}
