'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { requestJson } from './studio-types';
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
  registerCancel: (cancel: (() => void) | null) => void;
  onBegin: () => void;
  onReaction: (assetId: 'social.ledsen' | 'idle.ready.standard', label: string, exactReply: string) => void;
  draftCache?: RefObject<SocialDraftCache | null>;
}

const audioPath = /^\/api\/voice\/[a-f0-9]{64}$/;

export function socialHistory(messages: readonly ChatMessage[]) {
  const history = messages.filter((item): item is ChatMessage & { role: 'user' | 'assistant' } => item.role !== 'system' && item.content.trim().length > 0 && item.content.length <= 1000).slice(-12);
  let size = history.reduce((sum, item) => sum + item.content.length, 0);
  while (size > 8000 && history.length) size -= history.shift()!.content.length;
  return history.map(item => ({ role: item.role, content: item.content }));
}

/** Separate social-lab policy and conversation. It never edits the presentation project. */
export function SocialChatPanel({ dealerId, eventId, onGoToIdle, registerCancel, onBegin, onReaction, draftCache }: Props) {
  const [status, setStatus] = useState<SocialStatus | null>(() => draftCache?.current?.status ?? null);
  const [draft, setDraft] = useState<SocialPolicy | null>(() => draftCache?.current?.draft ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [voice, setVoice] = useState(false);
  const [busy, setBusy] = useState<'loading' | 'saving' | 'chat' | 'voice' | null>(() => draftCache?.current ? null : 'loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reply, setReply] = useState<SocialReply | null>(null);
  const [savedAudio, setSavedAudio] = useState<SocialAudio | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const conversation = useRef('');
  const audio = useRef<HTMLAudioElement | null>(null);
  const sceneAllowed = dealerId === 'astrid' && eventId === 'idle.ready';
  const dirty = Boolean(draft && status && JSON.stringify(draft) !== JSON.stringify(status.policy));
  useEffect(() => { if (draftCache && draft && status) draftCache.current = { draft, status }; }, [draftCache, draft, status]);
  useEffect(() => {
    function warnOnReload(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', warnOnReload);
    return () => window.removeEventListener('beforeunload', warnOnReload);
  }, [dirty]);

  const cancel = useCallback(() => {
    generation.current++;
    request.current?.abort(); request.current = null;
    if (audio.current) { audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load(); audio.current = null; }
    setAudioPlaying(false); setBusy(null); setReply(null); setSavedAudio(null);
  }, []);

  useEffect(() => {
    registerCancel(cancel);
    return () => { cancel(); registerCancel(null); };
  }, [cancel, registerCancel]);

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
    cancel(); onBegin(); setNotice(''); setError('');
    setDraft(current => { if (!current) return current; const next = structuredClone(current); edit(next); return next; });
  }

  function begin(kind: 'saving' | 'chat' | 'voice') {
    cancel(); onBegin(); setError(''); setNotice('');
    const controller = new AbortController(), run = generation.current;
    request.current = controller; setBusy(kind);
    return { controller, run, current: () => !controller.signal.aborted && run === generation.current };
  }
  function finish(run: number) { if (run === generation.current) { request.current = null; setBusy(null); } }

  async function savePolicy() {
    if (!draft || !status || busy) return;
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
    if (!sceneAllowed || !audioPath.test(source.audioUrl)) { setError('Ljudet hör inte till ett giltigt lokalt röstprov.'); return; }
    audio.current?.pause();
    const element = new Audio(source.audioUrl), run = generation.current;
    audio.current = element;
    element.onended = () => { if (audio.current === element) setAudioPlaying(false); };
    element.onerror = () => { if (audio.current === element && run === generation.current) { setAudioPlaying(false); setError('Det sparade ljudet kunde inte spelas. Prova uppspelningsknappen igen.'); } };
    try { await element.play(); if (audio.current === element && run === generation.current) setAudioPlaying(true); else element.pause(); }
    catch { if (audio.current === element && run === generation.current) setError('Webbläsaren väntar på ett klick. Välj Spela sparat ljud för att lyssna.'); }
  }

  async function send() {
    if (!sceneAllowed || !status?.configured || !draft || dirty || busy || !message.trim()) return;
    const content = message.trim(), history = socialHistory(messages), policy = status.policy;
    const requestId = crypto.randomUUID();
    if (!conversation.current) conversation.current = `lab-social-${crypto.randomUUID()}`;
    const task = begin('chat');
    setMessages(current => [...current, { role: 'user', content }]); setMessage('');
    try {
      const next = await requestJson<SocialReply>('/api/social/chat', { method: 'POST', signal: task.controller.signal, body: JSON.stringify({ requestId, conversationId: conversation.current, message: content, history, policyRevision: policy.revision, scene: { dealerId: 'astrid', eventId: 'idle.ready' }, voice }) });
      if (!task.current()) return;
      if (next.requestId !== requestId || next.policyRevision !== policy.revision || next.provider !== 'responded' || !['social.ledsen', 'idle.ready.standard'].includes(next.assetId)) throw new Error('Svaret matchar inte det aktuella sociala testet och spelades inte upp.');
      if (next.systemNotice === true) {
        setMessages(current => [...current, { role: 'system', content: 'Triggern vilar en kort stund. Prova igen när den sparade pausen har löpt ut.' }]);
        setNotice('Servern höll tillbaka reaktionen under pausen. Inget ljud eller extra rörelse spelades.');
        return;
      }
      setReply(next); setMessages(current => [...current, { role: 'assistant', content: next.reply }]);
      onReaction(next.assetId, next.triggerId ? policy.trigger.label : 'Neutralt vänteläge', next.reply);
      if (next.audio && voice) {
        if (next.audio.text !== next.reply) throw new Error('Ljudets text matchar inte svaret. Ljudet spelades inte upp.');
        setSavedAudio(next.audio); void playAudio(next.audio);
      }
      if (next.voiceError) setError(`Textsvaret kom fram, men talet saknas: ${next.voiceError}`);
    } catch (cause) { if (task.current()) setError(cause instanceof Error ? cause.message : 'Astrid kunde inte svara.'); }
    finally { finish(task.run); }
  }

  async function createFixedAudio() {
    if (!sceneAllowed || !status?.voiceConfigured || !draft || dirty || busy || draft.response.mode !== 'fixed') return;
    const policy = status.policy, task = begin('voice');
    try {
      const next = await requestJson<SocialAudio>('/api/social/voice', { method: 'POST', signal: task.controller.signal, body: JSON.stringify({ policyRevision: policy.revision }) });
      if (!task.current()) return;
      if (next.text !== policy.response.fixedText || !audioPath.test(next.audioUrl)) throw new Error('Ljudet matchar inte den sparade standardfrasen.');
      setSavedAudio(next); setNotice(next.cached ? 'Standardfrasens ljud finns redan sparat och återanvänds.' : 'Standardfrasens ljud är sparat lokalt. Tryck på Spela sparat ljud.');
    } catch (cause) { if (task.current()) setError(cause instanceof Error ? cause.message : 'Standardfrasens ljud kunde inte skapas.'); }
    finally { finish(task.run); }
  }

  function replay() {
    if (!savedAudio || !sceneAllowed || dirty || busy) return;
    const source = savedAudio, originalReply = reply, reactionId = originalReply?.assetId ?? 'social.ledsen';
    // Stop playback without losing the model's original neutral/expression choice.
    cancel(); onBegin(); setReply(originalReply); setSavedAudio(source);
    onReaction(reactionId, reactionId === 'social.ledsen' ? draft?.trigger.label ?? 'Ledsen' : 'Neutralt vänteläge', source.text);
    void playAudio(source);
  }

  return <section className={styles.panel} aria-labelledby="social-chat-heading">
    <div className={styles.heading}><div><span className="eyebrow">SPELARCHATT</span><h2 id="social-chat-heading">Chatta med Astrid</h2></div><span className={styles.badge}>Astrids vänteläge</span></div>
    <p>Skriv som en spelare. Astrid svarar via OpenClaw och kan reagera i scenen. Eventtestets simulerade värden används inte här.</p>
    {!sceneAllowed ? <div className={styles.sceneGate}><strong>Chatten provas bara när Astrid väntar.</strong><p>Välj vänteläget för att inte lägga en social rörelse ovanpå kortdelning eller en annan croupier.</p><button className="primary-button" type="button" onClick={onGoToIdle}>Gå till Astrids vänteläge →</button></div> : null}
    {!draft || !status ? <div className={styles.loading}><p>{busy === 'loading' ? 'Läser sociala inställningar…' : 'Sociala inställningar är inte inlästa.'}</p>{!busy ? <button className="text-button" type="button" onClick={() => void loadPolicy()}>Läs inställningarna igen</button> : null}</div> : <>
      <div className={messages.length || busy === 'chat' ? styles.chat : styles.chatEmpty} aria-live="polite">{messages.length ? messages.map((item, index) => <div key={index} className={item.role === 'user' ? styles.playerMessage : item.role === 'system' ? styles.systemMessage : styles.astridMessage}><span>{item.role === 'user' ? 'DU / LABBSPELARE' : item.role === 'system' ? 'SYSTEM / PAUS' : 'ASTRID'}</span><p>{item.content}</p></div>) : <p className={styles.empty}>Ingen konversation ännu. Börja med ett meddelande nedan.</p>}{busy === 'chat' ? <p className={styles.pending}>Astrid funderar…</p> : null}</div>
      <form onSubmit={event => { event.preventDefault(); void send(); }}>
        <label className={styles.field}>Meddelande till Astrid<textarea rows={2} maxLength={1000} value={message} disabled={!sceneAllowed || !status.configured || Boolean(busy)} placeholder="Skriv som en spelare vid bordet…" onChange={event => { cancel(); onBegin(); setMessage(event.target.value); }} /></label>
        <label className={styles.check}><input type="checkbox" checked={voice} disabled={!status.voiceConfigured || Boolean(busy)} onChange={event => { cancel(); onBegin(); setVoice(event.target.checked); }} /><span>Läs upp svaret<small>{!status.voiceConfigured ? 'Tal är inte konfigurerat.' : 'Valfritt · nytt tal kan kosta ElevenLabs-krediter.'}</small></span></label>
        <div className={styles.actions}><span>{!status.configured ? 'OpenClaw är inte konfigurerat.' : dirty ? 'Spara dina sociala inställningar före testet.' : 'Modellanrop sker bara när du skickar.'}</span><button className="primary-button" type="submit" disabled={!sceneAllowed || !status.configured || dirty || Boolean(busy) || !message.trim()}> {busy === 'chat' ? 'Väntar…' : 'Skicka till Astrid ↑'}</button></div>
      </form>
      {reply ? <div className={styles.decision}><strong>{reply.triggerId ? `${status.policy.trigger.label} valdes` : 'Ingen social reaktion valdes'}</strong><span>Modellens bedömning: {Math.round(reply.confidence * 100)} %. {reply.suppressed ? `Servern begränsade reaktionen: ${reply.suppressed}.` : ''}</span><code>{reply.assetId}</code></div> : null}
      <details className={styles.settings}>
        <summary>Reaktion och svar <span>{dirty ? 'Osparat utkast' : 'Sparad policy'}</span></summary>
        {dirty ? <p className={styles.draftWarning}>Osparat socialt utkast. Det bevaras när du byter sida i studion, men försvinner om du laddar om eller stänger fliken. Spara sociala inställningar när du är nöjd.</p> : null}
        <p>Bestäm när Astrid får reagera och hur hon svarar. Sparas här, separat från eventprojektet.</p>
        <fieldset disabled={Boolean(busy)}>
          <label className={styles.check}><input type="checkbox" checked={draft.trigger.enabled} onChange={event => editPolicy(next => { next.trigger.enabled = event.target.checked; })} />Aktivera reaktionen</label>
          <label className={styles.field}>Reaktionens namn<input value={draft.trigger.label} maxLength={80} onChange={event => editPolicy(next => { next.trigger.label = event.target.value; })} /></label>
          <label className={styles.field}>När ska Astrid reagera?<textarea rows={3} value={draft.trigger.directive} maxLength={1000} onChange={event => editPolicy(next => { next.trigger.directive = event.target.value; })} /></label>
          <div className={styles.twocol}><label className={styles.field}>Tröskel för modellens bedömning<input type="number" min={0} max={1} step={0.05} value={draft.trigger.threshold} onChange={event => editPolicy(next => { next.trigger.threshold = Number(event.target.value); })} /><small>0–1. En modellbedömning, inte en mätning av spelarens känslor.</small></label><label className={styles.field}>Paus mellan reaktioner (ms)<input type="number" min={0} max={300000} step={500} value={draft.cooldownMs} onChange={event => editPolicy(next => { next.cooldownMs = Number(event.target.value); })} /></label></div>
          <label className={styles.field}>Svarssätt<select value={draft.response.mode} onChange={event => editPolicy(next => { next.response.mode = event.target.value as 'fixed' | 'free'; })}><option value="fixed">Fast standardfras vid trigger</option><option value="free">Fritt modellsvar</option></select></label>
          <label className={styles.field}>Sparad standardfras<textarea rows={2} value={draft.response.fixedText} maxLength={500} onChange={event => editPolicy(next => { next.response.fixedText = event.target.value; })} /><small>{draft.response.mode === 'free' ? 'Frasen behålls men används inte som fast svar i det här läget.' : 'Spara texten innan du skapar dess ljud.'}</small></label>
        </fieldset>
        <div className={styles.actions}><code>social.ledsen · {status.policy.revision.slice(0, 12)}</code><button className="primary-button" type="button" disabled={!dirty || Boolean(busy)} onClick={() => void savePolicy()}>{busy === 'saving' ? 'Sparar…' : 'Spara sociala inställningar'}</button></div><button className="text-button" type="button" disabled={Boolean(busy)} onClick={() => { if (!dirty || window.confirm('Läs in den sparade sociala policyn och kasta detta sociala utkast?')) void loadPolicy(); }}>Läs om sparad social policy</button>
      </details>
      <details className={styles.audioTools}><summary>Standardfrasens ljud <span>Valfritt</span></summary><div><p>Skapa ljud för den sparade standardfrasen utan att skicka ett chattmeddelande. Samma text och röst återanvänder ljudet. Nytt ljud kan kosta krediter; ingen video eller läppsynk skapas.</p></div><button className="text-button" type="button" onClick={() => void createFixedAudio()} disabled={!sceneAllowed || !status.voiceConfigured || dirty || Boolean(busy) || draft.response.mode !== 'fixed'}>{busy === 'voice' ? 'Skapar ljud…' : 'Skapa / spara standardfrasens ljud'}</button>{!status.voiceConfigured ? <p>ElevenLabs behöver konfigureras lokalt för tal.</p> : null}{draft.response.mode !== 'fixed' ? <p>Välj fast standardfras under Reaktion och svar för att skapa detta ljud.</p> : null}</details>{savedAudio ? <div className={styles.savedAudio}><p>Exakt ljudtext: ”{savedAudio.text}”</p><button className="primary-button" type="button" disabled={!sceneAllowed || dirty || Boolean(busy)} onClick={replay}>▶ Spela sparat ljud</button>{audioPlaying ? <button className="text-button" type="button" onClick={cancel}>Stoppa ljud</button> : null}</div> : null}
    </>}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}{error ? <p className="inline-error" role="alert">{error}</p> : null}
    <details className={styles.about}><summary>Om chatten och kostnader</summary><p>Detta är en separat social labbpolicy, inte ett spel-event. Kort, saldo och resultat ändras inte. Chatten är skild från operatörschatten och IDE-inboxen, och har inget bestående spelarminne.</p><p>Modellanrop sker när du skickar. Tal är valfritt och kan förbruka ElevenLabs-krediter; avbrytning garanterar inte att leverantörens kostnad avbryts. Historiken finns bara medan chattpanelen är öppen.</p></details>
  </section>;
}
