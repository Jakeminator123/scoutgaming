export function portraitIdleDelay(random?: () => number): number;
export type PortraitPlayback = { request(): boolean; finish(): void; setEligible(value: boolean): void; dispose(): void };
export function createPortraitPlayback(options: {
  start(): void; stop(): void; random?: () => number;
  setTimer?: (callback: () => void, delay: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}): PortraitPlayback;
