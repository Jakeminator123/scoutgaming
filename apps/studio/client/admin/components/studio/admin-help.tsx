import Link from '../../../runtime/navigation';
import {HubPage,Card,KV} from '../ui/hub';
import {buttonVariants,focusRing,cn} from '../ui/kit';
import {ExternalLink} from 'lucide-react';
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
  ['Dealers › Landningar','filmad profil i koden (filmed-profiles/registry.mjs); doc.project lanes[]','ingen lagring per dealer ännu; mätningen kommer senare'],
  ['Dealers › Används av','GET /admin/_data/catalog + /studio/api/project + /studio/api/videos; A:resource-lifecycle','doc.project, doc.administration, operators, operator_packages'],
  ['Dealers › Inställningar','POST /studio/api/dealers/{archive,delete}; PUT /studio/api/project','doc.project dealers[], dealerTrash[], dealerSets[]; media_records; Blob'],
  ['Scenmallar','GET /admin/_data/catalog + /studio/api/videos; PUT /studio/api/project; A:operator-package publish-scene-layout','doc.project lanes[]; operator_packages'],
  ['Bakgrunder och bordsgrafik','POST /studio/api/layer-assets/upload; A:material-trash','doc.project layerAssets[], layerAssetTrash[]; Blob backgrounds/, tables/'],
  ['Bakgrunder och bordsgrafik › Skapa med AI','GET/POST /studio/api/layer-assets/generate (bara förslag); Använd laddar upp som ovan','sparar inget själv; det valda förslaget blir layerAssets[] med etiketten "AI · …"'],
  ['Bolag och spelbord','GET /admin/_data/catalog; A:resource-lifecycle; GET /studio/api/admin/workspace/companies','operators, operator_roles, operator_memberships, operator_packages; doc.administration rooms[]'],
  ['Papperskorg för spelbord: egen flik bredvid Alla spelbord, och under Bolag › Spelbord','GET /admin/_data/catalog (rooms[].state = archived); GET /api/admin/resource-lifecycle; A:room-lifecycle {archived:false}','doc.administration rooms[].state, archivedAt; spelbordet återställs pausat'],
  ['Bolag › Tilldelning','A:operator-package {operatorId, lanes, expectedPackageRevision}','operator_packages (ny revision), fryst presentation'],
  ['Bolag › Team','A:operator-create, A:operator-membership, A:operator-role','operators, operator_roles, operator_memberships, croupier_auth.users (inbjudan)'],
  ['Bolag › Journal','GET /studio/api/partner/journal','operator_audit_events, operator_branding_drafts'],
  ['Spelbordet','GET /studio/api/partner/branding; A:room-game-config; A:room-state; A:room-lifecycle','operator_branding_drafts, operator_packages; doc.administration roomGameConfigs, rooms[].state; shared_table_configs'],
  ['System › Drift','A:overview, A:shoes, A:shared-table-proof','doc.administration, players, transactions, blackjack_tables, shared_table_shoes, shared_table_audit'],
  ['System › AI-agenter','GET/PATCH /studio/api/openclaw/admin','Director-tjänsten på Render (inte Neon); OPENAI_API_KEY-flaggan ur miljön'],
  ['System › Scoutgamings personal','A:users; users/invite, resend, role, remove','croupier_auth.users, tokens'],
  ['System › Spelarkonton','A:players, A:transactions; players/create, status, password','croupier_game.players, player_accounts, transactions, player_admin_events'],
  ['System › Integration','A:apikeys, A:emails; apikeys/create, revoke, rotate, launch, credit','croupier_auth.api_keys (globala tills nycklarna knyts till bolag)'],
  ['System › Beroenden','GET /admin/_data/catalog + /studio/api/project + /studio/api/videos; A:resource-lifecycle','doc.project, doc.administration, operators, operator_packages'],
];

