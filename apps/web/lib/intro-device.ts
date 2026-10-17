type IntroNavigator = {
  userAgent: string
  platform: string
  maxTouchPoints: number
  userAgentData?: { mobile?: boolean }
}

// A touchscreen laptop is still a computer. An iPad requesting a desktop site is not.
export function isDesktopIntroDevice(nav: IntroNavigator): boolean {
  if (nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)) return false
  if ((nav.platform === "MacIntel" || /Macintosh/i.test(nav.userAgent)) && nav.maxTouchPoints > 1) return false
  return /Windows NT|Macintosh|X11|CrOS/i.test(nav.userAgent)
    || /^(Win|Mac|Linux|CrOS)/i.test(nav.platform)
}

export const INTRO_MOTION_MEDIA = "(prefers-reduced-motion: no-preference)"

/** Admit the intro once, at arrival. Browsing or hiding the page cancels even a pending import. */
export function observeDesktopIntro(onChange: (enabled: boolean) => void) {
  const media = window.matchMedia(INTRO_MOTION_MEDIA)
  if (!isDesktopIntroDevice(navigator) || !media.matches || document.hidden || window.scrollY > 16) {
    onChange(false)
    return () => {}
  }
  let active = true
  const dismiss = () => {
    if (!active) return
    active = false
    onChange(false)
  }
  const onVisibility = () => { if (document.hidden) dismiss() }
  const onMotion = () => { if (!media.matches) dismiss() }
  const onScroll = () => { if (window.scrollY > 16) dismiss() }
  media.addEventListener("change", onMotion)
  document.addEventListener("visibilitychange", onVisibility)
  window.addEventListener("pagehide", dismiss)
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("wheel", dismiss, { passive: true })
  window.addEventListener("touchstart", dismiss, { passive: true })
  onChange(true)
  return () => {
    active = false
    media.removeEventListener("change", onMotion)
    document.removeEventListener("visibilitychange", onVisibility)
    window.removeEventListener("pagehide", dismiss)
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("wheel", dismiss)
    window.removeEventListener("touchstart", dismiss)
  }
}
