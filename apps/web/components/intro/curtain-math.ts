/**
 * Sheet model for the intro curtain. The retro page is cut into vertical strips; this module
 * turns the curtain clip's local time (`g`, seconds) into a transform per strip so the page
 * behaves like a bedsheet: Astrid pinches it to her left (screen right), lifts that corner and
 * sweeps the whole sheet off through the screen's left edge. Nothing is gathered into a ball;
 * the sheet slides as one piece, buckling into folds ahead of her hand and pulled taut behind it.
 * All positions are in viewport pixels.
 */

export type StageMetrics = {
  vw: number
  vh: number
  /** Where the avatar's video frame sits inside the viewport. */
  videoLeft: number
  videoTop: number
  videoW: number
  videoH: number
}

export type StripPose = {
  /** Horizontal offset from the strip's resting position. */
  x: number
  /** Vertical lift (negative is up). */
  y: number
  /** Horizontal scale around the strip's top centre. */
  sx: number
  /** 0-1 darkening that reads as folds. */
  shade: number
}

export type CurtainFrame = {
  poses: StripPose[]
  /** Leftmost and rightmost visible edge of the sheet; used for its drop shadow. */
  left: number
  right: number
  /** How folded the sheet is, 0 flat to 1 fully buckled. */
  bunch: number
  /** Every strip, including its trailing hem, is past the left edge. */
  gone: boolean
}

/** Moments in the curtain clip (seconds), read off the keyed source's hand positions. */
const PINCH_START = 0.85
const PINCH_DURATION = 0.6
/** The sheet is lifted and moves in front of her from here on. */
export const LAYER_SWITCH = 1.45
const SWEEP_START = 1.45
const FLING_START = 2.65
/** Hard stop: by now the sheet counts as gone whatever the screen size. */
export const CURTAIN_GONE = 3.9

/** Where her outstretched hand pinches the sheet, in mirrored video-frame widths. */
const HAND_X = 0.18
/** How far along the sheet a pull takes to arrive, per strip (seconds). */
const LAG_PER_STRIP = 0.016
const MAX_LAG = 0.22
/** Folds never press tighter than this share of a strip's width. */
const MIN_PITCH = 0.3
/** The skewed hem trails this far behind the strip's top edge (viewport heights). */
const HEM_REACH = 0.5

/** Hand position (mirrored video-frame widths) as it sweeps across her body. */
const HAND_KEYS: [number, number][] = [
  [1.45, HAND_X],
  [1.6, 0.25],
  [1.75, 0.36],
  [1.9, 0.56],
  [2.0, 0.685],
  [2.12, 0.774],
  [2.25, 0.868],
  [2.38, 0.93],
  [2.5, 0.974],
  [2.65, 1.02],
]

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const smooth = (t: number) => {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function keyed(keys: [number, number][], t: number) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]
    if (t <= t1) {
      const [t0, v0] = keys[i - 1]
      return lerp(v0, v1, (t - t0) / (t1 - t0))
    }
  }
  return keys[keys.length - 1][1]
}

export function stripWidth(vw: number, count: number) {
  return Math.ceil(vw / count)
}

export function stripCount(vw: number) {
  return Math.min(24, Math.max(12, Math.round(vw / 80)))
}

/** Her hand in screen pixels; she reaches to screen right and sweeps toward screen left. */
function handX(g: number, m: StageMetrics) {
  return m.videoLeft + (1 - keyed(HAND_KEYS, g)) * m.videoW
}

/** How far the sheet has slid left at time `t` (negative pixels). */
function slide(t: number, m: StageMetrics) {
  if (t <= SWEEP_START) return 0
  const start = handX(SWEEP_START, m)
  if (t <= FLING_START) return handX(t, m) - start
  // Thrown, not dragged: it leaves the hand at the hand's speed and keeps picking up pace.
  const atRelease = handX(FLING_START, m) - start
  const speed = (handX(FLING_START, m) - handX(FLING_START - 0.1, m)) / 0.1
  const tau = t - FLING_START
  return atRelease + speed * tau - 3.5 * m.vw * tau * tau
}

