'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';
import {CircleCheck, ExternalLink, History, MoreHorizontal, RefreshCw, RotateCcw, Trash2} from 'lucide-react';
import styles from './partner-appearance.module.css';
import {AppearanceChoices} from './appearance-choices';
import type {PublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
import {PartnerAppearancePreview} from './partner-appearance-preview';
import {adminLayerAdjustments, effectivePartnerAdjustments, partnerLayerChoices} from '../lib/partner-package-view.mjs';
import {compositionLabel} from '../../../packages/navigation/control-flow.mjs';
import {ROOM_LIMIT_PRESETS} from '../../../packages/presentation/contracts/room-game-config.mjs';
import {displayLabel, loadPreviewMedia, previewChoiceMedia} from './partner-preview-media.mjs';
import {appearanceBranding, appearanceChangeCount, appearanceDraftBranding, appearanceDraftRevision, appearanceReceipt, appearanceReview, appearanceRoomStatus, changeAppearance, resetAppearanceRoom, sameAppearance} from './partner-appearance-state.mjs';
import type {AppearanceReview, EditableBranding, PartnerAppearanceInitial} from './partner-appearance-state.mjs';
export type {PartnerAppearanceInitial} from './partner-appearance-state.mjs';

// Plain-language room status for the Admin room header: version, draft and the
// labelled layers the player meets now.
export type AppearanceRoomStatus = {roomId: string; packageRevision: number; draftRevision: number; draft: boolean; live: Record<'background'|'dealer'|'table', string|null>; labels: Record<'background'|'dealer'|'table', string>};
// Published game settings shown as a quiet line in Partnerportalen (the partner API has no writer for them).
export type AppearanceRoomSettings = {language: string; limitPreset: string};
// Partnerportalen's page heading: the editor owns the single header row (name, status, version and actions).
export type AppearanceHeader = {title: ReactNode; crumbs?: ReactNode; playHref?: string|null};

// Table colour is cosmetic and never shown (Jakob 2026-10-28); a saved value stays untouched in the draft.
const LAYERS = ['dealer', 'background', 'table'] as const;
type Action = 'save-draft'|'review'|'publish'|'restore'|'discard-draft';
type LayerKey = typeof LAYERS[number];
type Tab = 'appearance'|'history';
const HISTORY_SHOWN = 5;
const ordered = (value:unknown):unknown => Array.isArray(value) ? value.map(ordered) : value&&typeof value==='object'
  ? Object.fromEntries(Object.entries(value).sort(([left],[right])=>left.localeCompare(right)).map(([key,item])=>[key,ordered(item)])) : value;
const sameValue = (left:unknown,right:unknown) => JSON.stringify(ordered(left))===JSON.stringify(ordered(right));
const PRESET_NAMES: Record<string, string> = {casual: 'Casual', prive: 'Privé', high: 'High'};

export function PartnerAppearance({initial, apiBase, operatorSlug, language = 'sv', onSaved, roomId, onRoomChange, onDirtyChange, onBusyChange, onStatus, onNotice, disabled = false, roomLayout = false, adminChoices = false, active: visible = true, roomState, settings, history, header, children}: {
  initial: PartnerAppearanceInitial; apiBase: string; operatorSlug: string; language?: string;
  onSaved?: (saved: PartnerAppearanceInitial) => void;
  disabled?: boolean; roomLayout?: boolean; onBusyChange?: (busy: boolean) => void;
  // Admin (N1) may pick any layer the frozen composition allows; partners keep the company gate.
  adminChoices?: boolean; onStatus?: (status: AppearanceRoomStatus|null) => void;
  // Partnerportalen shows the result of an action as a toast; without it the status line says it.
  onNotice?: (text: string) => void;
  // Admin room layout: a sibling editor (the room's game settings) under the layer choices.
  children?: ReactNode;
  // Partnerportalen: the room's state and game settings (read-only), the company journal and the page heading.
  roomState?: string|null; settings?: AppearanceRoomSettings|null; history?: ReactNode; header?: AppearanceHeader;
  active?: boolean; roomId?: string; onRoomChange?: (roomId: string) => void; onDirtyChange?: (dirty: boolean) => void;
}) {
  const en = language === 'en';
  const t = (sv: string, english: string) => en ? english : sv;
  const [server, setServer] = useState(initial);
  const [branding, setBranding] = useState<EditableBranding>(() => appearanceDraftBranding(initial));
  const [scope, setScope] = useState('');
  const [review, setReview] = useState<AppearanceReview|null>(null);
  const [latest, setLatest] = useState<PartnerAppearanceInitial|null>(null);
  const [blocked, setBlocked] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('appearance');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [receipt, setReceipt] = useState<number|null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const [previewMedia,setPreviewMedia]=useState<PublicOperatorPreview|null>(null);
  const [dealerMedia,setDealerMedia]=useState<Record<string, PublicOperatorPreview|null>>({});
  const [portal, setPortal] = useState<HTMLElement|null>(null);
  const root = useRef<HTMLElement|null>(null);
  const busyRef = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  // Dialogs open inside Partnerportalen's root so its tokens apply; Admin uses the page body.
  useEffect(() => { setPortal(root.current?.closest<HTMLElement>('.partner-portal') ?? null); }, []);
  const ready = appearanceReceipt(server, initial.operatorId) && Boolean(server.presentation);
  const editable = ready && server.canConfigure === true && !blocked && !disabled;
  const draftRevision = appearanceDraftRevision(server);
  const dirty = !sameAppearance(branding, appearanceDraftBranding(server));
  const stale = Boolean(server.draft && server.draft.basePackageRevision !== server.packageRevision);
  const room = server.rooms?.find(row => row.id === (roomId ?? scope));
  const laneId = room?.presentationLaneId ?? branding.lane ?? server.presentation?.lanes[0]?.id ?? '';
  const lane = server.presentation?.lanes.find(row => row.id === laneId);
  const allowed = new Set<string>(lane ? adminChoices ? adminLayerAdjustments(lane) : effectivePartnerAdjustments(lane) : []);
  const dealerChoices = (room ? server.roomDealerChoices?.[room.id] : server.dealerChoices?.[laneId]) ?? [];
  if (!dealerChoices.length) allowed.delete('dealer');
  const selected = room ? branding.roomOverrides?.[room.id] ?? {} : branding;
  const inherited = room && laneId === (branding.lane ?? server.presentation?.lanes[0]?.id) ? branding : {};
  const unsaved=dirty;
  useEffect(() => { onDirtyChange?.(unsaved); return () => onDirtyChange?.(false); }, [unsaved, branding, onDirtyChange]);
  const labels: Record<string, string> = {lane:t('Scenmall','Scene template'),table:t('Bordsgrafik','Table graphics'),background:t('Bakgrund','Background'),dealer:'Dealer',color:t('Bordsfärg','Table colour')};
  const reviewValid = Boolean(review && server.draft && !dirty && !stale && review.draftRevision === draftRevision && review.packageRevision === server.packageRevision && sameAppearance(review.branding, branding));
  const canSave = editable && (dirty || stale);
  const canReview = editable && server.draft && !dirty && !stale;
  // Without tables.read the review hides the table rows but counts them: they are still published.
  const hiddenTableChanges = review?.hiddenTableChanges ?? 0;
  const canPublish = editable && reviewValid && Boolean(review?.changes.length || hiddenTableChanges);
  // What the primary action would publish: the saved draft against live, or the local edits against live.
  const pending = appearanceChangeCount(dirty ? branding : appearanceDraftBranding(server), server.branding);
  const endpoint = `${apiBase}/branding?operator=${encodeURIComponent(operatorSlug)}`;
  const labelOf = (value: string|null) => {
    if (value === null) return t('Standard','Default');
    const composition = server.presentation?.lanes.find(item => item.id === value);
    return displayLabel(server.presentation?.assets.find(asset => asset.id === value)?.label
      ?? ((server.presentation?.schemaVersion === 2 || server.presentation?.schemaVersion === 3) ? server.presentation.registeredDealers.find(dealer => dealer.id === value)?.label : undefined)
      ?? (composition ? compositionLabel(composition.label, language) : value));
  };
  const roomLabel = (id: string|null) => id === null ? t('Bolagets standard','Company default') : server.rooms?.find(row => row.id === id)?.label ?? id;

  function reportBusy(value: boolean) { busyRef.current = value; setBusy(value); onBusyChange?.(value); }
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  // The header status follows the published state, never the unsaved draft. A ref keeps
  // a changing callback identity from clearing and re-sending the same status.
  const statusRef = useRef(onStatus); statusRef.current = onStatus;
  useEffect(() => {
    const status = roomId ? appearanceRoomStatus(server, roomId) : null;
    statusRef.current?.(status ? {...status, labels: {background: labelOf(status.live.background), dealer: labelOf(status.live.dealer), table: labelOf(status.live.table)}} : null);
    return () => statusRef.current?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, roomId]);
  // Dealer cards show a still from each dealer's idle clip: the same frozen preview reading, one per dealer.
  const thumbRoom = room ?? server.rooms?.find(row => row.presentationLaneId === laneId);
  const dealerKey = [operatorSlug, thumbRoom?.id ?? '', server.packageRevision, visible, ...dealerChoices].join(':');
  useEffect(() => {
    if (!visible || !thumbRoom) return;
    let live = true;
    for (const dealerId of dealerChoices) void loadPreviewMedia({operatorSlug, roomId: thumbRoom.id, dealerId, packageRevision: server.packageRevision})
      .then((payload: PublicOperatorPreview|null) => { if (live && payload) setDealerMedia(current => ({...current, [dealerId]: payload})); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerKey]);

  function announce(text: string) { if (onNotice) { onNotice(text); setNotice(''); } else setNotice(text); }
  function change(key: string, selection: string) {
    if (!editable || busyRef.current ) return;
    setBranding(current => changeAppearance(current, {roomId: room?.id ?? null, key, selection}));
    setReview(null); setNotice('');
  }
  function resetRoom() {
    if (!editable || busyRef.current  || !room) return;
    setBranding(current => resetAppearanceRoom(current, room.id)); setReview(null); setNotice('');
  }
  async function command(action: Action, sourcePackageRevision?: number) {
    if (!editable || busyRef.current  || action === 'save-draft' && !canSave || action === 'review' && !canReview
      || action === 'publish' && !canPublish || action === 'restore' && (dirty||sourcePackageRevision===server.packageRevision)) return;
    if(action==='discard-draft'&&!server.draft){setBranding(appearanceBranding(server.branding));setReview(null);setProblem('');setLatest(null);announce(t('Ändringarna är kastade.','Changes discarded.'));return;}
    reportBusy(true); setProblem(''); setNotice(''); setLatest(null);
    const expectedDraftRevision = draftRevision, expectedPackageRevision = server.packageRevision;
    const body = {action, expectedDraftRevision, expectedPackageRevision,
      ...(action === 'save-draft' ? {branding: appearanceBranding(branding)} : {}),
      ...(action === 'publish' ? {reviewToken: review?.reviewToken} : {}),
      ...(action === 'restore' ? {sourcePackageRevision} : {})};
    setReview(null);
    try {
      const response = await fetch(endpoint, {method:'POST', credentials:'same-origin', headers:{'content-type':'application/json',accept:'application/json'}, body:JSON.stringify(body)});
      const payload: unknown = await response.json().catch(() => null);
      if (!active.current) return;
      if (response.status === 403 || response.status === 401) {
        setBlocked(true); setReviewOpen(false); setProblem(t('Din behörighet har ändrats. Redigeringen finns kvar här. Kontrollera åtkomsten innan du fortsätter.','Your access has changed. Your edits remain here. Check access before continuing.')); return;
      }
      if (response.status === 409) {
        setBlocked(true); setReviewOpen(false); setProblem(t('Spelbordet har ändrats sedan du öppnade det. Din redigering finns kvar. Hämta senaste version och välj hur du vill fortsätta.','The table changed after you opened it. Your edits remain here. Fetch the latest version and choose how to continue.')); return;
      }
      if (response.status === 413) {
        setProblem(t('Utkastet är för stort. Minska antalet spelbordsval och försök spara igen. Din redigering finns kvar.','The draft is too large. Reduce the number of table choices and try saving again. Your edits are preserved.')); return;
      }
      if (!response.ok) {
        if (response.status >= 500) setBlocked(true);
        setReviewOpen(false);
        setProblem(t('Åtgärden kunde inte bekräftas. Redigeringen finns kvar. Kontrollera senaste version innan du försöker igen.','The action could not be confirmed. Your edits remain here. Check the latest version before retrying.')); return;
      }
      if (action === 'review') {
        if (!appearanceReview(payload, {draftRevision:expectedDraftRevision, packageRevision:expectedPackageRevision, branding})) throw new Error('invalid review');
        setReview(payload); setReceipt(null); setReviewOpen(true); return;
      }
      if (!appearanceReceipt(payload, initial.operatorId) || !payload.presentation || appearanceDraftRevision(payload) <= expectedDraftRevision
        || (action === 'discard-draft' ? appearanceDraftRevision(payload)!==expectedDraftRevision+1 || payload.packageRevision !== expectedPackageRevision || payload.draft !== null || !sameAppearance(payload.branding,server.branding) || !sameValue(payload.presentation,server.presentation)
          : action === 'publish' ? payload.packageRevision !== expectedPackageRevision + 1 || payload.draft !== null
          : payload.packageRevision !== expectedPackageRevision || !payload.draft || payload.draft.basePackageRevision !== expectedPackageRevision)
        || action === 'save-draft' && !sameAppearance(payload.draft?.branding, branding)) throw new Error('invalid receipt');
      setServer(payload); setBranding(appearanceDraftBranding(payload));
      if (action === 'publish') setReceipt(payload.packageRevision);
      announce(action === 'discard-draft' ? t('Bolagets utkast är kastat. Publicerade spelbord är oförändrade.','Company draft discarded. Published tables are unchanged.')
        : action === 'publish' ? t(`Publicerat som version ${payload.packageRevision}. Spelare får det vid nästa runda.`, `Published as version ${payload.packageRevision}. Players get it at the next round.`)
        : action === 'restore' ? t('Tidigare version har återställts till ett sparat utkast. Publicerad version är oförändrad.','Earlier version restored to a saved draft. The published version is unchanged.')
        : t('Utkastet är sparat. Publicerad version är oförändrad.','Draft saved. The published version is unchanged.'));
      if (action === 'publish'||action==='discard-draft') onSaved?.(payload);
    } catch {
      if (active.current) { setBlocked(true); setReviewOpen(false); setProblem(t('Svaret kunde inte bekräftas. Redigeringen finns kvar. Hämta senaste version innan du fortsätter.','The response could not be confirmed. Your edits remain here. Fetch the latest version before continuing.')); }
    } finally {
      if (active.current) reportBusy(false); else busyRef.current = false;
    }
  }
  async function refresh() {
    if (busyRef.current) return;
    reportBusy(true); setReview(null); setNotice(''); setLatest(null);
    try {
      const response = await fetch(endpoint, {credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      const payload: unknown = await response.json().catch(() => null);
      if (!active.current) return;
      if (!response.ok || !appearanceReceipt(payload,initial.operatorId) || !payload.presentation) throw new Error('invalid refresh');
      setLatest(payload); setBlocked(true); setProblem('');
    } catch {
      if (active.current) { setBlocked(true); setProblem(t('Senaste version kunde inte hämtas. Din redigering finns kvar här.','Could not fetch the latest version. Your edits remain here.')); }
    } finally { if (active.current) reportBusy(false); else busyRef.current = false; }
  }
  function adopt(keepLocal: boolean) {
    if (!latest || busyRef.current) return;
    setServer(latest); if (!keepLocal) setBranding(appearanceDraftBranding(latest));
    setBlocked(false); setLatest(null); setReview(null); setProblem('');
    announce(keepLocal ? t('Din redigering behölls mot senaste version. Spara och granska igen före publicering.','Your edits were kept against the latest version. Save and review again before publishing.')
      : t('Senaste sparade version är inläst.','Latest saved version loaded.'));
  }

  const preview = <div data-appearance-preview="frozen-composition" className={styles.previewBox}><PartnerAppearancePreview onMedia={setPreviewMedia} compact initiallyEnabled active={visible && (roomLayout || tab === 'appearance')} server={server} branding={branding}
    scope={room?.id ?? ''} operatorSlug={operatorSlug} language={language} onStale={() => {setReview(null);setReviewOpen(false);setBlocked(true);setProblem(t('Spelbordets version har ändrats. Din redigering finns kvar. Hämta senaste version och granska på nytt.','The table version has changed. Your edits remain here. Fetch the latest version and review again.'));}}/></div>;
  const sceneLayoutLink = roomLayout && adminChoices && lane ? <a className={styles.linkButton} href={'/admin/scenes?'+new URLSearchParams({operator:server.operatorId,table:room?.id??'',composition:lane.id,game:room?.game??'blackjack'})}><ExternalLink size={13} aria-hidden="true"/>{t('Placering i scenmallen','Placement in the scene template')}</a> : null;

  // One card grid per unlocked layer; a layer the company may not change is a quiet line, never a card.
  const anyPayload = previewMedia ?? Object.values(dealerMedia).find(Boolean) ?? null;
  const effectiveOf = (key: LayerKey) => selected[key] ?? inherited[key] ?? lane?.layers[key]?.default ?? undefined;
  const lockedText = (key: LayerKey) => key === 'background' && lane?.layers.background.mode === 'baked' ? t('inbakad i dealerfilmen', 'part of the dealer video')
    : key === 'dealer' && !dealerChoices.length ? t('ingen dealer är tilldelad det här spelet', 'no dealer is assigned to this game')
    : roomLayout && !adminChoices ? t('låst i publicerat paket', 'locked in the published package') : roomLayout ? t('fast i scenmallen', 'fixed by the scene template') : t('bestäms av Scoutgaming', 'set by Scoutgaming');
  const unlocked = LAYERS.filter(key => allowed.has(key));
  const locked = LAYERS.filter(key => !allowed.has(key) && (key !== 'background' || lane?.layers.background.enabled !== false) && (key !== 'table' || lane?.layers.table.enabled !== false));
  const layerChoices = (key: LayerKey) => {
    const ids: readonly string[] = key === 'dealer' ? dealerChoices : lane ? partnerLayerChoices(lane, key) : [];
    return ids.map(id => ({id, label: labelOf(id), ...(previewChoiceMedia(key === 'dealer' ? dealerMedia[id] : anyPayload, key, id) ?? {})}));
  };
  const choiceFields = unlocked.map(key => <AppearanceChoices key={key} kind={key} label={labels[key]} language={language} value={selected[key] ?? ''} effective={effectiveOf(key)} choices={layerChoices(key)} onChange={id => change(key, id)}/>);
  const settingsLines: [string, string][] = [];
  if (!roomLayout && settings) {
    const preset = ROOM_LIMIT_PRESETS[settings.limitPreset as keyof typeof ROOM_LIMIT_PRESETS];
    const amount = (value: number) => new Intl.NumberFormat(en ? 'en-GB' : 'sv-SE').format(value);
    settingsLines.push([t('Bordsspråk','Table language'), settings.language === 'sv' ? t('Svenska','Swedish') : settings.language === 'en' ? t('Engelska','English') : settings.language]);
    settingsLines.push([t('Insatsprofil','Limit preset'), (PRESET_NAMES[settings.limitPreset] ?? settings.limitPreset) + (preset ? ` · ${amount(preset.min)}–${amount(preset.max)}` : '')]);
  }
  const quiet = locked.length || settingsLines.length ? <dl className={styles.quiet} aria-label={t('Bestäms av Scoutgaming','Set by Scoutgaming')}>
    {locked.map(key => { const value = effectiveOf(key); return <div key={key} data-locked={key}><dt>{labels[key]}</dt><dd><span title={value ? labelOf(value) : undefined}>{value ? labelOf(value) : t('inget valt','none selected')}</span><small>{lockedText(key)}</small></dd></div>; })}
    {settingsLines.map(([key, value]) => <div key={key}><dt>{key}</dt><dd><span>{value}</span><small>{t('bestäms av Scoutgaming','set by Scoutgaming')}</small></dd></div>)}
  </dl> : null;
  const resetLink = room && branding.roomOverrides?.[room.id] ? <button type="button" className={styles.linkButton} data-action="reset-room" disabled={!editable || busy} onClick={resetRoom}><RotateCcw size={13} aria-hidden="true"/>{t('Återställ spelbordet till bolagets standard','Reset the table to the company default')}</button> : null;
  const editor = <>
  {roomId === undefined && <label className={styles.row}>{t('Gäller för','Applies to')}<select aria-label={t('Gäller för','Applies to')} value={room?.id ?? ''} disabled={busy} onChange={event => { if (!busyRef.current) { setScope(event.target.value); onRoomChange?.(event.target.value); } }}><option value="">{t('Bolagets standard','Company default')}</option>{server.rooms?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
  <fieldset className={styles.editor} disabled={!editable || busy}>
    <legend className={styles.srOnly}>{t('Spelbordets val','Table choices')}</legend>
    {lane && !lane.composition ? <p className={styles.hint}>{t('Scenen är en enda film; bakgrund och bordsgrafik ingår i den. Be Scoutgaming om separata lager om ni vill kunna byta dem.','The scene is a single video; background and table graphics are part of it. Ask Scoutgaming for separate layers if you want to change them.')}</p> : null}
    {choiceFields}
    {!choiceFields.length && !roomLayout ? <p className={styles.hint}>{t('Scoutgaming har inte låst upp något val för det här spelbordet. Vill ni byta något: Hjälp och kontakt.','Scoutgaming has not unlocked any choice for this table. To change something: Help and contact.')}</p> : null}
    {quiet}
    {resetLink}
    {sceneLayoutLink}
  </fieldset></>;

  const shownHistory = allHistory ? server.history ?? [] : (server.history ?? []).slice(0, HISTORY_SHOWN);
  const historyList = <div className={styles.historyList}>
    <p className={styles.hint}>{t('Återställning skapar ett utkast; live ändras först när du publicerar. Spara egna ändringar först.','Restoring creates a draft; live changes only when you publish. Save your own edits first.')}</p>
    <ul>{shownHistory.map(row => <li key={row.revision}><span><strong>{t('Version','Version')} {row.revision}</strong>{row.revision === server.packageRevision ? <em className={styles.liveTag}>{t('live nu','live now')}</em> : null}{row.publishedAt ? <small>{new Date(row.publishedAt).toLocaleString(en ? 'en-GB' : 'sv-SE', {timeZone:'UTC', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}</small> : null}</span>{row.revision!==server.packageRevision&&<button type="button" className="sg-btn" data-action={`restore-${row.revision}`} disabled={!editable || busy || dirty } onClick={() => command('restore',row.revision)}><RotateCcw size={14} aria-hidden="true"/>{t('Återställ till utkast','Restore to draft')}</button>}</li>)}</ul>
    {(server.history?.length ?? 0) > HISTORY_SHOWN ? <button type="button" className={styles.linkButton} onClick={() => setAllHistory(value => !value)}>{allHistory ? t('Visa färre','Show fewer') : t(`Visa alla (${server.history!.length})`,`Show all (${server.history!.length})`)}</button> : null}
  </div>;

  const draftDate = server.draft?.updatedAt ? new Date(server.draft.updatedAt) : null;
  const statusText = busy ? t('Arbetar…','Working…') : notice || [t(`Publicerad version ${server.packageRevision}`, `Published version ${server.packageRevision}`),
    server.draft ? t('utkast sparat','draft saved') + (draftDate && Number.isFinite(draftDate.getTime()) ? ' ' + draftDate.toLocaleDateString(en ? 'en-GB' : 'sv-SE', {day:'numeric', month:'short', timeZone:'UTC'}) : '') : t('inget utkast','no draft'),
    unsaved ? t('osparade ändringar','unsaved changes') : null].filter(Boolean).join(' · ');
  const saveButton = <button type="button" className={'sg-btn' + (unsaved || stale ? ' sg-btn-primary' : '')} data-action="save-draft" disabled={!canSave || busy} onClick={() => command('save-draft')}>{t('Spara utkast','Save draft')}</button>;
  const publishLabel = pending ? t(`Publicera · ${pending} ${pending === 1 ? 'ändring' : 'ändringar'}`, `Publish · ${pending} ${pending === 1 ? 'change' : 'changes'}`) : t('Inget att publicera','Nothing to publish');
  const reviewButton = <button type="button" className={'sg-btn' + (unsaved || stale ? '' : ' sg-btn-primary')} data-action="review" disabled={!canReview || !pending || busy} title={unsaved ? t('Spara utkastet först','Save the draft first') : undefined} onClick={() => command('review')}>{publishLabel}</button>;
  const more = <Dropdown.Root modal={false}>
    <Dropdown.Trigger asChild><button type="button" className={'sg-btn ' + styles.iconButton} aria-label={t('Fler åtgärder','More actions')}><MoreHorizontal size={16} aria-hidden="true"/></button></Dropdown.Trigger>
    <Dropdown.Portal container={portal ?? undefined}><Dropdown.Content className={styles.menu} align="end" sideOffset={6}>
      <Dropdown.Item className={styles.menuItem} data-action="refresh" disabled={busy} onClick={refresh}><RefreshCw size={14} aria-hidden="true"/>{t('Hämta senaste version','Fetch latest version')}</Dropdown.Item>
      {(server.draft||dirty)&&<Dropdown.Item className={styles.menuItem + ' ' + styles.danger} data-action="discard-draft" disabled={!editable||busy} onClick={()=>command('discard-draft')}><Trash2 size={14} aria-hidden="true"/>{server.draft?t('Kasta bolagets utkast','Discard company draft'):t('Kasta ändringar','Discard changes')}</Dropdown.Item>}
      <Dropdown.Item className={styles.menuItem} onClick={() => setTab('history')}><History size={14} aria-hidden="true"/>{t('Historik','History')}</Dropdown.Item>
    </Dropdown.Content></Dropdown.Portal>
  </Dropdown.Root>;
  const actions = <div className={styles.actions}>{header?.playHref ? <a className="sg-btn sg-btn-ghost" href={header.playHref} target="_blank" rel="noopener">{t('Provspela','Play test')}<ExternalLink size={14} aria-hidden="true"/></a> : null}{saveButton}{reviewButton}{more}</div>;

  const allRooms = (server.rooms ?? []).map(row => row.label);
  const reviewDialog = <Dialog.Root open={reviewOpen} onOpenChange={open => { setReviewOpen(open); if (!open) setReceipt(null); }}>
    <Dialog.Portal container={portal ?? undefined}><Dialog.Overlay className={styles.overlay}/>
      <Dialog.Content className={styles.dialog} aria-describedby="appearance-review-description" onCloseAutoFocus={event => {
        // The publish button was disabled while the review ran, so Radix has no element to return to: focus it (or the heading) again.
        event.preventDefault();
        (root.current?.querySelector<HTMLElement>('[data-action="review"]:not(:disabled)') ?? root.current?.querySelector<HTMLElement>('h1, [data-action="save-draft"]'))?.focus();
      }}>
        {receipt === null ? <>
          <Dialog.Title>{t('Granska och publicera','Review and publish')}</Dialog.Title>
          <Dialog.Description id="appearance-review-description">{t('Det här ändras jämfört med det spelarna ser nu.','This changes compared with what players see now.')}</Dialog.Description>
          <section className={styles.review} aria-label={t('Granskning före publicering','Review before publishing')}>
            {reviewValid && review ? <>
              {review.changes.length ? <ul className={styles.changes}>{review.changes.map((row,index) => <li key={`${row.roomId}:${row.key}:${index}`}><b>{roomLabel(row.roomId)} · {row.key.startsWith('roomOverrides.') ? (labels[row.key.slice(14)] ?? row.key) + ' (' + t('spelbordsval','table choice') + ')' : labels[row.key] ?? row.key}</b><span>{labelOf(row.before)} <span aria-hidden="true">→</span> <strong>{labelOf(row.after)}</strong></span></li>)}</ul> : hiddenTableChanges ? null : <p>{t('Inga ändringar att publicera.','No changes to publish.')}</p>}
              {hiddenTableChanges ? <p>{hiddenTableChanges === 1 ? t('1 ändring på spelborden visas inte för din roll.','1 change to the tables is not shown for your role.') : t(`${hiddenTableChanges} ändringar på spelborden visas inte för din roll.`,`${hiddenTableChanges} changes to the tables are not shown for your role.`)}</p> : null}
              <p className={styles.hint}><strong>{t('Berörda spelbord','Affected tables')}:</strong> {review.tablesHidden ? t('Spelborden visas inte för din roll','Tables are not shown for your role') : review.affectedRooms.length ? review.affectedRooms.map(roomLabel).join(', ') : t('inga befintliga spelbord','no existing tables')}</p>
            </> : <p>{t('Spara utkastet och granska igen för att se skillnaden.','Save the draft and review again to see the difference.')}</p>}
            {!roomLayout ? <p className={styles.note}>{t('Utkastet är gemensamt för bolagets spelbord: en publicering gäller alla spelbord i bolaget', 'The draft is shared by the company tables: one publication applies to every table in the company')}{allRooms.length ? ` (${allRooms.join(', ')})` : ''}. {t('Pågående rundor spelas klart; nästa runda får den nya versionen.','Rounds in play finish; the next round gets the new version.')}</p> : null}
          </section>
          <div className={styles.dialogActions}><Dialog.Close asChild><button type="button" className="sg-btn">{t('Avbryt','Cancel')}</button></Dialog.Close>
            <button type="button" className="sg-btn sg-btn-primary" data-action="publish" disabled={!canPublish || busy} onClick={() => command('publish')}>{busy ? t('Publicerar…','Publishing…') : t('Publicera nu','Publish now')}</button></div>
        </> : <>
          <Dialog.Title><CircleCheck size={18} aria-hidden="true" className={styles.okIcon}/>{t(`Publicerat · version ${receipt}`,`Published · version ${receipt}`)}</Dialog.Title>
          <Dialog.Description id="appearance-review-description">{t('Spelarna får den nya versionen vid nästa runda; en pågående runda spelas klart.','Players get the new version at the next round; a round in play finishes first.')}</Dialog.Description>
          <div className={styles.dialogActions}>{header?.playHref ? <a className="sg-btn" href={header.playHref} target="_blank" rel="noopener">{t('Provspela','Play test')}<ExternalLink size={14} aria-hidden="true"/></a> : null}<Dialog.Close asChild><button type="button" className="sg-btn sg-btn-primary">{t('Klart','Done')}</button></Dialog.Close></div>
        </>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;

  const alerts = <>
    {problem ? <div className={styles.problem} role="alert"><span>{problem}</span>{blocked ? <button type="button" className="sg-btn" data-action="refresh" disabled={busy} onClick={refresh}><RefreshCw size={14} aria-hidden="true"/>{t('Hämta senaste version','Fetch latest version')}</button> : null}</div> : null}
    {!ready ? <p role="alert" className={styles.problem}>{t('Utkast och publicering är inte tillgängliga för det här spelbordet ännu.','Drafts and publishing are not available for this table yet.')}</p> : null}
    {server.canConfigure !== true ? <p className={styles.note}>{t('Din roll kan se spelbordets utseende men inte ändra det.','Your role can see the table appearance but not change it.')}</p> : null}
    {stale ? <p className={styles.problem}>{t('Utkastet bygger på en äldre version. Spara det igen och granska innan du publicerar.','The draft is based on an older version. Save it again and review before publishing.')}</p> : null}
    {latest ? <aside className={styles.problem} aria-label={t('Senaste version','Latest version')}><span>{t(`Senast publicerad: version ${latest.packageRevision}. ${latest.draft ? 'Ett sparat utkast finns.' : 'Inget sparat utkast.'} Din redigering är fortfarande kvar.`,`Latest published: version ${latest.packageRevision}. ${latest.draft ? 'A saved draft exists.' : 'No saved draft.'} Your edits are still here.`)}
      {latest.canConfigure !== true ? ' ' + t('Du har inte längre rätt att ändra utseendet.','You no longer have permission to change the appearance.') : ''}</span>
      <span className={styles.actions}><button type="button" className="sg-btn" data-action="keep-local" disabled={busy || latest.canConfigure !== true} onClick={() => adopt(true)}>{t('Behåll min redigering','Keep my edits')}</button><button type="button" className="sg-btn" data-action="load-latest" disabled={busy} onClick={() => adopt(false)}>{t('Ersätt med senaste sparade','Replace with latest saved')}</button></span>
    </aside> : null}
  </>;
  const workbench = <div className={styles.workbench}><div className={styles.workChoices}>{editor}</div><aside className={styles.workPreview}>{preview}</aside></div>;

  if (!roomLayout) {
    // Partnerportalen: one heading row, the scene beside the choices, history in its own tab.
    // Both panels stay mounted (hidden) so the draft, review and history survive a tab switch.
    const title = header?.title ?? (room ? room.label : t('Bolagets standard','Company default'));
    return <section ref={root} className={styles.panel} aria-label={t('Spelbordets utseende och publicering','Table appearance and publishing')}>
      <header className={styles.head}>
        <div className={styles.headText}>
          {header?.crumbs}
          <h1 className={styles.title} tabIndex={-1}><span className={styles.titleText} title={typeof title === 'string' ? title : undefined}>{title}</span>{roomState ? <span className={styles.stateChip} data-state={roomState === 'live' ? 'open' : 'paused'} title={roomState === 'live' ? t('Öppet för spelare. Pausa begärs från Scoutgaming.','Open to players. Pausing is requested from Scoutgaming.') : t('Pausat: syns inte i lobbyn. Öppning begärs från Scoutgaming.','Paused: hidden from the lobby. Opening is requested from Scoutgaming.')}><span aria-hidden="true"/>{roomState === 'live' ? t('öppet','open') : t('pausat','paused')}</span> : null}</h1>
          <p className={styles.statusLine} role="status" aria-live="polite">{statusText}</p>
        </div>
        {actions}
      </header>
      {alerts}
      <Tabs.Root value={tab} onValueChange={value => setTab(value as Tab)} activationMode="manual">
        <Tabs.List className={styles.tabs} aria-label={t('Spelbordets inställningar','Table settings')}>
          <Tabs.Trigger value="appearance">{t('Utseende','Appearance')}</Tabs.Trigger>
          <Tabs.Trigger value="history">{t('Historik','History')}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content forceMount value="appearance" hidden={tab !== 'appearance'} className={styles.tabPanel}>{workbench}</Tabs.Content>
        <Tabs.Content forceMount value="history" hidden={tab !== 'history'} className={styles.tabPanel}>
          <section className={styles.historyBox}><h2>{t('Publicerade versioner','Published versions')}</h2>{historyList}</section>
          {history}
        </Tabs.Content>
      </Tabs.Root>
      {reviewDialog}
    </section>;
  }

  return <section ref={root} className={styles.panel + ' ' + styles.adminPanel} aria-label={t('Utkast och publicering','Draft and publishing')}>
    {alerts}
    {workbench}
    <div className={styles.saveBar}><p className={styles.statusLine} role="status" aria-live="polite">{statusText}</p>{actions}</div>
    {children ? <details className={styles.gameSettings}><summary>{t('Spelinställningar','Game settings')}</summary>{children}</details> : null}
    <details className={styles.historyBox}><summary>{t('Versionshistorik','Version history')}</summary>{historyList}</details>
    {reviewDialog}
  </section>;
}
