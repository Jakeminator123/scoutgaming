export const DEALER_KEY_FILTER_ID = "dealer-white-key";

/*
 * Every portrait is framed the same way: head centred, shoulders filling the bottom.
 * The studio backdrop can therefore only exist above the head and beside the
 * shoulders, never in the lower centre where the collar and tie sit. This gradient
 * (white = never key, black = key allowed) encodes that: an ellipse anchored at the
 * bottom centre, 26 % wide and 34 % tall, with a soft fall-off.
 */
const PROTECT_ZONE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(50 100) scale(26 34)">' +
      '<stop offset="0.72" stop-color="#fff"/><stop offset="1" stop-color="#000"/>' +
      "</radialGradient>" +
      '<rect width="100" height="100" fill="#000"/><rect width="100" height="100" fill="url(#g)"/>' +
      "</svg>",
  );

/*
 * Turns the near-white studio background of the dealer stills and clips transparent
 * without eating blonde hair or white shirts.
 *
 * A luminance key fails on Paow: her highlights are as bright as the backdrop. The
 * difference is colour — the backdrop is neutral (R ≈ G ≈ B ≥ 0.99) while blonde is
 * warm, so its blue channel sits far below white. The key therefore demands that
 * every channel is ≥ ~97 %, and only outside the torso zone:
 *
 * 1. feComponentTransfer thresholds each channel (0.955 → 0, 0.975 → 1).
 * 2. Three feColorMatrix copies spread R, G and B into their own greyscale images,
 *    and arithmetic feComposites multiply them: white = tR × tG × tB × allow,
 *    where allow = 1 − PROTECT_ZONE.
 * 3. feColorMatrix flips that into alpha = 1 − white.
 * 4. feMorphology dilate + erode close speck-sized holes (compressed video pushes
 *    isolated highlight pixels to pure white), with one extra pixel of erode as the
 *    edge choke that drops the pale anti-aliased fringe. feGaussianBlur feathers it
 *    and the final feComposite "in" applies that alpha to the original colours.
 */
export function DealerKeyFilter() {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0" focusable="false">
      <defs>
        <filter id={DEALER_KEY_FILTER_ID} colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
          <feComponentTransfer in="SourceGraphic" result="thr">
            <feFuncR type="linear" slope="50" intercept="-47.75" />
            <feFuncG type="linear" slope="50" intercept="-47.75" />
            <feFuncB type="linear" slope="50" intercept="-47.75" />
          </feComponentTransfer>

          <feColorMatrix in="thr" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 1 0" result="tR" />
          <feColorMatrix in="thr" type="matrix" values="0 1 0 0 0  0 1 0 0 0  0 1 0 0 0  0 0 0 1 0" result="tG" />
          <feColorMatrix in="thr" type="matrix" values="0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 1 0" result="tB" />
          <feComposite in="tR" in2="tG" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="tRG" />
          <feComposite in="tRG" in2="tB" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="tRGB" />

          <feImage href={PROTECT_ZONE} x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="protect" />
          <feColorMatrix
            in="protect"
            type="matrix"
            values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"
            result="allow"
          />
          <feComposite in="tRGB" in2="allow" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="white" />

          <feColorMatrix in="white" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 0 0 0 1" result="mask" />

          <feMorphology in="mask" operator="dilate" radius="3" result="closed" />
          <feMorphology in="closed" operator="erode" radius="4" result="choked" />
          <feGaussianBlur in="choked" stdDeviation="0.6" result="soft" />
          <feComposite in="SourceGraphic" in2="soft" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
