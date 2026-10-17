"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_DELAY_MS = 50_000;
const EMPTY_CLIPS: readonly string[] = [];

/** Decorative lobby clips only; this never controls the gameplay player. */
export function usePortraitVideo({ clips = EMPTY_CLIPS, idle, interactive, playOnMount }: {
  clips?: readonly string[]; idle: boolean; interactive: boolean; playOnMount: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const finishTimer = useRef<number | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const eligible = visible && motionAllowed;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionAllowed(!document.hidden && !preference.matches);
    update();
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      window.clearTimeout(hoverTimer.current);
      window.clearTimeout(finishTimer.current);
    };
  }, []);

  const start = useCallback(() => {
    if (!eligible || clip || !clips.length) return;
    setClip(clips[Math.floor(Math.random() * clips.length)]);
  }, [eligible, clip, clips]);

  useEffect(() => {
    if (!eligible || !idle || clip || !clips.length) return;
    const delay = round === 0 ? (playOnMount ? 700 : 5_000 + Math.random() * 10_000) : IDLE_DELAY_MS;
    const timer = window.setTimeout(start, delay);
    return () => window.clearTimeout(timer);
  }, [eligible, idle, clip, clips, round, playOnMount, start]);

  const finish = useCallback(() => {
    window.clearTimeout(finishTimer.current);
    setPlaying(false);
    finishTimer.current = window.setTimeout(() => {
      setClip(null);
      setRound(value => value + 1);
    }, 350);
  }, []);

  useEffect(() => {
    if (!clip) return;
    const video = videoRef.current;
    if (!eligible || !video) {
      window.clearTimeout(finishTimer.current);
      setPlaying(false);
      setClip(null);
      setRound(value => value + 1);
      return;
    }
    let disposed = false;
    // A denied autoplay or a stalled download must not leave a mounted clip
    // blocking all future idle attempts. Keep the still visible until playing.
    const watchdog = window.setTimeout(finish, 30_000);
    video.play().catch(() => { if (!disposed) finish(); });
    return () => {
      disposed = true;
      window.clearTimeout(watchdog);
      window.clearTimeout(finishTimer.current);
      video.pause();
    };
  }, [clip, eligible, finish]);

  useEffect(() => {
    if (!eligible || !interactive) window.clearTimeout(hoverTimer.current);
  }, [eligible, interactive]);

  const hover = () => {
    window.clearTimeout(hoverTimer.current);
    if (interactive && eligible) hoverTimer.current = window.setTimeout(start, 220);
  };
  const leave = () => window.clearTimeout(hoverTimer.current);
  return { rootRef, videoRef, clip, playing, finish, hover, leave, onPlaying: () => setPlaying(true) };
}