export function AdminHelp() {
  return <HubPage title="Hjälp" intro="Vad varje menyval gör, vem som får ändra vad och orden vi använder." actions={<><a className={buttonVariants({variant:'secondary'})} href={GUIDE} target="_blank" rel="noopener">Användarguiden<ExternalLink aria-hidden="true"/></a><a className={buttonVariants({variant:'secondary'})} href={GLOSSARY} target="_blank" rel="noopener">Ordlistan<ExternalLink aria-hidden="true"/></a></>}>
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Menyn (6 val)">
        <KV items={[['Översikt',<><Link href="/admin" className="font-semibold text-sg-text">Översikt</Link> · det som väntar på dig, med länk till platsen där det åtgärdas.</>],
          ...adminNavigationGroups.flatMap(group=>group.links.map(link=>[link.label,<><Link href={link.href} className="font-semibold text-sg-text">{link.label}</Link> · {link.description}</>] as [string,React.ReactNode]))]}/>
      </Card>
      <Card title="Vem får ändra vad">
        <KV items={[['Admin','skapar och tilldelar: dealers, klipp, tal, scenmallar, material, bolag och spelbord'],['Bolaget','väljer inom tilldelningen på sina spelbord i Partnerportalen; publicerar med granskning'],['Spelaren','ser bara publicerade, öppna spelbord hos sitt bolag']]}/>
        <p className="mb-0 mt-3 text-[12.5px] text-sg-muted">Allt ett bolag kan ändra är en delmängd av det Admin kan ändra på samma objekt. En dold meny är ingen behörighet; servern avgör.</p>
      </Card>
      <Card title="Orden">
        <KV items={[['Spelbord','bolagets ingång till ett spel; öppet eller pausat'],['Bordsgrafik','bilden av bordet'],['Scenmall','hur bakgrund, dealer och bordsgrafik placeras, och vad mallen tillåter'],['Tilldelning','det bolaget får använda; varje publicering blir en ny version'],['Vila','dealerns grundloop mellan händelserna'],['Tagning','en inspelning av en replik'],['Insatsprofil','Casual, Privé eller High'],['Delat bord','flera spelare vid samma spelbord; enda spelvägen']]}/>
      </Card>
      <Card title="Skapa med AI">
        <p className="m-0 text-[13.5px]">Under Scenmallar och material › Bakgrunder eller Bordsgrafik tar AI fram förslag efter din beskrivning. Du väljer ett och klickar Använd. Bilden hamnar i materialbiblioteket. Inget bolag ser den förrän den ligger i en scenmall som publiceras.</p>
        <p className="mb-0 mt-3 text-[12.5px] text-sg-muted">Bordsgrafik ritas efter en filmad dealers landningar och passar bara scenmallar med samma landningar och placering; annars går den inte att välja eller publicera. AI kräver <code>CROUPIER_AI_IMAGE_ENABLED=1</code> på servern; utan den står det "Inte påslaget".</p>
      </Card>
      <Card title="Flödet för en ny dealer">
        <ol className="m-0 grid list-none gap-2 p-0">{adminDealerSteps.map((step,index)=><li key={step} className="flex items-center gap-2.5 text-[13.5px]"><span className="grid size-6 place-items-center rounded-full bg-sg-hover text-[11px] font-bold text-sg-muted">{index+1}</span>{step}</li>)}</ol>
        <p className="mb-0 mt-3 text-[12.5px] text-sg-muted">Stegen visas överst på dealerns sida med avklarade steg markerade. Flikarna: {adminDealerTabs.map(tab=>tab.label).join(' · ')}. Bolagets flikar: {adminCompanyTabs.map(tab=>tab.label).join(' · ')}. System: {adminSystemTabs.map(tab=>tab.label).join(' · ')}.</p>
      </Card>
    </div>
    <details className="mt-8 rounded-xl border border-dashed border-sg-border px-4 py-3 text-[12.5px] text-sg-muted">
      <summary className={cn('cursor-pointer select-none font-semibold hover:text-sg-text',focusRing)}>Tekniska detaljer · var uppgifterna kommer ifrån</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full border-collapse text-[12.5px] [&_td]:border-b [&_td]:border-sg-line-2 [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_th]:border-b [&_th]:border-sg-border [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold"><thead><tr><th>Sida › flik</th><th>Läsning / åtgärd</th><th>Lagring</th></tr></thead>
        <tbody>{sources.map(([page,read,storage])=><tr key={page}><td className="font-semibold text-sg-text">{page}</td><td className="font-mono text-[11.5px]">{read}</td><td>{storage}</td></tr>)}</tbody></table></div>
      <p className="mb-0 mt-3">A:x = /studio/api/admin/x. Spelare, transaktioner och API-nycklar saknar bolag i dag; det kommer senare.</p>
    </details>
  </HubPage>;
}
