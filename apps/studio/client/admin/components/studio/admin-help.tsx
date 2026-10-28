import Link from '../../../runtime/navigation';
import {HubPage,Card,KV} from '../ui/hub';
import {adminNavigationGroups,adminDealerSteps,adminDealerTabs,adminCompanyTabs,adminSystemTabs} from '../../lib/admin-navigation';

// Hjälp (/admin/guide): the menu, who may change what, the words, the dealer flow and where the data comes from.
const GUIDE='https://github.com/Jakeminator123/scoutgaming/blob/main/apps/studio/docs/README.md';
const GLOSSARY='https://github.com/Jakeminator123/scoutgaming/blob/main/apps/studio/docs/TERMINOLOGI.md';
// Per page/tab: the read that fills it, and where that read ends up. Verified against docs/plans/ADMIN-KARTA.md 2026-10-28.
const sources:[string,string,string][]=[
  ['Översikt','GET /admin/_data/catalog + /studio/api/videos','doc.project, doc.administration, operators, operator_packages, media_records'],
  ['Dealers','GET /admin/_data/catalog + /studio/api/videos','doc.project dealers[], lines[]; media_records'],
  ['Dealers › Klippkarta','GET /admin/_data/catalog + /studio/api/videos; PUT /studio/api/project; POST /studio/api/videos/upload','doc.project lines[], idlePolicy; media_records; Blob dealers/<id>/'],
  ['Dealers › Röst och tal','samma läsning; POST /studio/api/speech-build; GET /studio/api/replies; POST /api/chat; A:moving-drift','doc.project dealers[].speechProfile; media_records; speech_reply_records; moving_drift_control'],
  ['Dealers › Landningar','filmad profil i koden (filmed-profiles/registry.mjs); doc.project lanes[]','ingen lagring per dealer ännu; mäts efter O03'],
  ['Dealers › Används av','GET /admin/_data/catalog + /studio/api/project + /studio/api/videos; A:resource-lifecycle','doc.project, doc.administration, operators, operator_packages'],
  ['Dealers › Inställningar','POST /studio/api/dealers/{archive,delete}; PUT /studio/api/project','doc.project dealers[], dealerTrash[], dealerSets[]; media_records; Blob'],
  ['Scenmallar','GET /admin/_data/catalog + /studio/api/videos; PUT /studio/api/project; A:operator-package publish-scene-layout','doc.project lanes[]; operator_packages'],
  ['Bakgrunder och bordsgrafik','POST /studio/api/layer-assets/upload; A:material-trash','doc.project layerAssets[], layerAssetTrash[]; Blob backgrounds/, tables/'],
  ['Bolag och spelbord','GET /admin/_data/catalog; A:resource-lifecycle; GET /studio/api/admin/workspace/companies','operators, operator_roles, operator_memberships, operator_packages; doc.administration rooms[]'],
  ['Bolag › Spelbord › Papperskorg (även Alla spelbord)','GET /admin/_data/catalog (rooms[].state = archived); GET /api/admin/resource-lifecycle; A:room-lifecycle {archived:false}','doc.administration rooms[].state, archivedAt; spelbordet återställs pausat'],
  ['Bolag › Tilldelning','A:operator-package {operatorId, lanes, expectedPackageRevision}','operator_packages (ny revision), fryst presentation'],
  ['Bolag › Team','A:operator-create, A:operator-membership, A:operator-role','operators, operator_roles, operator_memberships, croupier_auth.users (inbjudan)'],
  ['Bolag › Journal','GET /studio/api/partner/journal','operator_audit_events, operator_branding_drafts'],
  ['Spelbordet','GET /studio/api/partner/branding; A:room-game-config; A:room-state; A:room-lifecycle','operator_branding_drafts, operator_packages; doc.administration roomGameConfigs, rooms[].state; shared_table_configs'],
  ['System › Drift','A:overview, A:shoes, A:shared-table-proof','doc.administration, players, transactions, blackjack_tables, shared_table_shoes, shared_table_audit'],
  ['System › AI-agenter','GET/PATCH /studio/api/openclaw/admin','Director-tjänsten på Render (inte Neon); OPENAI_API_KEY-flaggan ur miljön'],
  ['System › Scoutgamings personal','A:users; users/invite, resend, role, remove','croupier_auth.users, tokens'],
  ['System › Spelarkonton','A:players, A:transactions; players/create, status, password','croupier_game.players, player_accounts, transactions, player_admin_events'],
  ['System › Integration','A:apikeys, A:emails; apikeys/create, revoke, rotate, launch, credit','croupier_auth.api_keys (globala tills steg F)'],
  ['System › Beroenden','GET /admin/_data/catalog + /studio/api/project + /studio/api/videos; A:resource-lifecycle','doc.project, doc.administration, operators, operator_packages'],
];

