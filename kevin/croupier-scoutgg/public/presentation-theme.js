// John Claude Design colour and chip definitions. Keep the game and BO copies identical.
const th = {
  rgb: h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; },
  hex: (r, g, b) => '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase(),
  lum(h) { const c = th.rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; },
  cr(a, b) { const [x, y] = [th.lum(a), th.lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); },
  on: h => th.cr(h, '#0A0B0D') >= th.cr(h, '#FFFFFF') ? '#0A0B0D' : '#FFFFFF',
  mix(a, b, t) { const A = th.rgb(a), B = th.rgb(b); return th.hex(...A.map((v, i) => v + (B[i] - v) * t)); },
  sat(h) { const [r, g, b] = th.rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; },
  hue(h) { const [r, g, b] = th.rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; },
  dist(a, b) { const A = th.rgb(a), B = th.rgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); },
};
const TH_VALUES = [5, 10, 25, 50, 100, 500];
const TH_FONTS = ['Inter', 'Space Grotesk', 'DM Sans', 'Manrope', 'IBM Plex Sans', 'Work Sans', 'Figtree'];
const TH_SCOUT = { name: 'Scout', primary: '#D6FF3A', surface: '#0A0B0D', text: '#F2F1ED', accent: '#DBC18A', secondary: '#F2F1ED', font: 'Inter', radius: 'pill', chipMode: 'auto', chips: {}, cardBack: '#0A0B0D', cardAccent: '#D6FF3A', cardPattern: 'border', faces: 'classic', logo: null, wordmark: 'scout/gaming' };
const TH_DEFAULTS = {
 scout:{...TH_SCOUT},
  nrk: { ...TH_SCOUT, name: 'Norrsken', primary: '#7FE3B8', surface: '#0B1F1A', text: '#EEF6F2', accent: '#E9DDB8', secondary: '#EEF6F2', font: 'Manrope', cardBack: '#0B1F1A', cardAccent: '#7FE3B8', cardPattern: 'lines', wordmark: 'Norrsken Casino' },
  bfj: { ...TH_SCOUT, name: 'BetFjord', primary: '#4C8DFF', surface: '#0D1526', text: '#F3F6FB', accent: '#F2C14E', secondary: '#F3F6FB', font: 'DM Sans', radius: 'rounded', cardBack: '#13244A', cardAccent: '#F3F6FB', cardPattern: 'border', faces: 'four', wordmark: 'BetFjord' },
  aur: { ...TH_SCOUT, name: 'Aurora', primary: '#FF6B8B', surface: '#1B0D14', text: '#FBF1F4', accent: '#E9DDB8', secondary: '#FBF1F4', font: 'Work Sans', radius: 'rounded', cardBack: '#5A1A2C', cardAccent: '#E9DDB8', cardPattern: 'monogram', wordmark: 'Aurora Spel' },
};
const TH_SETS = [
  { id: 'scout', name: 'Scout', fills: ['#F2F1ED', '#5A6470', '#D6FF3A', '#DBC18A', '#0A0B0D', '#0A0B0D'], rims: { 100: '#F2F1ED', 500: '#D6FF3A' }, texts: { 500: '#D6FF3A' } },
  { id: 'classic', name: 'Casino classic', fills: ['#C8102E', '#1F4E9E', '#1E7A45', '#E07A1F', '#111111', '#5B2A86'], rims: { all: '#F2F1ED' } },
  { id: 'mono', name: 'Monochrome', fills: ['#F2F1ED', '#C9C7C1', '#8E9096', '#5A6470', '#2A2D33', '#0A0B0D'] },
  { id: 'nordic', name: 'Nordic', fills: ['#E8EEF2', '#7FA7C9', '#2F6F8F', '#C9A96E', '#1D3B4A', '#0B1F2A'], rims: { 500: '#C9A96E' }, texts: { 500: '#C9A96E' } },
  { id: 'emerald', name: 'Emerald & gold', fills: ['#F4EEDC', '#3F8F6B', '#145C43', '#D4AF37', '#0E2E24', '#111111'], rims: { 100: '#D4AF37', 500: '#D4AF37' }, texts: { 500: '#D4AF37' } },
  { id: 'ocean', name: 'Ocean', fills: ['#DFF3F7', '#54B6D1', '#1C7FA6', '#F2C14E', '#0D3B66', '#081C33'], rims: { 500: '#F2C14E' }, texts: { 500: '#F2C14E' } },
  { id: 'sunset', name: 'Sunset', fills: ['#FFE3C2', '#FF9F5A', '#E8505B', '#B83280', '#5B2A86', '#1F1235'], rims: { 500: '#FF9F5A' }, texts: { 500: '#FF9F5A' } },
  { id: 'berry', name: 'Berry', fills: ['#FBE4EA', '#F28AA9', '#C2185B', '#7B1FA2', '#3E1045', '#140A1A'], rims: { 500: '#F28AA9' }, texts: { 500: '#F28AA9' } },
  { id: 'neon', name: 'Neon', fills: ['#F2F1ED', '#00E0FF', '#D6FF3A', '#FF3DA8', '#7A5CFF', '#0A0B0D'], rims: { 500: '#00E0FF' }, texts: { 500: '#00E0FF' } },
  { id: 'burgundy', name: 'Burgundy luxe', fills: ['#F4E8D8', '#B08D57', '#7A1F2B', '#C9A96E', '#3A0D14', '#1A0508'], rims: { 100: '#C9A96E', 500: '#C9A96E' }, texts: { 500: '#C9A96E' } },
];
function thSetChips(s) {
  const o = {};
  TH_VALUES.forEach((v, i) => { const f = s.fills[i], tx = (s.texts && s.texts[v]) || th.on(f); o[v] = { fill: f, text: tx, rim: (s.rims && (s.rims[v] || s.rims.all)) || tx }; });
  return o;
}
function thChips(t) {
  if (t.chipMode === 'set') return thSetChips(TH_SETS.find(s => s.id === t.chipSet) || TH_SETS[0]);
  const auto = { 5: t.text, 10: th.mix(t.surface, t.text, .42), 25: t.primary, 50: t.accent, 100: t.surface, 500: t.surface };
  const o = {};
  TH_VALUES.forEach(v => {
    const c = t.chipMode === 'custom' && t.chips[v] ? t.chips[v] : auto[v];
    const txt = v === 500 && t.chipMode !== 'custom' ? t.primary : th.on(c);
    o[v] = { fill: c, text: txt, rim: v === 500 && t.chipMode !== 'custom' ? t.primary : v === 100 ? t.text : txt };
  });
  return o;
}

export {th,TH_VALUES,TH_DEFAULTS,TH_SETS,thChips};
