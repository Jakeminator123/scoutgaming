export const BACKOFFICE_SECTIONS = Object.freeze([
  { id: 'ops', label: 'Driftöversikt' },
  { id: 'lanes', label: 'Spel och lanes' },
  { id: 'voice', label: 'Tal och synkgranskning' },
  { id: 'clips', label: 'Äldre klipp och granskning' },
  { id: 'gens', label: 'Genererat material' },
  { id: 'apikeys', label: 'Partner och API-nycklar' },
  { id: 'emails', label: 'E-postmallar' },
  { id: 'users', label: 'Användare och roller' },
  { id: 'rooms', label: 'Bord och rum' },
  { id: 'dealers', label: 'Dealers' },
  { id: 'pit', label: 'Pit bosses' },
  { id: 'tours', label: 'Turneringar' },
  { id: 'players', label: 'Spelarkonton' },
  { id: 'pay', label: 'Betalningar och journal' },
  { id: 'shoes', label: 'Shoe och spelintegritet' },
]);

// All existing functions remain reachable, but only inside the Backoffice area.
export const BACKOFFICE_GROUPS = Object.freeze([
  { id: 'operations', label: 'Drift & spelintegritet', sections: ['ops', 'shoes'] },
  { id: 'tables', label: 'Spel, lanes & bord', sections: ['lanes', 'rooms', 'dealers', 'pit', 'tours'] },
  { id: 'accounts', label: 'Konton', sections: ['players', 'users'] },
  { id: 'partners', label: 'Partner', sections: ['apikeys', 'emails'] },
  { id: 'finance', label: 'Betalningar & journal', sections: ['pay'] },
  { id: 'media-review', label: 'Mediegranskning', sections: ['voice', 'clips', 'gens'] },
].map(group => Object.freeze({ ...group, sections: Object.freeze(group.sections) })));
