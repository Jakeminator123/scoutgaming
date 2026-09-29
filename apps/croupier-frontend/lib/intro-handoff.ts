import { useSyncExternalStore } from "react"

/**
 * How the intro and the hero card share the screen. While the intro is "holding", the hero card
 * stays invisible so Astrid can sit down where it will appear; "revealed" is the moment the
 * intro's playing card has grown to the hero card's exact size and hands over to it.
 */
export type IntroHandoff = "idle" | "holding" | "revealed"

let state: IntroHandoff = "idle"
const listeners = new Set<() => void>()

export function setIntroHandoff(next: IntroHandoff) {
  if (state === next) return
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useIntroHandoff() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => "idle" as IntroHandoff,
  )
}
