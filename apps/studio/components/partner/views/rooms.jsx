// Spelbord: listan med bolagets spelbord som kort (scenens bild överst) och editorn för
// det valda spelbordet. Utkast → granska → publicera är dagens flöde och API; inget ändras i det.
import React from 'react';
import { ChevronRight, Plus, Spade } from 'lucide-react';
import { PartnerAppearanceLoader, brandingApiBase } from '../../partner-appearance-loader.mjs';
import { PartnerJournal } from '../../partner-journal-loader.mjs';
import { loadPreviewMedia, choiceInitials, displayLabel } from '../../partner-preview-media.mjs';
import { availablePartnerRooms, initialPartnerRoomSelection } from '../../../lib/partner-room-selection.mjs';
import { partnerLaneState } from '../../../lib/partner-package-view.mjs';
import { resolveRoomBranding } from '../../../../../packages/operators/contracts/branding.mjs';
import { workspaceSurfacePath } from '../../../../../packages/navigation/workspace-surfaces.mjs';
import { Btn, Badge, Crumbs, Empty, Note, Page, Tip } from './ui.tsx';

const PRESETS = { casual: 'Casual', prive: 'Privé', high: 'High' };
const languageWord = (value, en) => value === 'sv' ? (en ? 'Swedish' : 'svenska') : value === 'en' ? (en ? 'English' : 'engelska') : value;

// Vad spelaren möter på spelbordet nu: publicerad bakgrund och bordsgrafik ur paketet.
function publishedLayers(snapshot, room) {
  const presentation = snapshot.presentation;
  const lane = presentation?.lanes?.find(row => row.id === room.presentationId);
  if (!lane) return null;
  const branding = resolveRoomBranding({ ...snapshot.branding, lane: snapshot.branding?.lane ?? presentation.lanes[0]?.id }, room.id, lane.id);
  const state = partnerLaneState(lane, branding, presentation.assets ?? [], presentation.registeredDealers ?? []);
  return { background: state.layers.background.enabled ? state.layers.background.selected : null, table: state.layers.table.enabled ? state.layers.table.selected : null };
}

// Scenens bild på kortet: bakgrund, dealerns vila och bordsgrafik ur samma frysta
// förhandsvisning som editorn läser. Utan bild: en lugn platta med dealerns initialer.
function SceneThumb({ snapshot, room }) {
  const [payload, setPayload] = React.useState(null);
  const revision = Number(snapshot.packageRevision ?? snapshot.operator?.packageRevision);
  const dealerId = room.dealer?.id ?? null;
  React.useEffect(() => {
    let live = true;
    if (room.state === 'live' && dealerId) void loadPreviewMedia({ operatorSlug: snapshot.operator.slug, roomId: room.id, dealerId, packageRevision: revision }).then(value => { if (live) setPayload(value); });
    return () => { live = false; };
  }, [snapshot.operator.slug, room.id, room.state, dealerId, revision]);
  const layers = payload ? publishedLayers(snapshot, room) : null;
  const background = layers?.background ? payload.media.backgrounds.find(row => row.id === layers.background) : null;
  const table = layers?.table ? payload.media.tables.find(row => row.id === layers.table) : null;
  // A keyed dealer clip (alpha) sits on the scene; a green-screen clip is never shown raw.
  const dealer = payload?.media.dealer?.compositing?.mode === 'alpha' ? payload.media.dealer : null;
  const media = (row, className) => row ? row.contentType.startsWith('video/') ? <video className={className} src={row.src + '#t=0.5'} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} /> : <img className={className} src={row.src} alt="" loading="lazy" /> : null;
  return <div className="scene-thumb" data-ready={payload ? 'true' : 'false'} aria-hidden="true">
    {media(background, 'layer bg')}
    {dealer ? <video className="layer dealer" src={dealer.src + '#t=0.5'} muted playsInline preload="metadata" tabIndex={-1} /> : null}
    {media(table, 'layer table')}
    {!background && !dealer ? <span className="plate">{choiceInitials(room.dealer?.label ?? room.name)}</span> : null}
  </div>;
}

