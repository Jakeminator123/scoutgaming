// The native administration view under System and Drift: its groups (one menu
// choice each) and the sections inside them. Labels are the page headings.
export const SYSTEM_SECTIONS = Object.freeze([
  { id: 'ops', label: 'Driftöversikt' },
  { id: 'shoes', label: 'Kortlek och spelintegritet' },
  { id: 'players', label: 'Spelarkonton' },
  { id: 'users', label: 'Användare och roller' },
  { id: 'apikeys', label: 'Partner och API-nycklar' },
  { id: 'emails', label: 'E-postmallar · förhandsvisning' },
  { id: 'pay', label: 'Betalningar och journal' },
].map(section => Object.freeze(section)));

export const SYSTEM_GROUPS = Object.freeze([
  { id: 'operations', label: 'Spelstatus & integritet', area: 'Drift', sections: ['ops', 'shoes'] },
  { id: 'accounts', label: 'Konton & åtkomst', area: 'System', sections: ['players', 'users'] },
  { id: 'partners', label: 'Integrationer', area: 'System', sections: ['apikeys', 'emails'] },
  { id: 'finance', label: 'Betalningar & journal', area: 'Drift', sections: ['pay'] },
].map(group => Object.freeze({ ...group, sections: Object.freeze(group.sections) })));
