// Ett lägesval för Admin och Next-sidorna (/partner, inloggningen): klassen dark eller light
// på <html>, sparad i localStorage 'sg-theme'. Mörkt är standard; operativsystemets läge
// används inte. Värdena för varje läge står i packages/ui/tokens.css.
export const themeModeStorageKey = 'sg-theme';
export const themeModes = Object.freeze(['dark', 'light']);
export const defaultThemeMode = 'dark';

// Körs före första målningen: inline i Next-layouten och som /admin/_assets/admin/theme-mode.js
// i Admin, vars CSP inte tillåter inline-skript. Ett otillgängligt localStorage ger standardläget.
export const themeModeBootstrap = `(function(){var m='dark';try{if(localStorage.getItem('sg-theme')==='light')m='light';}catch(e){}var c=document.documentElement.classList;c.remove('dark','light');c.add(m);})();`;

export function normalizeThemeMode(value) {
  return value === 'light' ? 'light' : defaultThemeMode;
}

export function readThemeMode(doc = globalThis.document) {
  return doc?.documentElement?.classList.contains('light') ? 'light' : defaultThemeMode;
}

// Byter läge på sidan direkt och sparar valet. Ett nekat localStorage hindrar inte bytet.
export function applyThemeMode(value, { document: doc = globalThis.document, storage } = {}) {
  const mode = normalizeThemeMode(value);
  const classes = doc?.documentElement?.classList;
  if (classes) { classes.remove('dark', 'light'); classes.add(mode); }
  try { (storage ?? globalThis.localStorage)?.setItem(themeModeStorageKey, mode); }
  catch { /* Valet gäller ändå på den öppna sidan. */ }
  return mode;
}
