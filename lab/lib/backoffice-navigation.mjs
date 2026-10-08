export const BACKOFFICE_SECTIONS = Object.freeze([
  { id: 'ops', label: 'Driftöversikt' },
  { id: 'lanes', label: 'Spel och lanes' },
  { id: 'voice', label: 'Tal och synkgranskning' },
  { id: 'apikeys', label: 'Partner och API-nycklar' },
  { id: 'emails', label: 'E-postmallar · förhandsvisning' },
  { id: 'users', label: 'Användare och roller' },
  { id: 'rooms', label: 'Bord och rum' },
  { id: 'dealers', label: 'Dealer per bordsnivå' },
  { id: 'players', label: 'Spelarkonton' },
  { id: 'pay', label: 'Betalningar och journal' },
  { id: 'shoes', label: 'Shoe och spelintegritet' },
]);

// Only implemented work surfaces. Retired configuration stays in storage/API
// compatibility contracts until its independent migration is complete.
export const BACKOFFICE_GROUPS = Object.freeze([
  { id: 'operations', label: 'Drift & spelintegritet', sections: ['ops', 'shoes'] },
  { id: 'tables', label: 'Spel, lanes & bord', sections: ['lanes', 'rooms', 'dealers'] },
  { id: 'accounts', label: 'Konton', sections: ['players', 'users'] },
  { id: 'partners', label: 'Partnernycklar', sections: ['apikeys', 'emails'] },
  { id: 'finance', label: 'Betalningar & journal', sections: ['pay'] },
  { id: 'media-review', label: 'Talgranskning', sections: ['voice'] },
].map(group => Object.freeze({ ...group, sections: Object.freeze(group.sections) })));

export function backofficeGroupId(value) {
  return BACKOFFICE_GROUPS.some(group => group.id === value) ? value : 'operations';
}
