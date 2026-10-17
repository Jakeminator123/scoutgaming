'use client';
import { labUrl } from "../lib/lab-url.mjs";

import { useContext, useEffect, useRef } from 'react';
import { NativeSpeechContext } from './native-speech-context';
import { idleReactionInput } from '../lib/idle-reaction-input.mjs';
import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import type { ActivityDraft } from './activity-log';

interface Props { records: Record<string, unknown>[]; project: StudioProject; dealerId: string; mode: string;
  revision: number | null; boundary: string; active: boolean;
  onOffer: (value: { videoId: string; requestId: string; expiresAt: number }) => boolean;
  onActivity: (entry: ActivityDraft) => void }

export function IdleReactions(props: Props) {
  const { binding, connected } = useContext(NativeSpeechContext);
  const seen = useRef(new Set<string>());
  const pending = useRef<AbortController | null>(null);
  const current = useRef(props); current.current = props;
  // Cancelling a stale advice request cannot delay any game or speech queue.
  useEffect(() => {
    return () => { pending.current?.abort(); pending.current = null; };
  }, [binding, connected, props.project, props.dealerId, props.mode, props.revision, props.boundary, props.active]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { pending.current?.abort(); pending.current = null; } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    if (!binding || !connected || !props.active || document.hidden) return;
    const input = idleReactionInput({ ...props, channel: binding.channel, requestId: crypto.randomUUID() });
    if (!input || seen.current.has(input.sourceRef.messageId)) return;
    if (seen.current.size >= 512) return;
    // A newer user message supersedes an unfinished reaction. Never offer an
    // answer to an older message after its context has already changed.
    pending.current?.abort();
    seen.current.add(input.sourceRef.messageId);
    const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);
    void (async () => {
      try {
        const response = await fetch(labUrl('/api/presentation/idle'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input), signal: controller.signal });
        if (!response.ok) throw new Error('idle-advice-unavailable');
        const result = await response.json();
        if (controller.signal.aborted || pending.current !== controller || result.requestId !== input.requestId
          || !result.sourceRef || Object.entries(input.sourceRef).some(([key, value]) => result.sourceRef[key] !== value)) return;
        const ttl = Date.parse(result.expiresAt) - Date.now();
        const offered = props.mode === 'active' && typeof result.videoId === 'string' && ttl > 0 && ttl <= 30000
          && current.current.onOffer({ videoId: result.videoId, requestId: input.requestId, expiresAt: performance.now() + ttl });
        current.current.onActivity({ source: 'lab', stage: 'decision', status: 'observed', runId: input.requestId,
          title: 'Grundloop · reaktion på chatt', owner: 'Grundloopens klippval',
          reason: offered ? 'Tillåten reaktion erbjuden. Spel och färdigt tal har företräde; detta är inte ett uppspelningskvitto.'
            : 'Grundloopen fortsätter. Skuggläge, ingen tillåten reaktion, gammalt råd eller tjänst utan rätt kontextkontrakt spelar ingen variant.',
          data: { sourceRef: result.sourceRef, provider: result.provider, videoId: result.videoId, wouldChooseId: result.wouldChooseId,
            offered: Boolean(offered), playbackConfirmed: false, contextReceipt: result.contextReceipt } });
      } catch {
        if (!controller.signal.aborted) current.current.onActivity({ source: 'lab', stage: 'decision', status: 'failed', runId: input.requestId,
          title: 'Klippval saknas · grundloopen fortsätter', owner: 'Grundloopens klippval',
          reason: 'Ingen automatisk omkörning. Spel och tal fortsätter oberoende av rådgivaren.' });
      } finally { clearTimeout(timer); if (pending.current === controller) pending.current = null; }
    })();
  }, [binding, connected, props.records, props.project, props.dealerId, props.mode, props.revision, props.boundary, props.active]);
  return null;
}