export function curtainFrame(g: number, m: StageMetrics, count: number): CurtainFrame {
  const stripW = stripWidth(m.vw, count)
  const poses: StripPose[] = new Array(count)

  if (g < PINCH_START) {
    for (let i = 0; i < count; i++) poses[i] = { x: 0, y: 0, sx: 1, shade: 0 }
    return { poses, left: 0, right: m.vw, bunch: 0, gone: false }
  }

  const grip = handX(SWEEP_START, m)
  const k = Math.min(count - 1, Math.max(0, Math.floor(grip / stripW)))
  const pinch = smooth((g - PINCH_START) / PINCH_DURATION)
  const sweep = smooth((g - SWEEP_START) / (FLING_START - SWEEP_START))
  const fling = clamp01((g - FLING_START) / 0.6)

  const xs = new Array<number>(count)
  for (let i = 0; i < count; i++) {
    const rest = (i + 0.5) * stripW
    const reach = (rest - grip) / (stripW * 3.2)
    // Her fingers draw the cloth near the grip toward them, which starts the first folds.
    const drawIn = (grip - rest) * 0.28 * pinch * Math.exp(-reach * reach)
    const lag = Math.min(MAX_LAG, Math.abs(i - k) * LAG_PER_STRIP)
    xs[i] = rest + drawIn + slide(g - lag, m)
  }
  // Ahead of the hand the lagging cloth buckles into folds; behind it the sheet pulls taut.
  for (let i = k - 1; i >= 0; i--) xs[i] = Math.min(xs[i + 1] - MIN_PITCH * stripW, Math.max(xs[i], xs[i + 1] - stripW))
  for (let i = k + 1; i < count; i++) xs[i] = Math.max(xs[i - 1] + MIN_PITCH * stripW, Math.min(xs[i], xs[i - 1] + stripW))

  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let folded = 0
  const hem = HEM_REACH * m.vh
  let gone = true
  for (let i = 0; i < count; i++) {
    const toLeft = i > 0 ? xs[i] - xs[i - 1] : stripW
    const toRight = i < count - 1 ? xs[i + 1] - xs[i] : stripW
    const pitch = Math.min(1, (toLeft + toRight) / 2 / stripW)
    const buckle = 1 - pitch
    folded += buckle
    // Folded strips stay wider than their pitch so they overlap like pleats instead of opening slits.
    const wobble = 1 + 0.18 * buckle * Math.sin(i * 2.3 + g * 5)
    const width = Math.max(Math.max(toLeft, toRight) * 1.02, stripW * (0.55 + 0.45 * pitch) * wobble)

    const d = (i - k) / 5
    const cornerLift = Math.exp(-d * d)
    // The pinched corner rises first; once thrown the whole sheet lifts away with it.
    const lift = m.vh * (0.02 * pinch * cornerLift + 0.05 * sweep * cornerLift + 0.22 * fling * fling * (0.4 + 0.6 * cornerLift))

    const shade = Math.min(0.6, 0.55 * buckle * (0.65 + 0.35 * Math.sin(i * 1.7 + g * 4)) + 0.08 * sweep * cornerLift)
    poses[i] = { x: xs[i] - (i + 0.5) * stripW, y: -lift, sx: width / stripW, shade }
    left = Math.min(left, xs[i] - width / 2)
    right = Math.max(right, xs[i] + width / 2)
    if (xs[i] + width / 2 + hem > -10) gone = false
  }

  return { poses, left, right, bunch: Math.min(1, (folded / count) * 2.2 + sweep * 0.3), gone }
}

/**
 * `anchorX` lines her up with where she will finally sit (the hero card). It is capped so the
 * hand that grabs the sheet, which reaches out to screen right, stays inside the viewport.
 */
export function computeMetrics(vw: number, vh: number, anchorX?: number): StageMetrics {
  let videoH = vh * 0.9
  let videoW = videoH * 0.75
  if (videoW > vw * 0.96) {
    videoW = vw * 0.96
    videoH = videoW / 0.75
  }
  const fallbackX = vw >= 900 ? vw * 0.52 : vw * 0.5
  const centerX = anchorX === undefined ? fallbackX : Math.min(anchorX, vw - 20 - (0.5 - HAND_X) * videoW)
  return {
    vw,
    vh,
    videoLeft: Math.round(centerX - videoW / 2),
    videoTop: Math.round(vh - videoH - vh * 0.02),
    videoW: Math.round(videoW),
    videoH: Math.round(videoH),
  }
}
