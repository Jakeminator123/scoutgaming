'use client';

import { useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { createNativeLabChat, type LinkedChatSession, type LinkedMessage, type LinkedStatus } from '../lib/native-lab-chat.mjs';
import { playGeneratedSpeech } from '../../../packages/presentation/runtime/generated-speech-player.mjs';
import { NativeSpeechContext } from './native-speech-context';
import type { ActivityDraft } from './activity-log';
import styles from './native-lab-chat.module.css';

interface Props { dealerId: string; dealerLabel: string; active: boolean; actionBusy: boolean; idleReady: boolean;
  roundVersion: number | null; boundary: string; speechHost: RefObject<HTMLDivElement | null>;
  onSettled: () => void; onStatusChange?: (status: LinkedStatus) => void; onActivity: (entry: ActivityDraft) => void }
const playPair = playGeneratedSpeech as (value: unknown, options: { exactText: string; dealerId: string;
  mount: HTMLDivElement; signal: AbortSignal; media: { audio: ArrayBuffer; video: ArrayBuffer };
  onReceipt: (value?: Record<string, unknown>) => void }) => Promise<void>;

export function NativeLabChat(props: Props) {
  const { binding, connected } = useContext(NativeSpeechContext);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<LinkedMessage[]>([]);
  const [status, setStatus] = useState<LinkedStatus>({ state: 'disconnected', pending: false });
  const [visible, setVisible] = useState(true);
  const session = useRef<LinkedChatSession | null>(null);
  const current = useRef(props); current.current = props;
  const scene = { connected, active: props.active, visible, dealerId: props.dealerId, roundVersion: props.roundVersion,
    boundary: props.boundary, actionBusy: props.actionBusy, idleReady: props.idleReady };
  const latestScene = useRef(scene); latestScene.current = scene;
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    change(); document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!binding) { const value = { state: 'disconnected', pending: false }; setStatus(value); current.current.onStatusChange?.(value); return; }
    let live = true;
    setMessages([]); setStatus({ state: 'connecting', pending: false }); current.current.onStatusChange?.({ state: 'connecting', pending: false });
    const instance = createNativeLabChat({ binding, initialScene: { ...latestScene.current, visible: !document.hidden },
      onMessage: message => { if (live) setMessages(items => [...items, message].slice(-12)); },
      onStatus: value => { if (live) { setStatus(value); current.current.onStatusChange?.(value); } },
      onSettled: () => { if (live) current.current.onSettled(); },
      async playGenerated(decision, options) {
        const mount = current.current.speechHost.current;
        if (!mount || options.signal.aborted || !decision.exactText) throw Error('Labbscenen är inte redo.');
        await playPair(decision.speechPackage, { ...options, exactText: decision.exactText, dealerId: decision.dealerId, mount,
          onReceipt: receipt => { if (receipt) options.onReceipt(receipt); } });
      },
      onReceipt: receipt => {
        if (!live) return;
        const phase = receipt.state === 'start' ? 'started' : receipt.state === 'end' ? 'completed' : 'cancelled';
        current.current.onActivity({ source: 'player', stage: 'playback', status: phase, runId: String(receipt.requestId),
          title: 'Bordschatt · genererat tal och läppsynk', owner: 'Labbets spelare',
          reason: 'Exakt talpaket från originalspelets chattsvar. Labbprov, inte visuellt godkänd läppsynk.', data: receipt });
      },
    });
    session.current = instance;
    const receive = (event: MessageEvent) => { void instance.accept(event); };
    window.addEventListener('message', receive);
    return () => { live = false; session.current = null; window.removeEventListener('message', receive); instance.close(); };
  }, [binding]);
  useEffect(() => { session.current?.updateScene(scene); }, [connected, props.active, visible, props.dealerId, props.roundVersion, props.boundary, props.actionBusy, props.idleReady]);
  const enabled = connected && props.active && visible && props.roundVersion != null && !['disconnected', 'connecting', 'closed', 'unavailable'].includes(status.state);
  return <section className={styles.panel} aria-label="Chatt vid det anslutna bordet">
    <h4>Chatta med {props.dealerLabel} vid detta bord</h4>
    <p className={styles.note}>Samma spelarsession och offentliga kort som originalet. Svaret visas här först i standardpositionen. Spelhandlingar har företräde.</p>
    {messages.length ? <ol className={styles.messages} aria-live="polite">{messages.map((message, index) => <li key={`${message.requestId}:${message.role}:${index}`}><strong>{message.role === 'user' ? 'Du' : props.dealerLabel}</strong><span>{message.text}</span></li>)}</ol> : null}
    <form className={styles.form} onSubmit={event => { event.preventDefault(); if (session.current?.submit(text)) setText(''); }}>
      <label className={styles.field}>Meddelande<textarea rows={2} maxLength={500} value={text} disabled={!enabled || status.pending} onChange={event => setText(event.target.value)} placeholder="Fråga om dina synliga kort eller prata med dealern…" /></label>
      <button className="primary-button" type="submit" disabled={!enabled || status.pending || !text.trim()}>Skicka till bordets OpenClaw</button>
      {status.pending ? <button className="text-button" type="button" onClick={() => session.current?.cancel()}>Stoppa svar</button> : null}
    </form>
    <p className={styles.note} role="status">{!connected ? 'Anslut originalspelet ovan för bordschatt.' : !binding ? 'Väntar på originalflikens säkra koppling.' : status.detail ?? (status.state === 'attached' ? 'Bordschatten är ansluten.' : status.state === 'connecting' ? 'Ansluter chattbryggan…' : status.state === 'completed' ? 'Svaret är avslutat.' : status.state === 'unavailable' ? 'Chattbryggan är inte tillgänglig.' : status.state)}</p>
    <small className={styles.note}>Genererat ljud och läppsynk är labbprov, inte visuellt godkända takes. Inga dolda eller framtida kort skickas till modellen.</small>
  </section>;
}