export function AdminHelp() {
  return <HubPage title="Hjälp" intro="Vad varje menyval gör, vem som får ändra vad, orden vi använder och var uppgifterna kommer ifrån." actions={<><a className="hub-btn" href={GUIDE} target="_blank" rel="noopener">Användarguiden ↗</a><a className="hub-btn" href={GLOSSARY} target="_blank" rel="noopener">Ordlistan ↗</a></>}>
    <div className="hub-grid c2">
      <Card title="Menyn (6 val)">
        <KV items={[['Översikt',<><Link href="/admin">Översikt</Link> · det som väntar på dig, med länk till platsen där det åtgärdas.</>],
          ...adminNavigationGroups.flatMap(group=>group.links.map(link=>[link.label,<><Link href={link.href}>{link.label}</Link> · {link.description}</>] as [string,React.ReactNode]))]}/>
      </Card>
      <Card title="Vem får ändra vad">
        <KV items={[['Admin','skapar och tilldelar: dealers, klipp, tal, scenmallar, material, bolag och spelbord'],['Bolaget','väljer inom tilldelningen på sina spelbord i Partnerportalen; publicerar med granskning'],['Spelaren','ser bara publicerade, öppna spelbord hos sitt bolag']]}/>
        <p className="hub-small hub-muted hub-mt">Allt ett bolag kan ändra är en delmängd av det Admin kan ändra på samma objekt. En dold meny är ingen behörighet; servern avgör.</p>
      </Card>
      <Card title="Orden">
        <KV items={[['Spelbord','bolagets ingång till ett spel (room); öppet eller pausat'],['Bordsgrafik','bilden av bordet, lagret table'],['Scenmall','placeringen av lagren och vad mallen tillåter (lane)'],['Tilldelning','det bolaget får använda; publiceras som paketets version'],['Vila','dealerns basloop (idle.ready)'],['Tagning','en inspelning av en replik (take)'],['Insatsprofil','Casual eller Privé (limitPreset)'],['Delat bord','flera spelare vid samma spelbord; enda spelvägen från O03']]}/>
      </Card>
      <Card title="Flödet för en ny dealer">
        <ol className="hub-small" style={{paddingLeft:18,display:'grid',gap:4,margin:0}}>{adminDealerSteps.map(step=><li key={step}>{step}</li>)}</ol>
        <p className="hub-small hub-muted hub-mt">Stegen visas överst på dealerns sida med avklarade steg markerade. Flikarna: {adminDealerTabs.map(tab=>tab.label).join(' · ')}. Bolagets flikar: {adminCompanyTabs.map(tab=>tab.label).join(' · ')}. System: {adminSystemTabs.map(tab=>tab.label).join(' · ')}.</p>
      </Card>
    </div>
    <Card title="Var uppgifterna kommer ifrån" aside="per sida och flik · läsning → lagring" className="hub-mt-l">
      <div className="hub-table-wrap"><table className="hub-table"><thead><tr><th>Sida › flik</th><th>Läsning / åtgärd</th><th>Lagring</th></tr></thead>
        <tbody>{sources.map(([page,read,storage])=><tr key={page}><td className="hub-strong">{page}</td><td><code>{read}</code></td><td className="hub-muted">{storage}</td></tr>)}</tbody></table></div>
      <p className="hub-small hub-muted hub-mt">A:x = /studio/api/admin/x. Spelare, transaktioner och API-nycklar saknar bolag i dag; det kommer i steg F efter O03.</p>
    </Card>
  </HubPage>;
}
