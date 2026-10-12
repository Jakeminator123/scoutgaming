'use client';

import {useEffect, useRef, useState} from 'react';
import styles from './partner-appearance.module.css';
import {PartnerAppearancePreview} from './partner-appearance-preview';
import {effectivePartnerAdjustments} from '../lib/partner-package-view.mjs';
import {compositionLabel} from '../lib/control-flow.mjs';
import {appearanceBranding, appearanceDraftBranding, appearanceDraftRevision, appearanceReceipt, appearanceReview, changeAppearance, resetAppearanceRoom, sameAppearance} from './partner-appearance-state.mjs';
import type {AppearanceReview, EditableBranding, PartnerAppearanceInitial} from './partner-appearance-state.mjs';
export type {PartnerAppearanceInitial} from './partner-appearance-state.mjs';

const FIELDS = ['table', 'background', 'dealer', 'color'] as const;
type Action = 'save-draft'|'review'|'publish'|'restore';

export function PartnerAppearance({initial, apiBase, operatorSlug, section = 'all', language = 'sv', onSaved, roomId, onRoomChange, onDirtyChange, active: visible = true}: {
  initial: PartnerAppearanceInitial; apiBase: string; operatorSlug: string;
  section?: 'all'|'theme'|'design'|'background'|'dealers'; language?: string;
  onSaved?: (saved: PartnerAppearanceInitial) => void;
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
  const busyRef = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const ready = appearanceReceipt(server, initial.operatorId) && Boolean(server.presentation);
  const editable = ready && server.canConfigure === true && !blocked;
  const draftRevision = appearanceDraftRevision(server);
  const dirty = !sameAppearance(branding, appearanceDraftBranding(server));
  const stale = Boolean(server.draft && server.draft.basePackageRevision !== server.packageRevision);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, branding, onDirtyChange]);
  const room = server.rooms?.find(row => row.id === (roomId ?? scope));
  const laneId = room?.presentationLaneId ?? branding.lane ?? server.presentation?.lanes[0]?.id ?? '';
  const lane = server.presentation?.lanes.find(row => row.id === laneId);
  const allowed = new Set<string>(lane ? effectivePartnerAdjustments(lane) : []);
  const dealerChoices = (room ? server.roomDealerChoices?.[room.id] : server.dealerChoices?.[laneId]) ?? [];
  if (!dealerChoices.length) allowed.delete('dealer');
  const selected = room ? branding.roomOverrides?.[room.id] ?? {} : branding;
  const fields = FIELDS.filter(key => section === 'all' || section === 'theme' || section === 'design' && ['table','color'].includes(key) || section === 'background' && key === 'background' || section === 'dealers' && key === 'dealer');
  const labels: Record<string, string> = {lane:t('Sammansättning','Composition'),table:t('Bord','Table'),background:t('Bakgrund','Background'),dealer:'Dealer',color:t('Bordsfärg','Table colour')};
  const reviewValid = Boolean(review && server.draft && !dirty && !stale && review.draftRevision === draftRevision && review.packageRevision === server.packageRevision && sameAppearance(review.branding, branding));
  const canSave = editable && (dirty || stale);
  const canReview = editable && server.draft && !dirty && !stale;
  const canPublish = editable && reviewValid && Boolean(review?.changes.length);
  const endpoint = `${apiBase}/branding?operator=${encodeURIComponent(operatorSlug)}`;
  const labelOf = (value: string|null) => {
    if (value === null) return t('Standard','Default');
    const composition = server.presentation?.lanes.find(item => item.id === value);
    return server.presentation?.assets.find(asset => asset.id === value)?.label
      ?? ((server.presentation?.schemaVersion === 2 || server.presentation?.schemaVersion === 3) ? server.presentation.registeredDealers.find(dealer => dealer.id === value)?.label : undefined)
      ?? (composition ? compositionLabel(composition.label, language) : value);
  };
  const roomLabel = (id: string|null) => id === null ? t('Bolagets standard','Company default') : server.rooms?.find(row => row.id === id)?.label ?? id;

  function change(key: string, selection: string) {
    if (!editable || busyRef.current) return;
    setBranding(current => changeAppearance(current, {roomId: room?.id ?? null, key, selection}));
    setReview(null); setNotice('');
  }
  function resetRoom() {
    if (!editable || busyRef.current || !room) return;
    setBranding(current => resetAppearanceRoom(current, room.id)); setReview(null); setNotice('');
  }
  async function command(action: Action, sourcePackageRevision?: number) {
    if (!editable || busyRef.current || action === 'save-draft' && !canSave || action === 'review' && !canReview
      || action === 'publish' && !canPublish || action === 'restore' && dirty) return;
    busyRef.current = true; setBusy(true); setProblem(''); setNotice(''); setLatest(null);
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
        || (action === 'publish' ? payload.packageRevision !== expectedPackageRevision + 1 || payload.draft !== null
          : payload.packageRevision !== expectedPackageRevision || !payload.draft || payload.draft.basePackageRevision !== expectedPackageRevision)
        || action === 'save-draft' && !sameAppearance(payload.draft?.branding, branding)) throw new Error('invalid receipt');
      setServer(payload); setBranding(appearanceDraftBranding(payload));
      setNotice(action === 'publish' ? t(`Publicerat som version ${payload.packageRevision}.`, `Published as version ${payload.packageRevision}.`)
        : action === 'restore' ? t('Tidigare version har återställts till ett sparat utkast. Publicerad version är oförändrad.','Earlier version restored to a saved draft. The published version is unchanged.')
        : t('Utkastet är sparat. Publicerad version är oförändrad.','Draft saved. The published version is unchanged.'));
      if (action === 'publish') onSaved?.(payload);
    } catch {
      if (active.current) { setBlocked(true); setProblem(t('Svaret kunde inte bekräftas. Redigeringen finns kvar. Hämta senaste version innan du fortsätter.','The response could not be confirmed. Your edits remain here. Fetch the latest version before continuing.')); }
    } finally {
      busyRef.current = false; if (active.current) setBusy(false);
    }
  }
  async function refresh() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setReview(null); setNotice(''); setLatest(null);
    try {
      const response = await fetch(endpoint, {credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      const payload: unknown = await response.json().catch(() => null);
      if (!active.current) return;
      if (!response.ok || !appearanceReceipt(payload,initial.operatorId) || !payload.presentation) throw new Error('invalid refresh');
      setLatest(payload); setBlocked(true); setProblem('');
    } catch {
      if (active.current) { setBlocked(true); setProblem(t('Senaste version kunde inte hämtas. Din redigering finns kvar här.','Could not fetch the latest version. Your edits remain here.')); }
    } finally { busyRef.current = false; if (active.current) setBusy(false); }
  }
  function adopt(keepLocal: boolean) {
    if (!latest || busyRef.current) return;
    setServer(latest); if (!keepLocal) setBranding(appearanceDraftBranding(latest));
    setBlocked(false); setLatest(null); setReview(null); setProblem('');
    setNotice(keepLocal ? t('Din redigering behölls mot senaste version. Spara och granska igen före publicering.','Your edits were kept against the latest version. Save and review again before publishing.')
      : t('Senaste sparade version är inläst.','Latest saved version loaded.'));
  }

  return <section className={styles.panel} aria-label={t('Utkast och publicering','Draft and publishing')}>
    <header className={styles.heading}><div><h3>{t('Sammansättning','Composition')}</h3><p>{t('Spara ett utkast, granska skillnaden och publicera när det är klart.','Save a draft, review the changes and publish when ready.')}</p></div>
      <div className={styles.revisions}><span>{t('Publicerad version','Published version')} <strong>{server.packageRevision}</strong></span><span>{server.draft ? t(`Sparat utkast ${draftRevision}`,`Saved draft ${draftRevision}`) : t('Inget sparat utkast','No saved draft')}</span></div>
    </header>
    <p role="status" aria-live="polite">{busy ? t('Arbetar…','Working…') : notice || (dirty ? t('Du har osparade ändringar.','You have unsaved changes.') : server.draft ? t('Alla ändringar är sparade i utkastet.','All changes are saved in the draft.') : t('Du ser den publicerade versionen.','You are viewing the published version.'))}</p>
    {problem ? <p className={styles.problem} role="alert">{problem}</p> : null}
    {!ready ? <p role="alert">{t('Utkast och publicering är inte tillgängliga för det här paketet ännu.','Drafts and publishing are not available for this package yet.')}</p> : null}
    {server.canConfigure !== true ? <p>{t('Din roll kan läsa paketet. Ändring kräver rättigheten att konfigurera presentationer.','Your role can view the package. Editing requires permission to configure presentations.')}</p> : null}
    {stale ? <p className={styles.problem}>{t('Utkastet bygger på en äldre publicerad version. Spara det mot aktuell version och granska igen.','The draft is based on an older published version. Save it against the current version and review again.')}</p> : null}
    <div className={styles.actions}><button type="button" className="sg-btn" data-action="refresh" disabled={busy} onClick={refresh}>{t('Hämta senaste version','Fetch latest version')}</button></div>
    {latest ? <aside className={styles.review} aria-label={t('Senaste version','Latest version')}><p>{t(`Senast publicerad: ${latest.packageRevision}. Sparat utkast: ${latest.draft?.revision ?? '–'}. Din redigering är fortfarande kvar.`,`Latest published: ${latest.packageRevision}. Saved draft: ${latest.draft?.revision ?? '–'}. Your edits are still here.`)}</p>
      {latest.canConfigure !== true ? <p>{t('Du har inte längre rättighet att ändra paketet. Du kan fortfarande behålla din redigering här.','You no longer have permission to change this package. You can still keep your edits here.')}</p> : null}
      <div className={styles.actions}><button type="button" className="sg-btn" data-action="keep-local" disabled={busy || latest.canConfigure !== true} onClick={() => adopt(true)}>{t('Behåll min redigering','Keep my edits')}</button><button type="button" className="sg-btn" data-action="load-latest" disabled={busy} onClick={() => adopt(false)}>{t('Ersätt min redigering med senaste sparade','Replace my edits with latest saved')}</button></div>
    </aside> : null}
      {roomId === undefined && <label className={styles.row}>{t('Gäller för','Applies to')}<select aria-label={t('Gäller för','Applies to')} value={room?.id ?? ''} disabled={busy} onChange={event => { if (!busyRef.current) { setScope(event.target.value); onRoomChange?.(event.target.value); } }}><option value="">{t('Bolagets standard','Company default')}</option>{server.rooms?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
    <fieldset className={styles.editor} disabled={!editable || busy}>
      <legend>{t('Val i spelet','In-game choices')}</legend>
      <label className={styles.row}>{labels.lane}<select aria-label={labels.lane} value={laneId} disabled={Boolean(room) || !editable || busy} onChange={event => change('lane',event.target.value)}>{server.presentation?.lanes.map(item => <option key={item.id} value={item.id}>{compositionLabel(item.label, language)}</option>)}</select></label>
      {room ? <p className={styles.hint}>{t('Rummets sammansättning bestäms av intern personal. Standardval ärvs från bolaget när sammansättningen är samma, annars från rummets sammansättning.','Internal staff set the room composition. Defaults inherit company choices for the same composition, otherwise the room composition defaults.')}</p> : null}
      {lane && !lane.composition ? <p className={styles.hint}>{t('Fullbildsklipp: bord och bakgrund är inbakade och kan inte bytas separat.','Full-frame video: table and background are baked in and cannot be changed separately.')}</p> : null}
      <div className={styles.fields}>{fields.map(key => {
        const token = key === 'color' ? 'table.color' : key;
        if (!allowed.has(token)) return <label className={styles.row} key={key}>{labels[key]}<input disabled readOnly value={t('Inte tillgängligt i denna presentation','Unavailable in this presentation')} /></label>;
        const layer = key === 'color' ? lane?.layers.table : lane?.layers[key];
        const values = key === 'dealer' ? dealerChoices : key === 'color' ? lane?.layers.table.colors ?? [] : layer?.allowed ?? [];
        if (key === 'color' && !values.length) return <div className={styles.row} key={key}><label>{labels[key]}<input type="color" aria-label={labels[key]} value={/^#[a-f0-9]{6}$/i.test(selected.color ?? '') ? selected.color : '#000000'} onChange={event => change('color',event.target.value.toLowerCase())} /></label><button type="button" className="sg-btn" disabled={!selected.color} onClick={() => change('color','')}>{t('Använd standardfärg','Use default colour')}</button><span className={styles.hint}>{selected.color || t('Standard','Default')}</span></div>;
        const selectedValue = selected[key] ?? '';
        return <label className={styles.row} key={key}>{labels[key]}<select aria-label={labels[key]} value={selectedValue} disabled={!values.length} onChange={event => change(key,event.target.value)}><option value="">{t('Standard','Default')}{!room && layer?.default && key !== 'color' ? `: ${labelOf(layer.default)}` : ''}</option>{selectedValue && !values.includes(selectedValue) ? <option value={selectedValue}>{labelOf(selectedValue)} — {t('inte längre tillgängligt','no longer available')}</option> : null}{values.map(value => <option key={value} value={value}>{labelOf(value)}</option>)}</select></label>;
      })}</div>
      {room ? <button type="button" className="sg-btn" data-action="reset-room" disabled={!branding.roomOverrides?.[room.id]} onClick={resetRoom}>{t('Återställ rummet till standard','Reset room to defaults')}</button> : null}
    </fieldset>
    <p className={styles.hint}>{t('Bordsfärgen påverkar spelets gränssnittsdetaljer, inte dealerfilmen. Logotyp, spelmarker och knappar saknar ännu koppling till spelet.','Table colour affects game interface details, not the dealer video. Logos, chips and buttons are not yet connected to the game.')}</p>
    <div className={styles.actions}><button type="button" className="sg-btn sg-btn-primary" data-action="save-draft" disabled={!canSave || busy} onClick={() => command('save-draft')}>{t('Spara utkast','Save draft')}</button><button type="button" className="sg-btn" data-action="review" disabled={!canReview || busy} onClick={() => command('review')}>{t('Granska publicering','Review publication')}</button></div>
    <section className={styles.review} aria-label={t('Granskning före publicering','Review before publishing')}>
      <h4>{t('Granskning före publicering','Review before publishing')}</h4>
      {reviewValid && review ? <><p>{t(`Utkast ${review.draftRevision} ersätter publicerad version ${review.packageRevision}.`,`Draft ${review.draftRevision} replaces published version ${review.packageRevision}.`)}</p>
        {review.changes.length ? <ul className={styles.changes}>{review.changes.map((row,index) => <li key={`${row.roomId}:${row.key}:${index}`}><strong>{roomLabel(row.roomId)} · {row.key.startsWith('roomOverrides.') ? (labels[row.key.slice(14)] ?? row.key) + ' (' + t('rumsval','room override') + ')' : labels[row.key] ?? row.key}</strong><span>{labelOf(row.before)} → {labelOf(row.after)}</span></li>)}</ul> : <p>{t('Inga ändringar att publicera.','No changes to publish.')}</p>}
        <p><strong>{t('Berörda rum','Affected rooms')}:</strong> {review.affectedRooms.length ? review.affectedRooms.map(roomLabel).join(', ') : t('Inga befintliga rum','No existing rooms')}</p>
      </> : <p>{t('Spara utkastet och granska för att se skillnaden mot den publicerade versionen.','Save the draft and review it to see changes from the published version.')}</p>}
      <div data-appearance-preview="frozen-composition"><PartnerAppearancePreview active={visible} server={server} branding={branding} scope={room?.id ?? ''} operatorSlug={operatorSlug} language={language} onStale={() => {setReview(null);setBlocked(true);setProblem(t('Förhandsvisningens paketversion har ändrats. Din redigering finns kvar. Hämta senaste version och granska på nytt.','The preview package version has changed. Your edits remain here. Fetch the latest version and review again.'));}}/></div>
      <button type="button" className="sg-btn sg-btn-primary" data-action="publish" disabled={!canPublish || busy} onClick={() => command('publish')}>{t('Publicera granskat utkast','Publish reviewed draft')}</button>
    </section>
    <details className={styles.history}><summary>{t('Versionshistorik','Version history')}</summary><p>{t('De 20 senaste publicerade versionerna visas. Återställning skapar ett utkast. Spara egna ändringar först. Live ändras först efter granskning och publicering.','The 20 latest published versions are shown. Restoring creates a draft. Save your own edits first. Live changes only after review and publication.')}</p>
      <ul>{server.history?.map(row => <li key={row.revision}><span><strong>{t('Version','Version')} {row.revision}</strong>{row.revision === server.packageRevision ? ` · ${t('publicerad nu','currently published')}` : ''}{row.publishedAt ? <small>{new Date(row.publishedAt).toLocaleString(en ? 'en-GB' : 'sv-SE')}</small> : null}</span><button type="button" className="sg-btn" data-action={`restore-${row.revision}`} disabled={!editable || busy || dirty} onClick={() => command('restore',row.revision)}>{t('Återställ till utkast','Restore to draft')}</button></li>)}</ul>
    </details>
  </section>;
}
