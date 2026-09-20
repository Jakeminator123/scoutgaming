'use client';

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react';
import type { StudioAsset, StudioEvent } from '../lib/studio-model.mjs';
import { getMotionClip, motionAllowedForSource, stageBaseAnimation } from '../lib/motion-library.mjs';
import { playMotion } from '../lib/motion-player.mjs';
import motionStyles from './stage-motion.module.css';

function PlayingCard({ rank, suit, back = false, className = '' }: { rank: string; suit: string; back?: boolean; className?: string }) {
  return <div className={`playing-card ${back ? 'card-back' : ''} ${suit === '♥' || suit === '♦' ? 'red-suit' : ''} ${className}`}>
    {back ? <span className="card-monogram">C</span> : <><span className="card-corner">{rank}<small>{suit}</small></span><span className="card-suit">{suit}</span><span className="card-corner card-corner-bottom">{rank}<small>{suit}</small></span></>}
  </div>;
}

export function Stage({ event, asset, dealer, variantLabel, playId, playing, hasResult, onPlay, busy, videoUrl, videoName, onPreview, previewing = false, previewLabel = 'Förhandsvisa vald variant', onPlaybackEnd }: {
  event: StudioEvent;
  asset?: StudioAsset;
  dealer: string;
  variantLabel: string;
  playId: number;
  playing: boolean;
  hasResult: boolean;
  onPlay: () => void;
  busy: boolean;
  videoUrl?: string;
  videoName?: string;
  onPreview?: () => void;
  previewing?: boolean;
  previewLabel?: string;
  onPlaybackEnd?: () => void;
}) {
  const [preview, setPreview] = useState<'animation' | 'video'>('animation');
  const sceneRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const leftArmRef = useRef<HTMLDivElement>(null);
  const rightArmRef = useRef<HTMLDivElement>(null);
  const blushRef = useRef<HTMLSpanElement>(null);
  const sadFaceRef = useRef<HTMLSpanElement>(null);
  const coverHandsRef = useRef<HTMLDivElement>(null);
  const showVideo = preview === 'video' && Boolean(videoUrl);
  const requestedClip = getMotionClip(asset?.id);
  const clip = motionAllowedForSource(requestedClip, event.sourceType) ? requestedClip : undefined;
  const durationMs = asset?.durationMs ?? clip?.durationMs ?? 1700;
  const animation = stageBaseAnimation(event, asset?.animation);
  const shouldAnimate = hasResult || previewing;
  const reportPlaybackEnd = useEffectEvent(() => onPlaybackEnd?.());
  const eventCard = event.exampleEvent.card as { r?: string; s?: string } | null | undefined;
  const rank = eventCard?.r ?? 'A';
  const suit = eventCard?.s ?? '♠';
  const isConcealed = event.exampleEvent.faceDown === true;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || showVideo || !shouldAnimate || playId === 0) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let completed = false;
    const finish = () => { if (!completed) { completed = true; reportPlaybackEnd(); } };
    if (!clip) {
      const fallback = window.setTimeout(finish, preference.matches ? 0 : durationMs);
      return () => { completed = true; window.clearTimeout(fallback); };
    }
    const playback = playMotion(clip, {
      actor: actorRef.current, face: faceRef.current, leftArm: leftArmRef.current,
      rightArm: rightArmRef.current, blush: blushRef.current,
      sadFace: sadFaceRef.current, coverHands: coverHandsRef.current,
    }, { durationMs, reducedMotion: preference.matches, onFinish: finish });
    scene.dataset.motionPlayer = playback.status === 'unsupported' ? 'css' : 'json';
    const fallback = playback.status === 'unsupported' ? window.setTimeout(finish, durationMs) : undefined;
    const reduce = () => { if (preference.matches) { playback.cancel(); finish(); } };
    preference.addEventListener('change', reduce);
    return () => { completed = true; window.clearTimeout(fallback); preference.removeEventListener('change', reduce); playback.cancel(); delete scene.dataset.motionPlayer; };
  }, [clip, durationMs, event.id, dealer, shouldAnimate, playId, showVideo]);

  return <section className="stage-panel" aria-label="Animerad labbförhandsvisning">
    <div className="stage-overline"><span><i className="live-dot" /> {showVideo ? 'VIDEOFIL · LABBPREVIEW' : 'SYNTHETIC STAGE'}</span>{videoUrl ? <div className="stage-preview-tabs" role="group" aria-label="Förhandsvisningstyp"><button aria-pressed={!showVideo} onClick={() => setPreview('animation')}>Animation</button><button aria-pressed={showVideo} onClick={() => setPreview('video')}>Videofil</button></div> : <span>Blackjack <span className="separator">/</span> {dealer}</span>}</div>
    {showVideo ? <div className="stage-video"><video key={`${videoUrl}-${playId}`} src={videoUrl} controls autoPlay muted playsInline onEnded={onPlaybackEnd} aria-label={`Exakt labbkopplat original: ${videoName ?? 'video'}`} /><span>Originalvideo · ljud av från start · inte runtime-godkänd</span></div> : <div ref={sceneRef} className={`stage-scene ${motionStyles.scene} ${shouldAnimate ? 'is-playing' : ''} motion-${animation}`} key={`${event.id}-${playId}`} data-motion-asset={clip?.assetId} style={{ '--motion-duration': `${durationMs}ms`, '--asset-color': asset?.color ?? '#a5d9cb' } as CSSProperties} aria-hidden="true">
      <div className="stage-halo" />
      <div className="stage-lines" />
      <div className="dealer-presence">
        <div className="dealer-nameplate">{dealer}<span>CROUPIER</span></div>
        <div className="dealer-avatar" ref={actorRef}><div className={motionStyles.face} ref={faceRef}><div className="avatar-hair" /><div className="avatar-head"><span ref={blushRef} className={motionStyles.blush} /><span ref={sadFaceRef} className={motionStyles.sadFace}><i /><i /><span className={motionStyles.sadMouth} /></span></div></div><div className="avatar-neck" /><div className="avatar-body"><i /><i /></div><div className="avatar-arm left-arm" ref={leftArmRef} /><div className="avatar-arm right-arm" ref={rightArmRef} /><div className={motionStyles.coverHands} ref={coverHandsRef}><i /><i /></div></div>
        <div className="speech-signal"><i /><i /><i /><i /><i /></div>
      </div>
      <div className="table-surface"><div className="table-inner"><div className="table-brand">CROUPIER<span>BLACKJACK · PRESENTATION LAB</span></div><div className="table-arc" /><div className="table-rule">THE GAME DECIDES. THE DEALER PRESENTS.</div>
        <div className="table-slot slot-left">01</div><div className="table-slot slot-centre">02</div><div className="table-slot slot-right">03</div>
      </div></div>
      <div className="shoe"><PlayingCard rank="" suit="" back /><PlayingCard rank="" suit="" back /></div>
      <div className="dealer-cards"><PlayingCard rank="6" suit="♠" /><div className="flip-card"><div className="flip-inner"><div className="flip-front"><PlayingCard rank="" suit="" back /></div><div className="flip-back"><PlayingCard rank={rank} suit={suit} /></div></div></div></div>
      <div className="player-card resting-card"><PlayingCard rank="8" suit="♣" /></div>
      <div className="dealt-card"><PlayingCard rank={rank} suit={suit} back={isConcealed} /></div>
      <div className="chip-stack chips-left"><i /><i /><i /><span>25</span></div><div className="chip-stack chips-centre"><i /><i /><i /><span>50</span></div><div className="chip-stack chips-right"><i /><i /><i /><span>25</span></div>
      <div className="turn-indicator" />
      <div className="stage-sparkles"><i /><i /><i /><i /><i /><i /></div>
    </div>}
    <div className="stage-bottom"><div className="stage-caption"><span className="eyebrow">{showVideo ? 'EXAKT KOPPLAD VIDEOGENERERING' : playing || previewing ? 'SPELAR LABBANIMATION' : 'REDO FÖR FÖRHANDSVISNING'}</span><strong>{variantLabel}</strong><span className={motionStyles.motionLabel}>{showVideo ? videoName : clip ? <>Tyst 2D-exempel · {clip.label} · <code>{clip.assetId}</code></> : 'Illustrerad rörelse · ingen spelmotor eller produktionsspelare'}</span></div><div className={motionStyles.actions}>{onPreview ? <button type="button" className={motionStyles.previewButton} onClick={onPreview} disabled={busy}><span aria-hidden="true">▷ </span>{previewLabel}</button> : null}<button type="button" className="play-button" onClick={onPlay} disabled={busy}><span aria-hidden="true">{busy ? '◌' : '▶'}</span>{busy ? 'Beräknar…' : 'Testa event'}</button></div></div>
  </section>;
}
