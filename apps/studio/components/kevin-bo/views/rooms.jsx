// Spelbord: bolagets spelbord som kort och editorn för det valda (utseende, dealer,
// spelinställningar, tillgänglighet, historik). Utkast → granska → publicera är
// dagens flöde och API; inget ändras i det.
import React from 'react';
import { PartnerAppearanceLoader } from '../../partner-appearance-loader.mjs';
import { PartnerPackageView } from '../../partner-package-view.mjs';
import { PartnerJournal } from '../../partner-journal-loader.mjs';
import { brandingApiBase } from '../../partner-appearance-loader.mjs';
import { availablePartnerRooms, initialPartnerRoomSelection } from '../../../lib/partner-room-selection.mjs';
import { workspaceSurfacePath } from '../../../../../packages/navigation/workspace-surfaces.mjs';
import { Btn, Chip, Note, Page } from './ui.jsx';

export function PartnerRoomWorkspace({ snapshot, copy, language = 'sv', apiBase, onSaved, onDirtyChange, initialRoomId, initialRoomScope, selection: controlledSelection, onSelectionChange, active = true }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const [localSelection, setLocalSelection] = React.useState(() => initialPartnerRoomSelection(snapshot, initialRoomId, initialRoomScope));
  const selection = controlledSelection ?? localSelection;
  const rooms = availablePartnerRooms(snapshot), roomId = selection.roomId;
  const unavailable = selection.unavailable || roomId !== '' && !rooms.some(room => room.id === roomId);
  const setRoomId = id => (onSelectionChange ?? setLocalSelection)({ roomId: id, unavailable: false });
  const revision = snapshot.packageRevision ?? snapshot.operator?.packageRevision ?? '';
  const paused = (snapshot.tables ?? []).filter(room => room.operatorId === snapshot.operator?.id && room.status !== 'active' && ['pending', 'paused', 'preview'].includes(room.state ?? room.status));
  const canJournal = (snapshot.permissions ?? []).includes('team.roles.assign');
  const selectedRoom = rooms.find(room => room.id === roomId) ?? null;
  const helpHref = workspaceSurfacePath('partner', 'help', snapshot.operator?.slug);
  const card = (room) => {
    const details = [room?.dealer?.label, room?.settings?.limitPreset, room?.settings?.language].filter(Boolean).join(' · ');
    const pressed = room ? roomId === room.id : roomId === '';
    return <button type="button" key={room?.id ?? 'company'} className={`card link${pressed && !unavailable ? ' selected' : ''}`} aria-pressed={pressed && !unavailable ? 'true' : 'false'} onClick={() => setRoomId(room?.id ?? '')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div><div className="strong" style={{ fontSize: 15 }}>{room ? room.name : t('Bolagets standard', 'Company default')}</div>
          <div className="small muted">{room ? [details, revision ? `${t('revision', 'revision')} ${revision}` : null].filter(Boolean).join(' · ') : t('Gemensamma val för alla spelbord med samma scenmall.', 'Shared choices for every table on the same scene template.')}</div></div>
        <div className="actions">{room ? <Chip tone="ok" dot>{t('öppet', 'open')}</Chip> : null}{snapshot.draft ? <Chip tone="warn">{t('utkast', 'draft')}</Chip> : null}</div>
      </div>
    </button>;
  };
  return <Page title={copy.rooms} intro={t('Era spelbord. Välj dealer, bakgrund och bordsgrafik inom tilldelningen, spara utkast, granska och publicera. Spelare får den nya versionen vid nästa runda.', 'Your tables. Choose dealer, background and table graphics within the assignment, save a draft, review and publish. Players get the new version at the next round.')}
    actions={<Btn href={helpHref}>{t('Begär ett spelbord till', 'Request another table')}</Btn>}>
    {unavailable ? <Note tone="danger" role="alert">{t('Det begärda spelbordet är inte tillgängligt för detta bolag. Välj ett tillgängligt spelbord.', 'The requested table is not available for this company. Choose an available table.')}</Note> : null}
    <div className="grid c2" role="group" aria-label={copy.rooms}>
      {rooms.map(card)}
      {card(null)}
    </div>
    {paused.length ? <div className="rows">{paused.map(room => <div className="row" key={room.id}><div><Chip tone="warn" dot>{t('pausat', 'paused')}</Chip></div><div><div className="title">{room.name}</div><div className="text">{t('Pausade spelbord syns inte i lobbyn och ingår inte i det publicerade paketets utseende. Öppning begärs från Scoutgaming.', 'Paused tables are hidden from the lobby and are not part of the published package appearance. Opening is requested from Scoutgaming.')}</div></div><div /></div>)}</div> : null}
    {!unavailable ? <>
      <PartnerPackageView snapshot={snapshot} view="test" roomId={roomId} language={language} />
      <PartnerAppearanceLoader apiBase={apiBase} operatorId={snapshot.operator.id} operatorSlug={snapshot.operator.slug} language={language} active={active} roomId={roomId}
        onRoomChange={setRoomId} onDirtyChange={onDirtyChange} onSaved={onSaved} roomState={selectedRoom?.state ?? (selectedRoom ? 'live' : null)} settings={selectedRoom?.settings ?? null}
        history={canJournal && /^(?:\/studio)?\/api\/partner$/.test(brandingApiBase(apiBase)) ? <PartnerJournal base={brandingApiBase(apiBase)} operatorSlug={snapshot.operator.slug} operatorId={snapshot.operator.id} language={language} actions={['package.publish', 'draft.publish']} /> : null} />
    </> : null}
  </Page>;
}
