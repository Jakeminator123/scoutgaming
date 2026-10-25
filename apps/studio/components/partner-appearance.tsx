'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import styles from './partner-appearance.module.css';
import {AppearanceLayerPicker} from './appearance-layer-picker';
import type {PublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
import {PartnerAppearancePreview} from './partner-appearance-preview';
import {adminLayerAdjustments, effectivePartnerAdjustments, partnerLayerChoices} from '../lib/partner-package-view.mjs';
import {compositionLabel} from '../../../packages/navigation/control-flow.mjs';
import {appearanceBranding, appearanceDraftBranding, appearanceDraftRevision, appearanceReceipt, appearanceReview, appearanceRoomStatus, changeAppearance, resetAppearanceRoom, sameAppearance} from './partner-appearance-state.mjs';
import type {AppearanceReview, EditableBranding, PartnerAppearanceInitial} from './partner-appearance-state.mjs';
import {updatePublishedSceneLayout} from '../../../packages/presentation/contracts/published-scene-layout.mjs';
import type {CompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
export type {PartnerAppearanceInitial} from './partner-appearance-state.mjs';

// Plain-language room status for the Admin room header: version, draft and the
// labelled layers the player meets now.
export type AppearanceRoomStatus = {roomId: string; packageRevision: number; draftRevision: number; draft: boolean; live: Record<'background'|'dealer'|'table', string|null>; labels: Record<'background'|'dealer'|'table', string>};

const FIELDS = ['background', 'dealer', 'table', 'color'] as const;
type Action = 'save-draft'|'review'|'publish'|'restore'|'discard-draft';
const ordered = (value:unknown):unknown => Array.isArray(value) ? value.map(ordered) : value&&typeof value==='object'
  ? Object.fromEntries(Object.entries(value).sort(([left],[right])=>left.localeCompare(right)).map(([key,item])=>[key,ordered(item)])) : value;
const sameValue = (left:unknown,right:unknown) => JSON.stringify(ordered(left))===JSON.stringify(ordered(right));

export function PartnerAppearance({initial, apiBase, operatorSlug, section = 'all', language = 'sv', onSaved, roomId, onRoomChange, onDirtyChange, onBusyChange, onStatus, disabled = false, roomLayout = false, adminChoices = false, active: visible = true, children}: {
  initial: PartnerAppearanceInitial; apiBase: string; operatorSlug: string;
  section?: 'all'|'theme'|'design'|'background'|'dealers'; language?: string;
  onSaved?: (saved: PartnerAppearanceInitial) => void;
  disabled?: boolean; roomLayout?: boolean; onBusyChange?: (busy: boolean) => void;
  // Admin (N1) may pick any layer the frozen composition allows; partners keep the company gate.
  adminChoices?: boolean; onStatus?: (status: AppearanceRoomStatus|null) => void;
  // Admin room layout: a sibling editor (the room's game settings) beside the layer choices.
  children?: ReactNode;
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
  const [previewMedia,setPreviewMedia] = useState<PublicOperatorPreview|null>(null);
  const [sceneDraft,setSceneDraft] = useState<{identity:string;composition:CompositionSettings}|null>(null);
  const visual=roomLayout&&adminChoices;
  const busyRef = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
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
  const liveRoom=room?appearanceRoomStatus(server,room.id):null;
  const sceneIdentity=[initial.operatorId,operatorSlug,server.operatorId,room?.id,server.packageRevision,lane?.id,liveRoom?.live.table,liveRoom?.live.dealer].join(':');
  const publicationContext=useRef('');publicationContext.current=visible?sceneIdentity:'';
  const sceneEditing=visual&&sceneDraft?.identity===sceneIdentity;
  const frozenTable=server.presentation?.assets.find(row=>row.id===liveRoom?.live.table&&row.role==='table');
  const sharedSceneRooms=server.rooms?.filter(row=>row.presentationLaneId===lane?.id)??[];
  let sceneSupported=false, sceneSource:CompositionSettings|null=null, sceneSettings:CompositionSettings|null=null;
  if(visual&&room?.game==='blackjack'&&liveRoom?.live.table&&lane?.composition&&frozenTable&&frozenTable.width>0&&frozenTable.height>0){
    try{updatePublishedSceneLayout(lane.composition,liveRoom.live.table,lane.composition);sceneSupported=true;}catch{/* Invalid frozen scenes cannot be edited. */}
    if(previewMedia?.operatorSlug===operatorSlug&&previewMedia.roomId===room.id&&previewMedia.packageRevision===server.packageRevision
      &&previewMedia.dealer.id===liveRoom.live.dealer&&previewMedia.independentLayers&&previewMedia.settings
      &&previewMedia.media.tables.some(row=>row.id===liveRoom.live.table)&&sameValue(previewMedia.settings,lane.composition)){
      sceneSource=previewMedia.settings;
      if(sceneEditing)try{sceneSettings=updatePublishedSceneLayout(sceneSource,liveRoom.live.table,sceneDraft!.composition);}catch{/* Invalid layout cannot publish. */}
    }
  }
  const canStartScene=editable&&visible&&sceneSupported&&sharedSceneRooms.length===1&&!dirty;
  const canEditScene=canStartScene&&Boolean(sceneSource);
  const sceneChanged=sceneEditing&&!sameValue(sceneDraft!.composition,lane?.composition);
  const canPublishScene=canEditScene&&sceneChanged&&Boolean(sceneSettings);
  const unsaved=dirty||sceneChanged;
  useEffect(() => { onDirtyChange?.(unsaved); return () => onDirtyChange?.(false); }, [unsaved, branding, onDirtyChange]);
  const fields = FIELDS.filter(key => section === 'all' || section === 'theme' || section === 'design' && ['table','color'].includes(key) || section === 'background' && key === 'background' || section === 'dealers' && key === 'dealer');
  // The room layout keeps the three layers together and demotes table colour under them.
  const layerFields = roomLayout ? fields.filter(key => key !== 'color') : fields;
  const labels: Record<string, string> = {lane:t('Sammansättning','Composition'),table:t('Bord','Table'),background:t('Bakgrund','Background'),dealer:'Dealer',color:t('Bordsfärg','Table colour')};
  const reviewValid = Boolean(review && server.draft && !dirty && !stale && review.draftRevision === draftRevision && review.packageRevision === server.packageRevision && sameAppearance(review.branding, branding));
  const canSave = editable && !sceneEditing && (dirty || stale);
  const canReview = editable && !sceneEditing && server.draft && !dirty && !stale;
  const canPublish = editable && !sceneEditing && reviewValid && Boolean(review?.changes.length);
  const endpoint = `${apiBase}/branding?operator=${encodeURIComponent(operatorSlug)}`;
  const labelOf = (value: string|null) => {
    if (value === null) return t('Standard','Default');
    const composition = server.presentation?.lanes.find(item => item.id === value);
    return server.presentation?.assets.find(asset => asset.id === value)?.label
      ?? ((server.presentation?.schemaVersion === 2 || server.presentation?.schemaVersion === 3) ? server.presentation.registeredDealers.find(dealer => dealer.id === value)?.label : undefined)
      ?? (composition ? compositionLabel(composition.label, language) : value);
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

  function change(key: string, selection: string) {
    if (!editable || busyRef.current || sceneEditing) return;
    setBranding(current => changeAppearance(current, {roomId: room?.id ?? null, key, selection}));
    setReview(null); setNotice('');
  }
  function resetRoom() {
    if (!editable || busyRef.current || sceneEditing || !room) return;
    setBranding(current => resetAppearanceRoom(current, room.id)); setReview(null); setNotice('');
  }
  async function command(action: Action, sourcePackageRevision?: number) {
    if (!editable || busyRef.current || sceneEditing || action === 'save-draft' && !canSave || action === 'review' && !canReview
      || action === 'publish' && !canPublish || action === 'restore' && (dirty||sourcePackageRevision===server.packageRevision)) return;
    if(action==='discard-draft'&&!server.draft){setBranding(appearanceBranding(server.branding));setReview(null);setProblem('');setLatest(null);setNotice(t('Ändringarna är kastade.','Changes discarded.'));return;}
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
        setBlocked(true); setProblem(t('Din behörighet har ändrats. Redigeringen finns kvar här. Kontrollera åtkomsten innan du fortsätter.','Your access has changed. Your edits remain here. Check access before continuing.')); return;
      }
      if (response.status === 409) {
        setBlocked(true); setProblem(t('Paketet eller utkastet har ändrats. Din redigering finns kvar. Hämta senaste version och välj hur du vill fortsätta.','The package or draft has changed. Your edits remain here. Fetch the latest version and choose how to continue.')); return;
      }
      if (response.status === 413) {
        setProblem(t('Paketet är för stort. Minska antalet rumsundantag och försök spara igen. Din redigering finns kvar.','The package is too large. Reduce the number of room overrides and try saving again. Your edits are preserved.')); return;
      }
      if (!response.ok) {
        if (response.status >= 500) setBlocked(true);
        setProblem(t('Åtgärden kunde inte bekräftas. Redigeringen finns kvar. Kontrollera senaste version innan du försöker igen.','The action could not be confirmed. Your edits remain here. Check the latest version before retrying.')); return;
      }
      if (action === 'review') {
        if (!appearanceReview(payload, {draftRevision:expectedDraftRevision, packageRevision:expectedPackageRevision, branding})) throw new Error('invalid review');
        setReview(payload); setNotice(t('Granskningen är klar. Kontrollera ändringar och berörda rum innan publicering.','Review ready. Check the changes and affected rooms before publishing.')); return;
      }
      if (!appearanceReceipt(payload, initial.operatorId) || !payload.presentation || appearanceDraftRevision(payload) <= expectedDraftRevision
        || (action === 'discard-draft' ? appearanceDraftRevision(payload)!==expectedDraftRevision+1 || payload.packageRevision !== expectedPackageRevision || payload.draft !== null || !sameAppearance(payload.branding,server.branding) || !sameValue(payload.presentation,server.presentation)
          : action === 'publish' ? payload.packageRevision !== expectedPackageRevision + 1 || payload.draft !== null
          : payload.packageRevision !== expectedPackageRevision || !payload.draft || payload.draft.basePackageRevision !== expectedPackageRevision)
        || action === 'save-draft' && !sameAppearance(payload.draft?.branding, branding)) throw new Error('invalid receipt');
      setServer(payload); setBranding(appearanceDraftBranding(payload));
      setNotice(action === 'discard-draft' ? t('Bolagets materialutkast är kastat. Publicerade rum är oförändrade.','Company material draft discarded. Published rooms are unchanged.')
        : action === 'publish' ? t(`Publicerat som version ${payload.packageRevision}.`, `Published as version ${payload.packageRevision}.`)
        : action === 'restore' ? t('Tidigare version har återställts till ett sparat utkast. Publicerad version är oförändrad.','Earlier version restored to a saved draft. The published version is unchanged.')
        : t('Utkastet är sparat. Publicerad version är oförändrad.','Draft saved. The published version is unchanged.'));
      if (action === 'publish'||action==='discard-draft') onSaved?.(payload);
    } catch {
      if (active.current) { setBlocked(true); setProblem(t('Svaret kunde inte bekräftas. Redigeringen finns kvar. Hämta senaste version innan du fortsätter.','The response could not be confirmed. Your edits remain here. Fetch the latest version before continuing.')); }
    } finally {
      if (active.current) reportBusy(false); else busyRef.current = false;
    }
  }
  function changeScene(composition:CompositionSettings){
    if(!canEditScene||busyRef.current||!sceneEditing||!sceneSource||!liveRoom?.live.table||publicationContext.current!==sceneIdentity)return;
    try{setSceneDraft({identity:sceneIdentity,composition:updatePublishedSceneLayout(sceneSource,liveRoom.live.table,composition)});setProblem('');setNotice('');}
    catch{setProblem(t('Placeringen är ogiltig eller ändrar ett annat bord.','The layout is invalid or changes another table.'));}
  }
  async function publishSceneLayout() {
    if(!active.current||publicationContext.current!==sceneIdentity||!canPublishScene||busyRef.current||!room||!lane||!liveRoom?.live.table||!sceneSettings||!server.presentation)return;
    const identity=sceneIdentity,expectedPackageRevision=server.packageRevision;
    const intent={action:'update-scene-layout',operatorId:server.operatorId,roomId:room.id,tableId:liveRoom.live.table,expectedPackageRevision,composition:sceneSettings};
    const expectedPresentation={...server.presentation,lanes:server.presentation.lanes.map(row=>row.id===lane.id?{...row,composition:sceneSettings}:row)};
    const current=()=>active.current&&publicationContext.current===identity;
    reportBusy(true);setProblem('');setNotice('');setReview(null);setLatest(null);
    try{
      const response=await fetch('/studio/api/admin/operator-package',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(intent)});
      const value:unknown=await response.json().catch(()=>null);if(!current())return;
      if(response.status===413){
        setProblem(t('Scenens publiceringspaket överskrider lagringsgränsen. Inget publicerades och dina ändringar finns kvar.','The scene publication package exceeds the storage limit. Nothing was published and your edits are still here.'));
        return;
      }
      const receipt=value&&typeof value==='object'?value as Record<string,unknown>:null;
      if(!response.ok||receipt?.operatorId!==server.operatorId||receipt.packageRevision!==expectedPackageRevision+1
        ||!sameValue(receipt.presentation,expectedPresentation)||!sameValue(receipt.adjusted,{roomId:room.id,tableId:liveRoom.live.table}))throw new Error('unconfirmed publication');
      // A write receipt alone is insufficient: adopt only the separately read
      // published version, including the unchanged saved material draft.
      const refreshed=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      const saved:unknown=await refreshed.json().catch(()=>null);if(!current())return;
      if(!refreshed.ok||!appearanceReceipt(saved,initial.operatorId)||saved.packageRevision!==expectedPackageRevision+1
        ||!sameValue(saved.presentation,expectedPresentation)||!sameAppearance(saved.branding,server.branding)
        ||!sameValue(saved.draft,server.draft)||appearanceDraftRevision(saved)!==draftRevision)throw new Error('unconfirmed readback');
      setServer(saved);setBranding(appearanceDraftBranding(saved));setSceneDraft(null);
      setNotice(t(`Scenens placering är publicerad som version ${saved.packageRevision}.`,`Scene layout published as version ${saved.packageRevision}.`)+(saved.draft?' '+t('Sparade materialval ligger kvar som utkast.','Saved material choices remain a draft.'):''));
      onSaved?.(saved);
    }catch{
      if(current()){setBlocked(true);setProblem(t('Scenpubliceringen kunde inte bekräftas. Hämta senaste version innan du försöker igen.','Scene publication could not be confirmed. Fetch the latest version before retrying.'));}
    }finally{if(active.current)reportBusy(false);else busyRef.current=false;}
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
    if (!latest || busyRef.current || keepLocal && sceneChanged) return;
    setServer(latest); if (!keepLocal) setBranding(appearanceDraftBranding(latest));
    setBlocked(false); setLatest(null); setReview(null); setProblem('');setSceneDraft(null);
    setNotice(keepLocal ? t('Din redigering behölls mot senaste version. Spara och granska igen före publicering.','Your edits were kept against the latest version. Save and review again before publishing.')
      : t('Senaste sparade version är inläst.','Latest saved version loaded.'));
  }

  const preview = <div data-appearance-preview="frozen-composition" className={roomLayout ? styles.hero : undefined}><PartnerAppearancePreview onMedia={visual?setPreviewMedia:undefined} compact={roomLayout} initiallyEnabled={roomLayout} active={visible} server={server} branding={sceneEditing?appearanceBranding(server.branding):branding}
    sceneLayout={sceneEditing&&liveRoom?.live.table?{tableId:liveRoom.live.table,composition:sceneDraft!.composition,disabled:!canEditScene||busy,onChange:changeScene}:undefined}
    scope={room?.id ?? ''} operatorSlug={operatorSlug} language={language} onStale={() => {setReview(null);setBlocked(true);setProblem(t('Förhandsvisningens paketversion har ändrats. Din redigering finns kvar. Hämta senaste version och granska på nytt.','The preview package version has changed. Your edits remain here. Fetch the latest version and review again.'));}}/></div>;
  const sceneLayoutControls=sceneSupported?<section className={styles.review} aria-label={t('Publicerad scen','Published scene')}>
    <h4>{t('Publicerad scen','Published scene')}</h4>
    <p>{t('Redigera kort, marker, lager och spelkontroller för mobil och desktop i förhandsvisningen. Sparade materialutkast behålls.','Edit cards, betting positions, layers and game controls for mobile and desktop in the preview. Saved material drafts are preserved.')}</p>
    {sharedSceneRooms.length>1?<p>{t('Scenen delas av dessa rum: ','This scene is shared by these rooms: ')}{sharedSceneRooms.map(row=>row.label).join(', ')}. <a href={`/admin/clips?${new URLSearchParams({operator:operatorSlug,table:room!.id,composition:lane!.id,game:'blackjack',panel:'layers'})}`}>{t('Redigera den gemensamma mallen','Edit the shared template')}</a></p>:null}
    {sceneEditing?<>
      {!sceneSource?<p role="status">{t('Ladda den publicerade scenens förhandsvisning för att börja redigera.','Load the published scene preview to start editing.')}</p>:null}
      <div className={styles.actions}>{sceneChanged&&<button type="button" className="sg-btn sg-btn-primary" data-action="publish-scene-layout" disabled={!canPublishScene||busy} onClick={publishSceneLayout}>{t('Publicera scenens placering','Publish scene layout')}</button>}<button type="button" className="sg-btn" data-action="close-scene-layout" disabled={busy} onClick={()=>{if(!busyRef.current)setSceneDraft(null);}}>{sceneChanged?t('Kasta layoutändringar','Discard layout changes'):t('Stäng layoutredigering','Close layout editor')}</button></div>
    </>:<button type="button" className="sg-btn" data-action="open-scene-layout" disabled={!canStartScene||busy} onClick={()=>{if(canStartScene&&!busyRef.current&&lane?.composition){setSceneDraft({identity:sceneIdentity,composition:structuredClone(lane.composition)});setReview(null);}}}>{t('Redigera publicerad scen','Edit published scene')}</button>}
  </section>:null;
  const revisions = <div className={styles.revisions}><span>{t('Publicerad version','Published version')} <strong>{server.packageRevision}</strong></span><span>{server.draft ? t(`Sparat utkast ${draftRevision}`,`Saved draft ${draftRevision}`) : t('Inget sparat utkast','No saved draft')}</span></div>;
  const publishActions = <div className={styles.actions}><button type="button" className="sg-btn sg-btn-primary" data-action="save-draft" disabled={!canSave || busy} onClick={() => command('save-draft')}>{t('Spara utkast','Save draft')}</button><button type="button" className="sg-btn" data-action="review" disabled={!canReview || busy} onClick={() => command('review')}>{t('Granska publicering','Review publication')}</button>{(server.draft||dirty)&&<button type="button" className="sg-btn" data-action="discard-draft" disabled={!editable||busy||sceneEditing} onClick={()=>command('discard-draft')}>{server.draft?t('Kasta bolagets materialutkast','Discard company material draft'):t('Kasta ändringar','Discard changes')}</button>}</div>;
  const reviewPanel = <section className={styles.review} hidden={visual ? !review : roomLayout && !server.draft && !review} aria-label={t('Granskning före publicering','Review before publishing')}>
      <h4>{t('Granskning före publicering','Review before publishing')}</h4>
      {reviewValid && review ? <><p>{t(`Utkast ${review.draftRevision} ersätter publicerad version ${review.packageRevision}.`,`Draft ${review.draftRevision} replaces published version ${review.packageRevision}.`)}</p>
        {review.changes.length ? <ul className={styles.changes}>{review.changes.map((row,index) => <li key={`${row.roomId}:${row.key}:${index}`}><strong>{roomLabel(row.roomId)} · {row.key.startsWith('roomOverrides.') ? (labels[row.key.slice(14)] ?? row.key) + ' (' + t('rumsval','room override') + ')' : labels[row.key] ?? row.key}</strong><span>{labelOf(row.before)} → {labelOf(row.after)}</span></li>)}</ul> : <p>{t('Inga ändringar att publicera.','No changes to publish.')}</p>}
        <p><strong>{t('Berörda rum','Affected rooms')}:</strong> {review.affectedRooms.length ? review.affectedRooms.map(roomLabel).join(', ') : t('Inga befintliga rum','No existing rooms')}</p>
      </> : <p>{t('Spara utkastet och granska för att se skillnaden mot den publicerade versionen.','Save the draft and review it to see changes from the published version.')}</p>}
      {!roomLayout && preview}
      <button type="button" className="sg-btn sg-btn-primary" data-action="publish" disabled={!canPublish || busy} onClick={() => command('publish')}>{t('Publicera granskat utkast','Publish reviewed draft')}</button>
    </section>;
  const secondaryControls = <>
      {roomLayout && fields.includes('color') && allowed.has('table.color') && (() => {
        // Table colour only tints game interface details; it sits small under the three layers.
        const values = lane?.layers.table.colors ?? [];
        const selectedValue = selected.color ?? '';
        return <div className={styles.colorRow}><span>{labels.color}</span>{values.length
          ? <select aria-label={labels.color} value={selectedValue} disabled={!values.length} onChange={event => change('color',event.target.value)}><option value="">{t('Standard','Default')}</option>{selectedValue && !values.includes(selectedValue) ? <option value={selectedValue}>{selectedValue} — {t('inte längre tillgängligt','no longer available')}</option> : null}{values.map(value => <option key={value} value={value}>{value}</option>)}</select>
          : <><input type="color" aria-label={labels.color} value={/^#[a-f0-9]{6}$/i.test(selected.color ?? '') ? selected.color : '#000000'} onChange={event => change('color',event.target.value.toLowerCase())} /><button type="button" className="sg-btn" disabled={!selected.color} onClick={() => change('color','')}>{t('Standard','Default')}</button></>}
          <small>{t('Spelets gränssnittsdetaljer, inte dealerfilmen.','Game interface details, not the dealer video.')}</small></div>;
      })()}
      {room ? <button type="button" className="sg-btn" data-action="reset-room" disabled={!branding.roomOverrides?.[room.id]} onClick={resetRoom}>{t('Återställ rummet till standard','Reset room to defaults')}</button> : null}
  </>;
  const statusBar = <div className={styles.statusBar+(visual?' '+styles.saveBar:'')}><p role="status" aria-live="polite">{busy ? t('Arbetar…','Working…') : notice || (unsaved ? t('Du har osparade ändringar.','You have unsaved changes.') : server.draft ? t('Alla ändringar är sparade i utkastet.','All changes are saved in the draft.') : t('Du ser den publicerade versionen.','You are viewing the published version.'))}</p>{roomLayout && !visual && revisions}{visual && publishActions}{(!visual||blocked) && <button type="button" className="sg-btn" data-action="refresh" disabled={busy} onClick={refresh}>{t('Hämta senaste version','Fetch latest version')}</button>}</div>;
  return <section className={roomLayout ? styles.panel + ' ' + styles.roomPanel + (visual?' '+styles.visualPanel:'') : styles.panel} aria-label={t('Utkast och publicering','Draft and publishing')}>
    {!visual && (roomLayout ? preview : <header className={styles.heading}><div><h3>{t('Sammansättning','Composition')}</h3><p className={styles.hint}>{t('Spara ett utkast, granska skillnaden och publicera när det är klart.','Save a draft, review the changes and publish when ready.')}</p></div>
      {revisions}
    </header>)}
    {!visual && statusBar}
    {problem ? <p className={styles.problem} role="alert">{problem}</p> : null}
    {!ready ? <p role="alert">{t('Utkast och publicering är inte tillgängliga för det här paketet ännu.','Drafts and publishing are not available for this package yet.')}</p> : null}
    {server.canConfigure !== true ? <p>{t('Din roll kan läsa paketet. Ändring kräver rättigheten att konfigurera presentationer.','Your role can view the package. Editing requires permission to configure presentations.')}</p> : null}
    {stale ? <p className={styles.problem}>{t('Utkastet bygger på en äldre publicerad version. Spara det mot aktuell version och granska igen.','The draft is based on an older published version. Save it against the current version and review again.')}</p> : null}
    {latest ? <aside className={styles.review} aria-label={t('Senaste version','Latest version')}><p>{t(`Senast publicerad: ${latest.packageRevision}. Sparat utkast: ${latest.draft?.revision ?? '–'}. Din redigering är fortfarande kvar.`,`Latest published: ${latest.packageRevision}. Saved draft: ${latest.draft?.revision ?? '–'}. Your edits are still here.`)}</p>
      {sceneChanged?<p>{t('Layoutändringarna är kvar i förhandsvisningen. De kan inte automatiskt flyttas till en annan version. ”Ersätt min redigering” kastar dem och läser in den senast publicerade scenen.','Your layout edits remain in the preview. They cannot be automatically moved to another version. “Replace my edits” discards them and loads the latest published scene.')}</p>:null}
      {latest.canConfigure !== true ? <p>{t('Du har inte längre rättighet att ändra paketet. Du kan fortfarande behålla din redigering här.','You no longer have permission to change this package. You can still keep your edits here.')}</p> : null}
      <div className={styles.actions}><button type="button" className="sg-btn" data-action="keep-local" disabled={busy || latest.canConfigure !== true || sceneChanged} onClick={() => adopt(true)}>{t('Behåll min redigering','Keep my edits')}</button><button type="button" className="sg-btn" data-action="load-latest" disabled={busy} onClick={() => adopt(false)}>{t('Ersätt min redigering med senaste sparade','Replace my edits with latest saved')}</button></div>
    </aside> : null}
      {roomId === undefined && <label className={styles.row}>{t('Gäller för','Applies to')}<select aria-label={t('Gäller för','Applies to')} value={room?.id ?? ''} disabled={busy} onChange={event => { if (!busyRef.current) { setScope(event.target.value); onRoomChange?.(event.target.value); } }}><option value="">{t('Bolagets standard','Company default')}</option>{server.rooms?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
    <div className={roomLayout ? styles.roomLayout : undefined} data-aside={roomLayout && !visual && Boolean(children) ? 'true' : undefined}>
      {visual && preview}
      <div className={roomLayout ? styles.choicesColumn : undefined}>
    <fieldset className={styles.editor} disabled={!editable || busy || sceneEditing}>
      <legend>{visual ? t('Välj material','Choose assets') : roomLayout ? t('Rummets val','Room choices') : t('Val i spelet','In-game choices')}</legend>
      {roomLayout && <p className={styles.hint}>{visual ? t('Välj dealer och bord till spelet. Bakgrunden byter du separat.','Choose a dealer and table for the game. Change the background separately.') : t('Bakgrund, dealer och bord bland det sammansättningen tillåter. Spara ett utkast, granska och publicera.','Background, dealer and table among what the composition allows. Save a draft, review and publish.')}</p>}
      {!roomLayout && <label className={styles.row}>{labels.lane}<select aria-label={labels.lane} value={laneId} disabled={Boolean(room) || !editable || busy} onChange={event => change('lane',event.target.value)}>{server.presentation?.lanes.map(item => <option key={item.id} value={item.id}>{compositionLabel(item.label, language)}</option>)}</select></label>}
      {room && !roomLayout ? <p className={styles.hint}>{t('Rummets sammansättning bestäms av intern personal. Standardval ärvs från bolaget när sammansättningen är samma, annars från rummets sammansättning.','Internal staff set the room composition. Defaults inherit company choices for the same composition, otherwise the room composition defaults.')}</p> : null}
      {lane && !lane.composition ? <p className={styles.hint}>{t('Äldre sammansättning: be intern personal uppdatera separata bord- och bakgrundslager. Dealerklippets gröna bakgrund tas alltid bort.','Legacy composition: ask internal staff to update the separate table and background layers. The dealer clip’s green background is always removed.')}</p> : null}
      <div className={styles.fields}>{layerFields.map(key => {
        const token = key === 'color' ? 'table.color' : key;
        const layer = key === 'color' ? lane?.layers.table : lane?.layers[key];
        const effective = selected[key] ?? inherited[key] ?? (key !== 'color' ? layer?.default : undefined);
        if(visual&&key!=='color'){
          const ids:readonly string[]=allowed.has(token)?(key==='dealer'?dealerChoices:lane?partnerLayerChoices(lane,key):[]):effective&&!(key==='dealer'&&!dealerChoices.length)?[effective]:[];
          const media=key==='background'?previewMedia?.media.backgrounds:key==='table'?previewMedia?.media.tables:[];
          return <AppearanceLayerPicker key={key} kind={key} label={labels[key]} value={selected[key]??''} effective={effective} locked={!allowed.has(token)} lockedReason={key==='background'&&lane?.layers.background.mode==='baked'?'Bakgrunden är inbakad i dealerfilmen. Välj en spelmall med separata lager för att byta den.':key==='dealer'&&!dealerChoices.length?'Det saknas en tillåten dealer för detta spel.':undefined} choices={ids.map(id=>({id,label:labelOf(id),...media?.find(item=>item.id===id)}))} onChange={id=>change(key,id)}/>;
        }
        if (!allowed.has(token)) return roomLayout ? <div className={styles.lockedChoice} key={key}><span>{labels[key]}</span><strong>{effective ? labelOf(effective) : t('Inget valt','None selected')}</strong><small>{adminChoices ? t('Fast i sammansättningen','Fixed by the composition') : t('Låst i publicerat paket','Locked in published package')}</small></div> : <label className={styles.row} key={key}>{labels[key]}<input disabled readOnly value={t('Inte tillgängligt i denna presentation','Unavailable in this presentation')} /></label>;
        const values: readonly string[] = key === 'dealer' ? dealerChoices : key === 'color' ? lane?.layers.table.colors ?? [] : lane ? partnerLayerChoices(lane, key) : [];
        if (key === 'color' && !values.length) return <div className={styles.row} key={key}><label>{labels[key]}<input type="color" aria-label={labels[key]} value={/^#[a-f0-9]{6}$/i.test(selected.color ?? '') ? selected.color : '#000000'} onChange={event => change('color',event.target.value.toLowerCase())} /></label><button type="button" className="sg-btn" disabled={!selected.color} onClick={() => change('color','')}>{t('Använd standardfärg','Use default colour')}</button><span className={styles.hint}>{selected.color || t('Standard','Default')}</span></div>;
        const selectedValue = selected[key] ?? '';
        return <label className={styles.row} key={key}>{labels[key]}<select aria-label={labels[key]} value={selectedValue} disabled={!values.length} onChange={event => change(key,event.target.value)}><option value="">{t('Standard','Default')}{key !== 'color' && (room ? inherited[key] ?? layer?.default : layer?.default) ? `: ${labelOf((room ? inherited[key] ?? layer?.default : layer?.default)! )}` : ''}</option>{selectedValue && !values.includes(selectedValue) ? <option value={selectedValue}>{labelOf(selectedValue)} — {t('inte längre tillgängligt','no longer available')}</option> : null}{values.map(value => <option key={value} value={value}>{labelOf(value)}</option>)}</select></label>;
      })}</div>
      {visual ? <details className={styles.extraChoices}><summary>{t('Färg och standardval','Colour and defaults')}</summary>{secondaryControls}</details> : secondaryControls}
    </fieldset>
    {sceneLayoutControls}
    {!roomLayout && <p className={styles.hint}>{t('Bordsfärgen påverkar spelets gränssnittsdetaljer, inte dealerfilmen. Logotyp, spelmarker och knappar saknar ännu koppling till spelet.','Table colour affects game interface details, not the dealer video. Logos, chips and buttons are not yet connected to the game.')}</p>}
    {!visual && publishActions}
    {!visual && reviewPanel}
      </div>
      {roomLayout && !visual && children ? <div className={styles.asideColumn}>{children}</div> : null}
    </div>
    {visual && statusBar}
    {visual && reviewPanel}
    {visual && children ? <details className={styles.gameSettings}><summary>Spelinställningar</summary>{children}</details> : null}
    <details className={styles.history}><summary>{t('Versionshistorik','Version history')}</summary>{visual && <div className={styles.actions}>{revisions}{!blocked&&<button type="button" className="sg-btn" data-action="refresh" disabled={busy} onClick={refresh}>{t('Hämta senaste version','Fetch latest version')}</button>}</div>}<p>{t('De 20 senaste publicerade versionerna visas. Återställning skapar ett utkast. Spara egna ändringar först. Live ändras först efter granskning och publicering.','The 20 latest published versions are shown. Restoring creates a draft. Save your own edits first. Live changes only after review and publication.')}</p>
      <ul>{server.history?.map(row => <li key={row.revision}><span><strong>{t('Version','Version')} {row.revision}</strong>{row.revision === server.packageRevision ? ` · ${t('publicerad nu','currently published')}` : ''}{row.publishedAt ? <small>{new Date(row.publishedAt).toLocaleString(en ? 'en-GB' : 'sv-SE')}</small> : null}</span>{row.revision!==server.packageRevision&&<button type="button" className="sg-btn" data-action={`restore-${row.revision}`} disabled={!editable || busy || dirty || sceneEditing} onClick={() => command('restore',row.revision)}>{t('Återställ till utkast','Restore to draft')}</button>}</li>)}</ul>
    </details>
  </section>;
}
