export const DEALER_LANGUAGES = Object.freeze({sv:'🇸🇪 Svenska',en:'🇬🇧 English',es:'🇪🇸 Español',fr:'🇫🇷 Français',zh:'🇨🇳 中文',pt:'🇧🇷 Português',ko:'🇰🇷 한국어'});
export const dealerLanguage = value => Object.hasOwn(DEALER_LANGUAGES,value) ? value : 'en';

export function speechBank(manifest,language='en') {
  return dealerLanguage(language)==='en' ? manifest.repliker : manifest.repliker_sprak?.[language] ?? manifest.repliker;
}

// Keep the reviewed canonical variant, including sidebet_2, in every language.
export function speechForEvent(manifest,event,language='en') {
  const canonical=(event==='sidebet'?manifest.repliker.find(c=>c.id==='sidebet_2'):null)??manifest.repliker.find(c=>c.event===event);
  return canonical && (speechBank(manifest,language).find(c=>c.id===canonical.id) ?? canonical);
}

export function availableLanguages(manifest) {
  // Swedish, Portuguese and Korean are always offered: the ready dealers have their own takes in them (Portuguese since
  // 15 Oct, Korean since 19 Oct), and Astrid falls back to English.
  return Object.keys(DEALER_LANGUAGES).filter(language=>language==='en'||language==='sv'||language==='pt'||language==='ko'||manifest.repliker.length>0&&manifest.repliker.every(c=>manifest.repliker_sprak?.[language]?.some(t=>t.id===c.id&&t.url&&t.dur>0)));
}
