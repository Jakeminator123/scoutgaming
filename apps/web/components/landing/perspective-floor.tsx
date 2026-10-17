import { parallaxStyle } from "./parallax-style"

/**
 * A one-point-perspective floor behind the hero. In casino mode it reads as an
 * endless hall of glowing tables fading into haze; in fantasy mode the same
 * plane becomes a striped pitch. Pure CSS, crossfaded via [data-mode].
 */
export function PerspectiveFloor() {
  return (
    <div aria-hidden="true" className="floor-stage absolute inset-0" style={parallaxStyle(6, true)}>
      <div className="floor-plane">
        <div className="floor-layer floor-tables" />
        <div className="floor-layer floor-pitch" />
      </div>
      <div className="floor-horizon" />
    </div>
  )
}
