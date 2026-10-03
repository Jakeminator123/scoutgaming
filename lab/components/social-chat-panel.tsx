'use client';
import { labUrl } from "../lib/lab-url.mjs";

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { requestJson } from './studio-types';
import { createSocialPlayback, SOCIAL_SPEECH_LIMIT_MS, type SocialPlayback } from '../lib/social-playback.mjs';
import { playGeneratedSpeech } from '../../web/public/generated-speech-player.mjs';
import styles from './social-chat-panel.module.css';

export interface SocialPolicy {
  schemaVersion: 1;
  revision: string;
  trigger: { id: 'social.ledsen'; label: string; enabled: boolean; directive: string; threshold: number };
  response: { mode: 'fixed' | 'free'; fixedText: string };
  cooldownMs: number;
}
interface SocialStatus { policy: SocialPolicy; configured: boolean; voiceConfigured: boolean; generatedSpeech?: { configured: boolean }; companionEnabled?: boolean }
interface CompanionProfile { name: string | null; greeting: string; names: string[]; history: ChatMessage[]; retentionDays: number }
export interface SocialDraftCache { status: SocialStatus; draft: SocialPolicy }
interface SocialAudio { audioUrl: string; id: string; text: string; cached: boolean }
interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }
interface SocialReply {
  requestId: string; policyRevision: string; reply: string; triggerId: 'social.ledsen' | null;
  confidence: number; provider: 'responded'; assetId: 'social.ledsen' | 'idle.ready.standard';
  audio?: SocialAudio; voiceError?: string; suppressed?: string; systemNotice?: boolean;
  speechPackage?: unknown;
  companion?: { profile: CompanionProfile; comedy: boolean; search: { status: string; results: { title: string; url: string; snippet: string }[] } };
}
interface Props {
  compact?: boolean;
  dealerId: string;
  eventId: string;
  onGoToIdle: () => void;
  registerCancel: (cancel: ((reason?: string) => void) | null) => void;
  onBegin: () => void;
  onReaction: (assetId: 'social.ledsen' | 'idle.ready.standard', label: string, exactReply: string) => void;
  draftCache?: RefObject<SocialDraftCache | null>;
  speechHost?: RefObject<HTMLDivElement | null>;
  blocked?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onActivity?: (activity: SocialActivity) => void;
}
export interface SocialActivity { type: string; requestId?: string; reason: string; data?: Record<string, unknown> }

const audioPath = /^\/api\/voice\/[a-f0-9]{64}$/;
// The shared browser module is plain JS. Keep the consumer contract explicit;
// that player validates exact text, dealer, URLs, hashes and durations at runtime.
const playGeneratedPreview = playGeneratedSpeech as (value: unknown, options: {
  exactText: string; dealerId: string; mount: HTMLDivElement; signal: AbortSignal;
  onStart: () => void;
  onReceipt: (receipt?: { state: string; packageId?: string; evidence?: string; reviewStatus?: string }) => void;
}) => Promise<void>;

function nextRenderedFrame(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Speech preview cancelled')); return; }
    let frame: number;
    const abort = () => { window.cancelAnimationFrame(frame); signal.removeEventListener('abort', abort); reject(new Error('Speech preview cancelled')); };
    signal.addEventListener('abort', abort, { once: true });
    frame = window.requestAnimationFrame(() => { signal.removeEventListener('abort', abort); resolve(); });
  });
}

export function socialHistory(messages: readonly ChatMessage[]) {
  const history = messages.filter((item): item is ChatMessage & { role: 'user' | 'assistant' } => item.role !== 'system' && item.content.trim().length > 0 && item.content.length <= 1000).slice(-12);
  let size = history.reduce((sum, item) => sum + item.content.length, 0);
  while (size > 8000 && history.length) size -= history.shift()!.content.length;
  return history.map(item => ({ role: item.role, content: item.content }));
}

