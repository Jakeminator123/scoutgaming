export const BACKOFFICE_SECTIONS = Object.freeze([
  { id: 'ops', label: 'Driftöversikt' },
  { id: 'lanes', label: 'Spelmotorns grundinställningar' },
  { id: 'voice', label: 'Tal och synkgranskning' },
  { id: 'apikeys', label: 'Partner och API-nycklar' },
  { id: 'emails', label: 'E-postmallar · förhandsvisning' },
  { id: 'users', label: 'Användare och roller' },
  { id: 'rooms', label: 'Registrerade spelrum' },
  { id: 'dealers', label: 'Standarddealer per bordsnivå' },
  { id: 'players', label: 'Spelarkonton' },
  { id: 'pay', label: 'Betalningar och journal' },
  { id: 'shoes', label: 'Kortlek och spelintegritet' },
]);

// Only implemented work surfaces. Retired configuration stays in storage/API
// compatibility contracts until its independent migration is complete.
export const BACKOFFICE_GROUPS = Object.freeze([
  { id: 'operations', label: 'Drift & spelintegritet', area: 'Drift', sections: ['ops', 'shoes'] },
  { id: 'tables', label: 'Spelmotor & rum', area: 'Drift', sections: ['lanes', 'rooms', 'dealers'] },
  { id: 'accounts', label: 'Interna konton & spelare', area: 'Administration', sections: ['players', 'users'] },
  { id: 'partners', label: 'API & integrationer', area: 'Administration', sections: ['apikeys', 'emails'] },
  { id: 'finance', label: 'Betalningar & journal', area: 'Drift', sections: ['pay'] },
  { id: 'media-review', label: 'Talgranskning', area: 'Studio', sections: ['voice'] },
].map(group => Object.freeze({ ...group, sections: Object.freeze(group.sections) })));

export function backofficeGroupId(value) {
  return BACKOFFICE_GROUPS.some(group => group.id === value) ? value : 'operations';
}