export function PartnerRoomWorkspace({ snapshot, copy, language = 'sv', apiBase, onSaved, onDirtyChange, initialRoomId, initialRoomScope, selection: controlledSelection, onSelectionChange, list = false, active = true, notify }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const [localSelection, setLocalSelection] = React.useState(() => initialPartnerRoomSelection(snapshot, initialRoomId, initialRoomScope));
  const selection = controlledSelection ?? localSelection;
  const rooms = availablePartnerRooms(snapshot), roomId = selection.roomId;
  // Öppna och pausade spelbord; arkiverade och andra bolags spelbord visas aldrig.
  const all = (snapshot.tables ?? []).filter(room => room.operatorId === snapshot.operator?.id && (room.status === 'active' || ['pending', 'paused', 'preview'].includes(room.state ?? room.status)));
  const unavailable = selection.unavailable || roomId !== '' && !rooms.some(room => room.id === roomId);
  const setRoomId = id => (onSelectionChange ?? setLocalSelection)({ roomId: id, unavailable: false });
  // Historiken läser bolagets publiceringar (GET /journal?kind=publications) med reports.read.
  const canJournal = (snapshot.permissions ?? []).includes('reports.read');
  const selectedRoom = rooms.find(room => room.id === roomId) ?? null;
  const listHref = workspaceSurfacePath('partner', 'rooms', snapshot.operator?.slug);
  const helpHref = workspaceSurfacePath('partner', 'help', snapshot.operator?.slug);
  const details = room => [displayLabel(room?.dealer?.label ?? ''), room?.settings?.limitPreset ? PRESETS[room.settings.limitPreset] ?? room.settings.limitPreset : null, room?.settings?.language ? languageWord(room.settings.language, en) : null].filter(Boolean).join(' · ');
  const card = room => {
    const open = room.state === 'live' || room.status === 'active', editable = rooms.some(row => row.id === room.id);
    const body = <>
      <SceneThumb snapshot={snapshot} room={room} />
      <div className="room-card-body">
        <div className="room-card-text"><Tip content={room.name}><div className="strong ellipsis">{room.name}</div></Tip><div className="small muted ellipsis">{details(room) || '—'}</div></div>
        <div className="room-card-chips"><Badge tone={open ? 'ok' : 'warn'} dot>{open ? t('öppet', 'open') : t('pausat', 'paused')}</Badge>{snapshot.draft && editable ? <Badge tone="accent">{t('utkast', 'draft')}</Badge> : null}</div>
      </div>
    </>;
    return editable
      ? <button type="button" key={room.id} className="room-card" onClick={() => setRoomId(room.id)} aria-label={t(`Öppna ${room.name}`, `Open ${room.name}`)}>{body}</button>
      : <div key={room.id} className="room-card paused" title={t('Pausade spelbord öppnas av Scoutgaming. Begär under Hjälp och kontakt.', 'Paused tables are opened by Scoutgaming. Request it under Help and contact.')}>{body}</div>;
  };
  const journal = canJournal && /^(?:\/studio)?\/api\/partner$/.test(brandingApiBase(apiBase))
    ? <PartnerJournal base={brandingApiBase(apiBase)} operatorSlug={snapshot.operator.slug} operatorId={snapshot.operator.id} language={language} kind="publications" /> : null;
  const title = selectedRoom ? selectedRoom.name : t('Bolagets standard', 'Company default');
  const header = { title, crumbs: <Crumbs items={[{ label: copy.rooms, href: listHref }, { label: title }]} />,
    playHref: selectedRoom?.state === 'live' ? selectedRoom.playUrl ?? null : null };
  // Editorn förblir monterad (dold) i listan så att osparade val aldrig tappas.
  const editor = !unavailable ? <div hidden={list}>
    <PartnerAppearanceLoader apiBase={apiBase} operatorId={snapshot.operator.id} operatorSlug={snapshot.operator.slug} language={language} active={active && !list} roomId={roomId}
      onRoomChange={setRoomId} onDirtyChange={onDirtyChange} onSaved={onSaved} roomState={selectedRoom?.state ?? null} settings={selectedRoom?.settings ?? null}
      header={header} onNotice={notify} history={journal} />
  </div> : null;
  if (!list) return <div className="page">
    {unavailable ? <><Crumbs items={[{ label: copy.rooms, href: listHref }, { label: t('Inte tillgängligt', 'Not available') }]} />
      <Note tone="danger" role="alert">{t('Det begärda spelbordet är inte tillgängligt för bolaget. Välj ett spelbord i listan.', 'The requested table is not available for the company. Choose a table from the list.')}</Note>
      <div><Btn href={listHref}>{t('Till spelborden', 'To the tables')}</Btn></div></> : null}
    {editor}
  </div>;
  return <Page title={copy.rooms} intro={t('Välj ett spelbord för att byta dealer, bakgrund eller bordsgrafik. Ni sparar ett utkast, granskar och publicerar; spelarna får den nya versionen vid nästa runda.', 'Choose a table to change dealer, background or table graphics. You save a draft, review and publish; players get the new version at the next round.')}
    actions={<Btn href={helpHref}><Plus size={15} aria-hidden="true" />{t('Begär ett spelbord till', 'Request another table')}</Btn>}>
    {all.length ? <div className="room-grid" role="list" aria-label={copy.rooms}>{all.map(room => <div role="listitem" key={room.id}>{card(room)}</div>)}</div>
      : <Empty chip={null} icon={<Spade size={20} />} title={t('Inga spelbord ännu', 'No tables yet')} text={t('Scoutgaming skapar och publicerar bolagets spelbord.', 'Scoutgaming creates and publishes the company tables.')} />}
    {rooms.length ? <div className="room-default"><button type="button" className="link-quiet" onClick={() => setRoomId('')}>{t('Bolagets standard', 'Company default')}<ChevronRight size={14} aria-hidden="true" /></button>
      <span className="small muted">{t('val som gäller alla spelbord som inte har egna', 'choices for every table without its own')}</span></div> : null}
    {editor}
  </Page>;
}