/** Separate social-lab policy and conversation. It never edits the presentation project. */
export function SocialChatPanel({ compact = false, dealerId, eventId, onGoToIdle, registerCancel, onBegin, onReaction, draftCache, speechHost, blocked = false, onBusyChange, onActivity }: Props) {
  const [status, setStatus] = useState<SocialStatus | null>(() => draftCache?.current?.status ?? null);
  const [draft, setDraft] = useState<SocialPolicy | null>(() => draftCache?.current?.draft ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [voice, setVoice] = useState(true);
  const [busy, setBusy] = useState<'loading' | 'saving' | 'chat' | 'voice' | 'playback' | null>(() => draftCache?.current ? null : 'loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reply, setReply] = useState<SocialReply | null>(null);
  const [savedAudio, setSavedAudio] = useState<SocialAudio | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [profile, setProfile] = useState<CompanionProfile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [fun, setFun] = useState(true);
  const [web, setWeb] = useState(true);
  const [expanded, setExpanded] = useState(!compact || dealerId === 'astrid' && eventId === 'idle.ready');
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
  const generatedSpeechConfigured = status?.generatedSpeech?.configured === true;
  const voiceAvailable = Boolean(status?.voiceConfigured || generatedSpeechConfigured);
  useEffect(() => { setExpanded(!compact || sceneAllowed); }, [compact, sceneAllowed]);
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
  useEffect(() => { if (blocked && owned.current) cancel('speech-owner-busy'); }, [blocked, cancel]);
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
      const policy = await requestJson<SocialStatus>('/api/social', { signal: controller.signal });
      const next = typeof policy.configured === 'boolean' ? policy
        : {...policy,...await requestJson<Omit<SocialStatus,'policy'>>('/api/social/status',{signal:controller.signal})};
      if (controller.signal.aborted || run !== generation.current) return;
      setStatus(next); setDraft(next.policy);
    } catch (cause) { if (!controller.signal.aborted && run === generation.current) setError(cause instanceof Error ? cause.message : 'Sociala inställningar kunde inte läsas.'); }
    finally { if (run === generation.current) { request.current = null; setBusy(null); } }
  }
  useEffect(() => { if (!draftCache?.current) void loadPolicy(); return cancel; }, []); // Restore this tab's draft; writes remain explicit.
  useEffect(() => {
    if (!status?.companionEnabled || !status.configured) return;
    const controller = new AbortController();
    requestJson<CompanionProfile>('/api/social/profile', { signal: controller.signal }).then(next => {
      if (controller.signal.aborted) return;
      setProfile(next); setMessages([...next.history, { role: 'system', content: next.greeting }]); setProfileError('');
    }).catch(cause => { if (!controller.signal.aborted) setProfileError(cause instanceof Error ? cause.message : 'Minnet kunde inte läsas.'); });
    return () => controller.abort();
  }, [status?.companionEnabled, status?.configured]);

  async function updateProfile(operation: 'name' | 'forget', name?: string) {
    if (busy || blocked || owned.current) return;
    const task = begin('saving');
    try {
      const next = await requestJson<CompanionProfile>('/api/social/profile', { method: 'POST', signal: task.controller.signal, body: JSON.stringify({ operation, ...(name ? { name } : {}) }) });
      if (!task.current()) return;
      conversation.current = ''; setProfile(next); setProfileError('');
      setMessages([...next.history, { role: 'system', content: next.greeting }]);
      setNotice(operation === 'forget' ? 'Namn och sparat samtalsminne har raderats. Välj vem som kom in.' : `Tjena ${next.name}!`);
    } catch (cause) { if (task.current()) setProfileError(cause instanceof Error ? cause.message : 'Profilen kunde inte sparas.'); }
    finally { finish(task.run); }
  }

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
      createAudio: source => new Audio(labUrl(source)),
      onState: state => {
        setAudioPlaying(state === 'playing');
        if (state !== 'idle') callbacks.current.onActivity?.({ type: `social.audio.${state === 'playing' ? 'started' : 'loading'}`, requestId: activeRequestId.current, reason: state === 'playing' ? 'browser-audio-playing' : 'audio-metadata-preflight', data: { maxDurationMs: SOCIAL_SPEECH_LIMIT_MS, displayedAssetId: 'idle.ready.standard', lipsyncVerified: false } });
      },
      onActivity: outcome => callbacks.current.onActivity?.({ type: `social.audio.${outcome.outcome}`, requestId: activeRequestId.current, reason: outcome.reason, data: { ...outcome, maxDurationMs: SOCIAL_SPEECH_LIMIT_MS, lipsyncVerified: false } }),
    });
    const outcome = await playback.current.play(source.audioUrl);
    if (run !== generation.current) return;
    if (outcome.outcome === 'completed') setNotice('Talprovet är klart. Astrid kan ta emot nästa händelse. Ingen läppsynk har verifierats.');
    else if (outcome.reason === 'audio-longer-than-25-seconds') setError('Ljudet är längre än 25 sekunder och avvisades. Textsvaret finns kvar; skapa en kortare replik inför nästa prov.');
    else if (outcome.reason === 'speech-25-second-watchdog') setError('Talprovet stoppades vid 25-sekundersgränsen. Det är ett avbrutet prov, inte ett godkänt eller läppsynkat klipp.');
    else if (outcome.outcome !== 'cancelled') setError('Ljudprovet kunde inte spelas klart. Ingen automatisk omkörning görs; du kan uttryckligen spela det sparade ljudet igen.');
  }

  async function send() {
    if (!sceneAllowed || blocked || !status?.configured || !draft || dirty || busy || owned.current || !message.trim() || status.companionEnabled && !profile?.name) return;
    const content = message.trim(), history = socialHistory(messages), policy = status.policy;
    const wantsVoice = voice && voiceAvailable;
    const requestId = crypto.randomUUID();
    if (!conversation.current) conversation.current = `lab-social-${crypto.randomUUID()}`;
    const task = begin('chat');
    activeRequestId.current = requestId;
    callbacks.current.onActivity?.({ type: 'social.requested', requestId, reason: 'explicit-player-chat', data: { message: content, voiceRequested: wantsVoice, scene: { dealerId, eventId }, policyRevision: policy.revision } });
    setMessages(current => [...current, { role: 'user', content }]); setMessage('');
    try {
      const next = await requestJson<SocialReply>('/api/social/chat', { method: 'POST', signal: task.controller.signal, body: JSON.stringify({ requestId, conversationId: conversation.current, message: content, history, policyRevision: policy.revision, scene: { dealerId: 'astrid', eventId: 'idle.ready' }, voice: wantsVoice, ...(status.companionEnabled ? { companion: { fun, web } } : {}) }) });
      if (!task.current()) return;
      if (next.requestId !== requestId || next.policyRevision !== policy.revision || next.provider !== 'responded' || !['social.ledsen', 'idle.ready.standard'].includes(next.assetId)) throw new Error('Svaret matchar inte det aktuella sociala testet och spelades inte upp.');
      if (next.systemNotice === true) {
        setMessages(current => [...current, { role: 'system', content: 'Triggern vilar en kort stund. Prova igen när den sparade pausen har löpt ut.' }]);
        setNotice('Servern höll tillbaka reaktionen under pausen. Inget ljud eller extra rörelse spelades.');
        callbacks.current.onActivity?.({ type: 'social.suppressed', requestId, reason: next.suppressed ?? 'cooldown', data: { decisionOwner: 'local-social-policy' } });
        return;
      }
      setReply(next); setMessages(current => [...current, { role: 'assistant', content: next.reply }]);
      if (next.companion) setProfile(next.companion.profile);
      onReaction(next.assetId, next.triggerId ? policy.trigger.label : 'Neutralt vänteläge', next.reply);
      callbacks.current.onActivity?.({ type: 'social.responded', requestId, reason: next.triggerId ? 'validated-social-trigger' : 'neutral-idle-response', data: { reply: next.reply, suggestedAssetId: next.assetId, displayedAssetId: 'idle.ready.standard', confidence: next.confidence, expressionSuppressed: next.suppressed ?? null, decisionOwner: 'OpenClaw + local-social-policy', textOwner: next.triggerId && policy.response.mode === 'fixed' ? 'saved-social-policy' : 'OpenClaw', output: wantsVoice && next.speechPackage ? 'text-and-generated-lipsync-preview' : wantsVoice && next.audio ? 'text-and-optional-idle-speech' : 'text', lipsyncVerified: false } });
      if (next.speechPackage && wantsVoice) {
        if (!generatedSpeechConfigured) throw new Error('Genererat talpaket kom utan aktiverad läppsynksförhandsvisning och spelades inte.');
        setBusy('playback');
        // onReaction renders the neutral scene and this host. Wait for that
        // frame, then recheck ownership so a late reply cannot start playback.
        await nextRenderedFrame(task.controller.signal);
        if (!task.current()) return;
        if (!gates.current.allowed || gates.current.blocked || !speechHost?.current) throw new Error('Läppsynksprovet får bara starta i Astrids vänteläge med en monterad scen.');
        await playGeneratedPreview(next.speechPackage, {
          exactText: next.reply, dealerId, mount: speechHost.current, signal: task.controller.signal,
          onStart: () => { if (task.current()) setAudioPlaying(true); },
          onReceipt: (receipt?: { state: string; packageId?: string; evidence?: string; reviewStatus?: string }) => {
            if (!receipt) return;
            const phase = receipt.state === 'start' ? 'started' : receipt.state === 'end' ? 'completed' : 'cancelled';
            if (task.current() && phase !== 'started') setAudioPlaying(false);
            callbacks.current.onActivity?.({ type: `social.audio.${phase}`, requestId, reason: `generated-speech-${receipt.state}`, data: { ...receipt, medium: 'audio-and-video', displayedAssetId: 'generated-lipsync-preview', maxDurationMs: SOCIAL_SPEECH_LIMIT_MS, lipsyncVerified: false } });
          },
        });
        if (task.current()) setNotice('Läppsynksprovet är klart. Genererad video och exakt röst spelades tillsammans; visuell granskning återstår.');
      } else if (next.audio && wantsVoice) {
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

  return <section className={`${styles.panel} ${compact ? styles.compact : ''}`} aria-labelledby="social-chat-heading">
    {busy === 'chat' || busy === 'playback' || busy === 'voice' || blocked ? <div className={styles.liveStatus} role="status"><span>{busy === 'chat' ? 'Astrid funderar…' : busy === 'playback' ? audioPlaying ? 'Astrid talar…' : 'Förbereder ljud…' : busy === 'voice' ? 'Skapar ljud…' : 'Scenen används av ett annat prov'}</span>{busy === 'chat' || busy === 'playback' || busy === 'voice' ? <button className="text-button" type="button" onClick={() => cancel('user-stop')}>Stoppa</button> : null}</div> : null}
    <details className={styles.chatDisclosure} open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className={styles.heading}><div><h2 id="social-chat-heading">Fristående chattprov med Astrid</h2><small>Separat chattprov · inga kort eller spelare från originalbordet · {sceneAllowed ? 'Astrid väntar' : 'öppna i Astrids vänteläge'}</small></div><span className={styles.replyMode}>{dirty ? 'Osparad policy' : draft?.response.mode === 'fixed' ? 'Standardfras vid uttryck' : 'Fritt svar'}</span></summary>
    {!sceneAllowed ? <div className={styles.sceneGate}><button className="text-button" type="button" onClick={onGoToIdle}>Gå till Astrids vänteläge för att chatta →</button></div> : null}
    {!draft || !status ? <div className={styles.loading}><p>{busy === 'loading' ? 'Ansluter chatten…' : 'Chattinställningarna kunde inte läsas.'}</p>{!busy ? <button className="text-button" type="button" onClick={() => void loadPolicy()}>Försök igen</button> : null}</div> : <>
      {status.companionEnabled ? <div className={styles.visitor}>
        <strong>{profile?.name ? `Du är ${profile.name}` : 'Tjena! Vem kom in?'}</strong>
        {!profile?.name ? <div className={styles.names}>{['Jakob', 'Emil', 'Kevin', 'Alex', 'John'].map(name => <button type="button" key={name} disabled={Boolean(busy) || blocked || !profile} onClick={() => void updateProfile('name', name)}>{name}</button>)}</div> : <button type="button" className="text-button" disabled={Boolean(busy) || blocked} onClick={() => void updateProfile('forget')}>Glöm mig / byt person</button>}
        <small>Samma labbprofil känns igen i denna webbläsare. De senaste 12 inläggen sparas i upp till 30 dagar. Namnvalet är ett smeknamn, inte en Partner-inloggning.</small>
        {profileError ? <p role="alert">{profileError}</p> : !profile ? <small>Ansluter minnet…</small> : null}
      </div> : null}
      {messages.length ? <div className={styles.chat} aria-live="polite">{messages.map((item, index) => <div key={index} className={item.role === 'user' ? styles.playerMessage : item.role === 'system' ? styles.systemMessage : styles.astridMessage}><span>{item.role === 'user' ? 'DU' : item.role === 'system' ? 'SYSTEM' : 'ASTRID'}</span><p>{item.content}</p></div>)}</div> : null}
      <form onSubmit={event => { event.preventDefault(); void send(); }}>
        <label className={styles.field}><span className="sr-only">Meddelande till Astrid</span><textarea rows={2} maxLength={1000} value={message} disabled={!sceneAllowed || blocked || !status.configured || Boolean(busy)} placeholder="Skriv som en spelare vid bordet…" onChange={event => { if (!owned.current) setMessage(event.target.value); }} /></label>
        <label className={styles.check}><input aria-label="Ljud från Cartesia" type="checkbox" checked={voice} disabled={blocked || !voiceAvailable || Boolean(busy)} onChange={event => { if (owned.current || blocked) return; cancel(); onBegin(); setVoice(event.target.checked); }} /><span>{generatedSpeechConfigured ? 'Tal + läppsynk' : 'Ljud'} <small>{generatedSpeechConfigured ? 'Victoria + läppsynk · labbprov, ej visuellt godkänt · använder krediter' : status.voiceConfigured ? 'Victoria · använder krediter' : 'Cartesia ej anslutet'}</small></span></label>
        {status.companionEnabled ? <div className={styles.options}>
          <label><input type="checkbox" checked={fun} disabled={Boolean(busy) || blocked} onChange={e => setFun(e.target.checked)} /> Skämtläge</label>
          <label><input type="checkbox" checked={web} disabled={Boolean(busy) || blocked} onChange={e => setWeb(e.target.checked)} /> Tillåt webbsökning</label>
          <small>Prova: Berätta om Emil. Egna rim på svenska, tyska och kinesiska. Tal upp till 25 sekunder. Webbsökning via OpenAI: budget högst cirka 5 kr/timme, max 10 försök. Vanlig chatt och ljud tillkommer.</small>
        </div> : null}
        <div className={styles.actions}><button className="primary-button" type="submit" disabled={!sceneAllowed || blocked || !status.configured || dirty || Boolean(busy) || !message.trim() || Boolean(status.companionEnabled && !profile?.name)}>{busy === 'chat' ? 'Väntar…' : 'Skicka till Astrid ↑'}</button></div>
      </form>
      {reply?.companion?.search && reply.companion.search.status !== 'not_requested' ? <div className={styles.sources}><small>{reply.companion.search.status === 'searched' ? 'Källor från webbsökningen' : reply.companion.search.status === 'hourly_limit' ? 'Timgränsen är nådd. Ingen ny sökning gjordes.' : 'Webbsökningen kunde inte hämta resultat.'}</small>{reply.companion.search.results.filter(source => /^https?:\/\//.test(source.url)).map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div> : null}
      {!status.configured ? <p className={styles.draftWarning}>OpenClaw är inte konfigurerat.</p> : dirty ? <p className={styles.draftWarning}>Spara ändringarna under Inställningar för att chatta.</p> : null}
      <details className={styles.tools}><summary>Inställningar för chattprovet{dirty ? ' · osparat' : ''}</summary>
        <p className={styles.explanation}>Text och uttryck är två separata val. Fritt svar är normalläget. Standardfras används bara om du väljer det och uttryckets villkor matchar.</p>
        {reply ? <div className={styles.decision}><strong>{reply.triggerId ? `${status.policy.trigger.label} föreslogs` : 'Ingen social reaktion valdes'}</strong><span>{reply.suppressed ? `Uttrycket begränsades: ${reply.suppressed}. ` : ''}Scenen behåller vänteläget under talet. Kön för ett efterföljande uttrycksklipp är ännu inte ansluten.</span><code>Förslag: {reply.assetId} · Visas: idle.ready.standard</code></div> : null}
        <details className={styles.settings}>
        <summary>Uttryck och svar <span>{dirty ? 'Osparat utkast' : 'Sparad policy'}</span></summary>
        {dirty ? <p className={styles.draftWarning}>Osparat socialt utkast. Det bevaras när du byter sida i studion, men försvinner om du laddar om eller stänger fliken. Spara sociala inställningar när du är nöjd.</p> : null}
        <p>Bestäm när ett socialt uttryck föreslås och hur Astrid svarar. Förslaget loggas; under svaret stannar hon i vänteläget. Sparas separat från eventprojektet.</p>
        <fieldset disabled={blocked || Boolean(busy)}>
          <label className={styles.check}><input type="checkbox" checked={draft.trigger.enabled} onChange={event => editPolicy(next => { next.trigger.enabled = event.target.checked; })} />Aktivera reaktionen</label>
          <label className={styles.field}>Reaktionens namn<input value={draft.trigger.label} maxLength={80} onChange={event => editPolicy(next => { next.trigger.label = event.target.value; })} /></label>
          <label className={styles.field}>När ska Astrid reagera?<textarea rows={3} value={draft.trigger.directive} maxLength={1000} onChange={event => editPolicy(next => { next.trigger.directive = event.target.value; })} /></label>
          <div className={styles.twocol}><label className={styles.field}>Tröskel för modellens bedömning<input type="number" min={0} max={1} step={0.05} value={draft.trigger.threshold} onChange={event => editPolicy(next => { next.trigger.threshold = Number(event.target.value); })} /><small>0–1. En modellbedömning, inte en mätning av spelarens känslor.</small></label><label className={styles.field}>Paus mellan reaktioner (ms)<input type="number" min={0} max={300000} step={500} value={draft.cooldownMs} onChange={event => editPolicy(next => { next.cooldownMs = Number(event.target.value); })} /></label></div>
          <label className={styles.field}>Textsvaret<select value={draft.response.mode} onChange={event => editPolicy(next => { next.response.mode = event.target.value as 'fixed' | 'free'; })}><option value="free">Fritt svar · OpenClaw formulerar</option><option value="fixed">Standardfras när uttrycket triggas</option></select></label>
          <label className={styles.field}>Sparad standardfras<textarea rows={2} value={draft.response.fixedText} maxLength={500} onChange={event => editPolicy(next => { next.response.fixedText = event.target.value; })} /><small>{draft.response.mode === 'free' ? 'Frasen behålls men används inte som fast svar i det här läget.' : 'Spara texten innan du skapar dess ljud.'}</small></label>
        </fieldset>
        <div className={styles.actions}><code>social.ledsen · {status.policy.revision.slice(0, 12)}</code><button className="primary-button" type="button" disabled={blocked || !dirty || Boolean(busy)} onClick={() => void savePolicy()}>{busy === 'saving' ? 'Sparar…' : 'Spara sociala inställningar'}</button></div><button className="text-button" type="button" disabled={blocked || Boolean(busy)} onClick={() => { if (!dirty || window.confirm('Läs in den sparade sociala policyn och kasta detta sociala utkast?')) void loadPolicy(); }}>Läs om sparad social policy</button>
      </details>
      <details className={styles.audioTools}><summary>Standardfrasens ljud <span>Valfritt</span></summary><div><p>Skriv en kort standardfras avsedd att sägas inom 25 sekunder. Skapa dess ljud utan att skicka ett chattmeddelande. Samma text och röst återanvänder ljudet. Nytt ljud kan kosta krediter; ingen video eller läppsynk skapas. Ljud som visar längre speltid än 25 sekunder avvisas före start; en tidsvakt stoppar även felaktig eller okänd speltid.</p></div><button className="text-button" type="button" onClick={() => void createFixedAudio()} disabled={!sceneAllowed || blocked || !status.voiceConfigured || dirty || Boolean(busy) || draft.response.mode !== 'fixed'}>{busy === 'voice' ? 'Skapar ljud…' : 'Skapa / spara standardfrasens ljud'}</button>{!status.voiceConfigured ? <p>Cartesia behöver konfigureras lokalt för tal.</p> : null}{draft.response.mode !== 'fixed' ? <p>Välj fast standardfras under Reaktion och svar för att skapa detta ljud.</p> : null}</details>{savedAudio ? <div className={styles.savedAudio}><p>Exakt ljudtext: ”{savedAudio.text}”</p><button className="primary-button" type="button" disabled={!sceneAllowed || blocked || dirty || Boolean(busy)} onClick={() => void replay()}>▶ Spela sparat ljud igen (manuellt)</button>{audioPlaying ? <button className="text-button" type="button" onClick={() => cancel('user-stop')}>Stoppa ljud</button> : null}</div> : null}
        <p className={styles.explanation}>Tal är förvalt, högst 25 sekunder, och skapas när du skickar. Avmarkera ljudvalet för enbart text. Ljudet läser samma text som chattsvaret. {generatedSpeechConfigured ? 'Victoria-rösten och genererad läppsynksvideo spelas tillsammans i scenen som ett labbprov. Visuell granskning återstår; generering kan använda Cartesia- och RunPod-krediter.' : 'Nytt ljud kan kosta Cartesia-krediter; samma exakta text och röst kan återanvända cachen. Läppsynk är inte ansluten.'}</p>
        <p className={styles.explanation}>Samtalet finns i den öppna labbpanelen. Det ändrar inte kort, saldo eller resultat. Operatörschatten och IDE-inboxen är separata.</p>
      </details>
    </>}
    </details>
    {notice && !compact ? <p className={styles.notice} role="status">{notice}</p> : null}{error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
