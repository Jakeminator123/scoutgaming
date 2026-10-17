// Decorative video is optional. CSS hiding must never leave its decoder/WebGL loop running.
export const DECORATIVE_MOTION_MEDIA =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)"

export function observeDecorativeMotion(element: HTMLElement, onChange: (enabled: boolean) => void) {
  const media = window.matchMedia(DECORATIVE_MOTION_MEDIA)
  let intersecting = false
  let away = false
  let disposed = false
  let previous = false
  onChange(false)

  const update = () => {
    if (disposed) return
    const enabled = !away && !document.hidden && intersecting && media.matches
      && navigator.maxTouchPoints === 0
    if (enabled !== previous) {
      previous = enabled
      onChange(enabled)
    }
  }
  // Without an observer the safe fallback is the complete page without decorative video.
  if (!("IntersectionObserver" in window)) return () => {}
  const observer = new IntersectionObserver((entries) => {
    // A delayed batch can contain both entry and exit; its last observation wins.
    for (const entry of entries) {
      if (entry.target === element) intersecting = entry.isIntersecting
    }
    update()
  })
  const onPageHide = () => { away = true; update() }
  const onPageShow = () => { away = false; update() }
  observer.observe(element)
  media.addEventListener("change", update)
  document.addEventListener("visibilitychange", update)
  window.addEventListener("pagehide", onPageHide)
  window.addEventListener("pageshow", onPageShow)

  return () => {
    disposed = true
    observer.disconnect()
    media.removeEventListener("change", update)
    document.removeEventListener("visibilitychange", update)
    window.removeEventListener("pagehide", onPageHide)
    window.removeEventListener("pageshow", onPageShow)
  }
}
