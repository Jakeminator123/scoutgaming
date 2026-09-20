'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { requestJson } from './studio-types';
import { createSocialPlayback, type SocialPlayback } from '../lib/social-playback.mjs';
import styles from './social-chat-panel.module.css';

export interface SocialPolicy {
  schemaVersion: 1;
  revision: string;
  trigger: { id: 'social.ledsen'; label: string; enabled: boolean; directive: string; threshold: number };
  response: { mode: 'fixed' | 'free'; fixedText: string };
  cooldownMs: number;
}
interface SocialStatus { policy: SocialPolicy; configured: boolean; voiceConfigured: boolean }
export interface SocialDraftCache { status: SocialStatus; draft: SocialPolicy }
interface SocialAudio { audioUrl: string; id: string; text: string; cached: boolean }
interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }
interface SocialReply {
  requestId: string; policyRevision: string; reply: string; triggerId: 'social.ledsen' | null;
  confidence: number; provider: 'responded'; assetId: 'social.ledsen' | 'idle.ready.standard';
  audio?: SocialAudio; voiceError?: string; suppressed?: string; systemNotice?: boolean;
}
interface Props {
  dealerId: string;
  eventId: string;
  onGoToIdle: () => void;
  registerCancel: (cancel: ((reason?: string) => void) | null) => void;
  onBegin: () => void;
  onReaction: (assetId: 'social.ledsen' | 'idle.ready.standard', label: string, exactReply: string) => void;
  draftCache?: RefObject<SocialDraftCache | null>;
  blocked?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onActivity?: (activity: SocialActivity) => void;
}
export interface SocialActivity { type: string; requestId?: string; reason: string; data?: Record<string, unknown> }

const audioPath = /^\/api\/voice\/[a-f0-9]{64}$/;

export function socialHistory(messages: readonly ChatMessage[]) {
  const history = messages.filter((item): item is ChatMessage & { role: 'user' | 'assistant' } => item.role !== 'system' && item.content.trim().length > 0 && item.content.length <= 1000).slice(-12);
  let size = history.reduce((sum, item) => sum + item.content.length, 0);
  while (size > 8000 && history.length) size -= history.shift()!.content.length;
  return history.map(item => ({ role: item.role, content: item.content }));
}

