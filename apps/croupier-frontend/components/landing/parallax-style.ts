/** Inline transform that shifts an element by `px` at full pointer deflection. */
export function parallaxStyle(px: number, invert = false) {
  const sign = invert ? -1 : 1
  return {
    transform: `translate3d(calc(var(--mx, 0) * ${sign * px}px), calc(var(--my, 0) * ${sign * px}px), 0)`,
  }
}
