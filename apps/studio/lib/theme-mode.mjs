// Ett lägesval för Admin och Next-sidorna (/partner, inloggningen): klassen dark eller light
// på <html>, sparad i localStorage 'sg-theme'. Mörkt är standard; operativsystemets läge
// används inte. Värdena för varje läge står i packages/ui/tokens.css.
export const themeModeStorageKey = 'sg-theme';
export const themeModes = Object.freeze(['dark', 'light']);
export const defaultThemeMode = 'dark';

// Körs före första målningen: som vanligt <script> i <head> i Next-layouten (app/layout.tsx;
// inte next/script, vars inline-innehåll körs först när Next startar) och som
// /admin/_assets/admin/theme-mode.js i Admin, vars CSP inte tillåter inline-skript.
// Engångsflytt av Partnerportalens tidigare val (localStorage 'sg-partner-theme'): saknas
// sg-theme och var det gamla valet light, sparas light under sg-theme; den gamla nyckeln tas bort.
// Läget bestäms före skrivningarna, så en nekad skrivning ändrar det inte. Ett otillgängligt
// localStorage ger standardläget.
export const themeModeBootstrap = `(function(){var m='dark';try{var s=localStorage,v=s.getItem('sg-theme'),o=s.getItem('sg-partner-theme');if(v===null&&o==='light')v='light';if(v==='light')m='light';if(o!==null){if(m==='light')s.setItem('sg-theme',m);s.removeItem('sg-partner-theme');}}catch(e){}var c=document.documentElement.classList;c.remove('dark','light');c.add(m);})();`;

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