/** Separate social-lab policy and conversation. It never edits the presentation project. */
export function SocialChatPanel({ dealerId, eventId, onGoToIdle, registerCancel, onBegin, onReaction, draftCache, blocked = false, onBusyChange, onActivity }: Props) {
  const [status, setStatus] = useState<SocialStatus | null>(() => draftCache?.current?.status ?? null);
  const [draft, setDraft] = useState<SocialPolicy | null>(() => draftCache?.current?.draft ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [voice, setVoice] = useState(false);
  const [busy, setBusy] = useState<'loading' | 'saving' | 'chat' | 'voice' | 'playback' | null>(() => draftCache?.current ? null : 'loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reply, setReply] = useState<SocialReply | null>(null);
  const [savedAudio, setSavedAudio] = useState<SocialAudio | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const conversation = useRef('');
  const playback = useRef<SocialPlayback | null>(null);
  const owned = useRef(false);
  const activeRequestId = useRef<string | undefined>(undefined);
  const callbacks = useRef({ onBusyChange, onActivity });
  callbacks.current = { onBusyChange, onActivity };
  const gates = useRef({ blocked, allowed: dealerId === 'astrid' && eventId === 'idle.ready' });
  gates.current = { blocked, allowed: dealerId === 'astrid' && eventId === 'idle.ready' };
  const sceneAllowed = dealerId === 'astrid' && eventId === 'idle.ready';
  const dirty = Boolean(draft && status && JSON.stringify(draft) !== JSON.stringify(status.policy));
  useEffect(() => { if (draftCache && draft && status) draftCache.current = { draft, status }; }, [draftCache, draft, status]);
  useEffect(() => {
    function warnOnReload(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', warnOnReload);
    return () => window.removeEventListener('beforeunload', warnOnReload);
  }, [dirty]);

  const cancel = useCallback((reason = 'explicit-stop-or-view-change') => {
    const wasOwned = owned.current;
    generation.current++;
    request.current?.abort(); request.current = null;
    const wasPlaying = playback.current?.active;
    playback.current?.cancel(reason);
    if (wasOwned && !wasPlaying) callbacks.current.onActivity?.({ type: 'social.cancelled', requestId: activeRequestId.current, reason });
    owned.current = false; activeRequestId.current = undefined;
    if (wasOwned) callbacks.current.onBusyChange?.(false);
    setAudioPlaying(false); setBusy(null); setReply(null); setSavedAudio(null);
  }, []);

  useEffect(() => {
    registerCancel(cancel);
    return () => { cancel('social-panel-unmounted'); registerCancel(null); };
  }, [cancel, registerCancel]);
  useEffect(() => { if (!sceneAllowed) cancel('left-astrid-idle'); }, [sceneAllowed, cancel]);
  useEffect(() => {
    function hidden() { if (document.hidden) cancel('page-hidden'); }
    function leaving() { cancel('page-left'); }
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leaving);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving); };
  }, [cancel]);

  async function loadPolicy() {
    cancel();
    const controller = new AbortController(), run = generation.current;
    request.current = controller; setBusy('loading'); setError('');
    try {
      const next = await requestJson<SocialStatus>('/api/social', { signal: controller.signal });
      if (controller.signal.aborted || run !== generation.current) return;
      setStatus(next); setDraft(next.policy);
    } catch (cause) { if (!controller.signal.aborted && run === generation.current) setError(cause instanceof Error ? cause.message : 'Sociala inställningar kunde inte läsas.'); }
    finally { if (run === generation.current) { request.current = null; setBusy(null); } }
  }
  useEffect(() => { if (!draftCache?.current) void loadPolicy(); return cancel; }, []); // Restore this tab's draft; writes remain explicit.

  function editPolicy(edit: (next: SocialPolicy) => void) {
    if (owned.current || blocked) return;
    cancel(); onBegin(); setNotice(''); setError('');
    setDraft(current => { if (!current) return current; const next = structuredClone(current); edit(next); return next; });
  }

  function begin(kind: 'saving' | 'chat' | 'voice') {
    cancel(); onBegin(); setError(''); setNotice('');
    const controller = new AbortController(), run = generation.current;
    request.current = controller; setBusy(kind);
    if (kind === 'chat' || kind === 'voice') { owned.current = true; callbacks.current.onBusyChange?.(true); }
    return { controller, run, current: () => !controller.signal.aborted && run === generation.current };
  }
  function finish(run: number) { if (run === generation.current) { request.current = null; setBusy(null); owned.current = false; activeRequestId.current = undefined; callbacks.current.onBusyChange?.(false); } }

  async function savePolicy() {
    if (!draft || !status || busy || owned.current || blocked) return;
    const submitted = draft, task = begin('saving');
    try {
      const next = await requestJson<{ policy: SocialPolicy }>('/api/social', { method: 'PUT', signal: task.controller.signal, body: JSON.stringify({ policy: submitted, expectedRevision: status.policy.revision }) });
      if (!task.current()) return;
      setStatus(current => current ? { ...current, policy: next.policy } : current); setDraft(next.policy);
      setNotice('Sociala inställningar sparade separat. Ditt eventprojekt är oförändrat.');
    } catch (cause) { if (task.current()) setError(cause instanceof Error ? cause.message : 'Inställningarna kunde inte sparas.'); }
    finally { finish(task.run); }
  }

  async function playAudio(source: SocialAudio) {
    if (!gates.current.allowed || gates.current.blocked || !audioPath.test(source.audioUrl)) { setError('Ljudet får bara spelas som ett lokalt röstprov när Astrid väntar.'); return; }
    const run = generation.current;
    setBusy('playback');
    playback.current ??= createSocialPlayback({
      createAudio: source => new Audio(source),
      onState: state => {
        setAudioPlaying(state === 'playing');
        if (state !== 'idle') callbacks.current.onActivity?.({ type: `social.audio.${state === 'playing' ? 'started' : 'loading'}`, requestId: activeRequestId.current, reason: state === 'playing' ? 'browser-audio-playing' : 'audio-metadata-preflight', data: { maxDurationMs: 6000, displayedAssetId: 'idle.ready.standard', lipsyncVerified: false } });
      },
      onActivity: outcome => callbacks.current.onActivity?.({ type: `social.audio.${outcome.outcome}`, requestId: activeRequestId.current, reason: outcome.reason, data: { ...outcome, maxDurationMs: 6000, lipsyncVerified: false } }),
    });
    const outcome = await playback.current.play(source.audioUrl);
    if (run !== generation.current) return;
    if (outcome.outcome === 'completed') setNotice('Talprovet är klart. Astrid kan ta emot nästa händelse. Ingen läppsynk har verifierats.');
    else if (outcome.reason === 'audio-longer-than-six-seconds') setError('Ljudet är längre än sex sekunder och avvisades. Textsvaret finns kvar; skapa en kortare replik inför nästa prov.');
    else if (outcome.reason === 'speech-six-second-watchdog') setError('Talprovet stoppades vid sexsekundersgränsen. Det är ett avbrutet prov, inte ett godkänt eller läppsynkat klipp.');
    else if (outcome.outcome !== 'cancelled') setError('Ljudprovet kunde inte spelas klart. Ingen automatisk omkörning görs; du kan uttryckligen spela det sparade ljudet igen.');
  }

  async function send() {
    if (!sceneAllowed || blocked || !status?.configured || !draft || dirty || busy || owned.current || !message.trim()) return;
    const content = message.trim(), history = socialHistory(messages), policy = status.policy;
    const requestId = crypto.randomUUID();
    if (!conversation.current) conversation.current = `lab-social-${crypto.randomUUID()}`;
    const task = begin('chat');
    activeRequestId.current = requestId;
    callbacks.current.onActivity?.({ type: 'social.requested', requestId, reason: 'explicit-player-chat', data: { message: content, voiceRequested: voice, scene: { dealerId, eventId }, policyRevision: policy.revision } });
    setMessages(current => [...current, { role: 'user', content }]); setMessage('');
    try {
      const next = await requestJson<SocialReply>('/api/social/chat', { method: 'POST', signal: task.controller.signal, body: JSON.stringify({ requestId, conversationId: conversation.current, message: content, history, policyRevision: policy.revision, scene: { dealerId: 'astrid', eventId: 'idle.ready' }, voice }) });
      if (!task.current()) return;
      if (next.requestId !== requestId || next.policyRevision !== policy.revision || next.provider !== 'responded' || !['social.ledsen', 'idle.ready.standard'].includes(next.assetId)) throw new Error('Svaret matchar inte det aktuella sociala testet och spelades inte upp.');
      if (next.systemNotice === true) {
        setMessages(current => [...current, { role: 'system', content: 'Triggern vilar en kort stund. Prova igen när den sparade pausen har löpt ut.' }]);
        setNotice('Servern höll tillbaka reaktionen under pausen. Inget ljud eller extra rörelse spelades.');
        callbacks.current.onActivity?.({ type: 'social.suppressed', requestId, reason: next.suppressed ?? 'cooldown', data: { decisionOwner: 'local-social-policy' } });
        return;
      }
      setReply(next); setMessages(current => [...current, { role: 'assistant', content: next.reply }]);
      onReaction(next.assetId, next.triggerId ? policy.trigger.label : 'Neutralt vänteläge', next.reply);
      callbacks.current.onActivity?.({ type: 'social.responded', requestId, reason: next.triggerId ? 'validated-social-trigger' : 'neutral-idle-response', data: { reply: next.reply, suggestedAssetId: next.assetId, displayedAssetId: 'idle.ready.standard', confidence: next.confidence, decisionOwner: 'OpenClaw + local-social-policy', textOwner: next.triggerId && policy.response.mode === 'fixed' ? 'saved-social-policy' : 'OpenClaw', output: voice && next.audio ? 'text-and-optional-idle-speech' : 'text', lipsyncVerified: false } });
      if (next.audio && voice) {
        if (next.audio.text !== next.reply) throw new Error('Ljudets text matchar inte svaret. Ljudet spelades inte upp.');
        setSavedAudio(next.audio); await playAudio(next.audio);
      }
      if (task.current() && next.voiceError) setError(`Textsvaret kom fram, men talet saknas: ${next.voiceError}`);
    } catch (cause) { if (task.current()) { setError(cause instanceof Error ? cause.message : 'Astrid kunde inte svara.'); callbacks.current.onActivity?.({ type: 'social.failed', requestId, reason: cause instanceof Error ? cause.message : 'social-request-failed' }); } }
    finally { finish(task.run); }
  }

  async function createFixedAudio() {
    if (!sceneAllowed || blocked || !status?.voiceConfigured || !draft || dirty || busy || owned.current || draft.response.mode !== 'fixed') return;
    const policy = status.policy, task = begin('voice');
    try {
      const next = await requestJson<SocialAudio>('/api/social/voice', { method: 'POST', signal: task.controller.signal, body: JSON.stringify({ policyRevision: policy.revision }) });
      if (!task.current()) return;
      if (next.text !== policy.response.fixedText || !audioPath.test(next.audioUrl)) throw new Error('Ljudet matchar inte den sparade standardfrasen.');
      setSavedAudio(next); setNotice(next.cached ? 'Standardfrasens ljud finns redan sparat och återanvänds.' : 'Standardfrasens ljud är sparat lokalt. Tryck på Spela sparat ljud.');
    } catch (cause) { if (task.current()) setError(cause instanceof Error ? cause.message : 'Standardfrasens ljud kunde inte skapas.'); }
    finally { finish(task.run); }
  }

  async function replay() {
    if (!savedAudio || !sceneAllowed || blocked || dirty || busy || owned.current) return;
    const source = savedAudio, originalReply = reply, reactionId = originalReply?.assetId ?? 'social.ledsen';
    // Stop playback without losing the model's original neutral/expression choice.
    cancel(); onBegin(); setReply(originalReply); setSavedAudio(source);
    const run = generation.current;
    owned.current = true; callbacks.current.onBusyChange?.(true);
    callbacks.current.onActivity?.({ type: 'social.replay.requested', reason: 'explicit-manual-replay', data: { audioId: source.id, text: source.text, generated: false } });
    onReaction(reactionId, reactionId === 'social.ledsen' ? draft?.trigger.label ?? 'Ledsen' : 'Neutralt vänteläge', source.text);
    try { await playAudio(source); } finally { finish(run); }
  }

  return <section className={styles.panel} aria-labelledby="social-chat-heading">
    <div className={styles.heading}><div><span className="eyebrow">SPELARCHATT</span><h2 id="social-chat-heading">Chatta med Astrid</h2></div><span className={styles.badge}>Astrids vänteläge</span></div>
    <p>Ett meddelande ger ett textsvar och, om du väljer det, ett talprov. Astrid svarar bara i vänteläget. Talet får ta högst sex sekunder; kortdelning och andra handlingsprov väntar under hela svaret.</p>
    <div className={styles.ownership} role="status"><strong>{busy === 'chat' ? 'Socialt svar reserverat · inväntar OpenClaw' : busy === 'playback' ? audioPlaying ? 'Socialt tal äger scenen · högst 6 s' : 'Socialt tal reserverat · kontrollerar ljudet' : blocked ? 'Scenen används av ett annat prov' : 'Vänteläget kan ta emot ett socialt prov'}</strong><span>En ägare åt gången. Blinkningar avbryter inte svaret. Läppsynk är ännu inte ansluten.</span>{busy === 'chat' || busy === 'playback' || busy === 'voice' ? <button className="text-button" type="button" onClick={() => cancel('user-stop')}>Stoppa socialt prov</button> : null}</div>
    {!sceneAllowed ? <div className={styles.sceneGate}><strong>Chatten provas bara när Astrid väntar.</strong><p>Välj vänteläget för att inte lägga en social rörelse ovanpå kortdelning eller en annan croupier.</p><button className="primary-button" type="button" onClick={onGoToIdle}>Gå till Astrids vänteläge →</button></div> : null}
    {!draft || !status ? <div className={styles.loading}><p>{busy === 'loading' ? 'Läser sociala inställningar…' : 'Sociala inställningar är inte inlästa.'}</p>{!busy ? <button className="text-button" type="button" onClick={() => void loadPolicy()}>Läs inställningarna igen</button> : null}</div> : <>
      <div className={messages.length || busy === 'chat' ? styles.chat : styles.chatEmpty} aria-live="polite">{messages.length ? messages.map((item, index) => <div key={index} className={item.role === 'user' ? styles.playerMessage : item.role === 'system' ? styles.systemMessage : styles.astridMessage}><span>{item.role === 'user' ? 'DU / LABBSPELARE' : item.role === 'system' ? 'SYSTEM / PAUS' : 'ASTRID'}</span><p>{item.content}</p></div>) : <p className={styles.empty}>Ingen konversation ännu. Börja med ett meddelande nedan.</p>}{busy === 'chat' ? <p className={styles.pending}>Astrid funderar…</p> : null}</div>
      <form onSubmit={event => { event.preventDefault(); void send(); }}>
        <label className={styles.field}>Meddelande till Astrid<textarea rows={2} maxLength={1000} value={message} disabled={!sceneAllowed || blocked || !status.configured || Boolean(busy)} placeholder="Skriv som en spelare vid bordet…" onChange={event => { if (!owned.current) setMessage(event.target.value); }} /></label>
        <label className={styles.check}><input type="checkbox" checked={voice} disabled={blocked || !status.voiceConfigured || Boolean(busy)} onChange={event => { if (owned.current || blocked) return; cancel(); onBegin(); setVoice(event.target.checked); }} /><span>Läs upp svaret<small>{!status.voiceConfigured ? 'Tal är inte konfigurerat.' : 'Valfritt · nytt tal kan kosta ElevenLabs-krediter.'}</small></span></label>
        <div className={styles.actions}><span>{!status.configured ? 'OpenClaw är inte konfigurerat.' : dirty ? 'Spara dina sociala inställningar före testet.' : 'Modellanrop sker bara när du skickar.'}</span><button className="primary-button" type="submit" disabled={!sceneAllowed || blocked || !status.configured || dirty || Boolean(busy) || !message.trim()}> {busy === 'chat' ? 'Väntar…' : 'Skicka till Astrid ↑'}</button></div>
      </form>
      {reply ? <div className={styles.decision}><strong>{reply.triggerId ? `${status.policy.trigger.label} föreslogs` : 'Ingen social reaktion valdes'}</strong><span>Modellens bedömning: {Math.round(reply.confidence * 100)} %. {reply.suppressed ? `Servern begränsade reaktionen: ${reply.suppressed}.` : ''} Scenen behåller vänteläget: ingen hand- eller kroppsrörelse läggs ovanpå talet.</span><code>Förslag: {reply.assetId} · Visas: idle.ready.standard</code></div> : null}
      <details className={styles.settings}>
        <summary>Reaktion och svar <span>{dirty ? 'Osparat utkast' : 'Sparad policy'}</span></summary>
        {dirty ? <p className={styles.draftWarning}>Osparat socialt utkast. Det bevaras när du byter sida i studion, men försvinner om du laddar om eller stänger fliken. Spara sociala inställningar när du är nöjd.</p> : null}
        <p>Bestäm när ett socialt uttryck föreslås och hur Astrid svarar. Förslaget loggas; under svaret stannar hon i vänteläget. Sparas separat från eventprojektet.</p>
        <fieldset disabled={blocked || Boolean(busy)}>
          <label className={styles.check}><input type="checkbox" checked={draft.trigger.enabled} onChange={event => editPolicy(next => { next.trigger.enabled = event.target.checked; })} />Aktivera reaktionen</label>
          <label className={styles.field}>Reaktionens namn<input value={draft.trigger.label} maxLength={80} onChange={event => editPolicy(next => { next.trigger.label = event.target.value; })} /></label>
          <label className={styles.field}>När ska Astrid reagera?<textarea rows={3} value={draft.trigger.directive} maxLength={1000} onChange={event => editPolicy(next => { next.trigger.directive = event.target.value; })} /></label>
          <div className={styles.twocol}><label className={styles.field}>Tröskel för modellens bedömning<input type="number" min={0} max={1} step={0.05} value={draft.trigger.threshold} onChange={event => editPolicy(next => { next.trigger.threshold = Number(event.target.value); })} /><small>0–1. En modellbedömning, inte en mätning av spelarens känslor.</small></label><label className={styles.field}>Paus mellan reaktioner (ms)<input type="number" min={0} max={300000} step={500} value={draft.cooldownMs} onChange={event => editPolicy(next => { next.cooldownMs = Number(event.target.value); })} /></label></div>
          <label className={styles.field}>Svarssätt<select value={draft.response.mode} onChange={event => editPolicy(next => { next.response.mode = event.target.value as 'fixed' | 'free'; })}><option value="fixed">Fast standardfras vid trigger</option><option value="free">Fritt modellsvar</option></select></label>
          <label className={styles.field}>Sparad standardfras<textarea rows={2} value={draft.response.fixedText} maxLength={500} onChange={event => editPolicy(next => { next.response.fixedText = event.target.value; })} /><small>{draft.response.mode === 'free' ? 'Frasen behålls men används inte som fast svar i det här läget.' : 'Spara texten innan du skapar dess ljud.'}</small></label>
        </fieldset>
        <div className={styles.actions}><code>social.ledsen · {status.policy.revision.slice(0, 12)}</code><button className="primary-button" type="button" disabled={blocked || !dirty || Boolean(busy)} onClick={() => void savePolicy()}>{busy === 'saving' ? 'Sparar…' : 'Spara sociala inställningar'}</button></div><button className="text-button" type="button" disabled={blocked || Boolean(busy)} onClick={() => { if (!dirty || window.confirm('Läs in den sparade sociala policyn och kasta detta sociala utkast?')) void loadPolicy(); }}>Läs om sparad social policy</button>
      </details>
      <details className={styles.audioTools}><summary>Standardfrasens ljud <span>Valfritt</span></summary><div><p>Skriv en kort standardfras avsedd att sägas inom sex sekunder. Skapa dess ljud utan att skicka ett chattmeddelande. Samma text och röst återanvänder ljudet. Nytt ljud kan kosta krediter; ingen video eller läppsynk skapas. Ljud som visar längre speltid än sex sekunder avvisas före start; en tidsvakt stoppar även felaktig eller okänd speltid.</p></div><button className="text-button" type="button" onClick={() => void createFixedAudio()} disabled={!sceneAllowed || blocked || !status.voiceConfigured || dirty || Boolean(busy) || draft.response.mode !== 'fixed'}>{busy === 'voice' ? 'Skapar ljud…' : 'Skapa / spara standardfrasens ljud'}</button>{!status.voiceConfigured ? <p>ElevenLabs behöver konfigureras lokalt för tal.</p> : null}{draft.response.mode !== 'fixed' ? <p>Välj fast standardfras under Reaktion och svar för att skapa detta ljud.</p> : null}</details>{savedAudio ? <div className={styles.savedAudio}><p>Exakt ljudtext: ”{savedAudio.text}”</p><button className="primary-button" type="button" disabled={!sceneAllowed || blocked || dirty || Boolean(busy)} onClick={() => void replay()}>▶ Spela sparat ljud igen (manuellt)</button>{audioPlaying ? <button className="text-button" type="button" onClick={() => cancel('user-stop')}>Stoppa ljud</button> : null}</div> : null}
    </>}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}{error ? <p className="inline-error" role="alert">{error}</p> : null}
    <details className={styles.about}><summary>Om chatten och kostnader</summary><p>Detta är en separat social labbpolicy, inte ett spel-event. Kort, saldo och resultat ändras inte. Chatten är skild från operatörschatten och IDE-inboxen, och har inget bestående spelarminne.</p><p>Modellanrop sker när du skickar. Tal är valfritt och kan förbruka ElevenLabs-krediter; avbrytning garanterar inte att leverantörens kostnad avbryts. Historiken finns bara medan chattpanelen är öppen.</p></details>
  </section>;
}
