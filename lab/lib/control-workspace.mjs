import { WORKSPACE_VIEW_SLUGS } from './workspace-surfaces.mjs';

// These are existing internal tools, not new aliases for APIs or role grants.
// Leave unconnected prototype features without a destination rather than
// pretending that a similar-looking production tool implements them.
const tools = Object.freeze({
  players: '/administration', tx: '/administration', team: '/administration',
  api: '/administration', bj: '/administration', dealers: '/administration',
  shoes: '/administration', tables: '/administration',
  background: '/#background', voice: '/#clips', clips: '/#deal',
  media: '/videos', archive: '/videos', tree: '/tree',
});

export function controlToolPath(view) {
  return Object.hasOwn(tools, view) ? tools[view] : null;
}

export function legacyControlView(hash) {
  if (typeof hash !== 'string') return null;
  const value = hash.replace(/^#/, '');
  if (Object.hasOwn(WORKSPACE_VIEW_SLUGS, value)) return value;
  return Object.keys(WORKSPACE_VIEW_SLUGS).find(id => WORKSPACE_VIEW_SLUGS[id] === value) ?? null;
}

export const CONTROL_TOOLS = Object.freeze([
  { href: '/administration', title: 'Lanes, bord & konton', text: 'Skapa och välj lane under Spel, lanes & bord. Hantera personal, spelarkonton och partneråtkomst i samma administration.' },
  { href: '/', title: 'Dealer & klipp', text: 'Välj dealer och arbeta med Idle, Kort & deal, Fasta repliker, bakgrund och klippval.' },
  { href: '/tree', title: 'Presentationshändelser & regler', text: 'Koppla spelhändelser till klippuppsättningar och granska villkor och urvalsregler.' },
  { href: '/videos', title: 'Klippbibliotek', text: 'Granska registrerat material. Klippinställningar hör till respektive dealer i Dealer & klipp.' },
  { href: '/openclaw', title: 'OpenClaw & drift', text: 'Hantera den befintliga anslutningen, rådgivningen och driftinställningarna.' },
  { href: '/activity', title: 'Uppspelningsdiagnostik', text: 'Följ händelser och kvitton från den anslutna spelytan.' },
].map(item => Object.freeze(item)));
