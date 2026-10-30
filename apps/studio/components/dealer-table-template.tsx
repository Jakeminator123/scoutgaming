import type { CSSProperties } from 'react';
import tableImage from './dealer-table-assets/olive-blackjack-v1.webp';
import tableDefinition from './dealer-table-assets/olive-blackjack-v1.json';
import { getDealerTableGeometry, validateDealerTableDefinition } from './dealer-table-geometry.mjs';
import type { DealerTableDefinition, TableLayout, TablePlacement } from './dealer-table-geometry.mjs';

export type DealerTableTemplateSource = { definition: DealerTableDefinition; assetUrl: string };
export const oliveBlackjackTemplate: DealerTableTemplateSource = {
  definition: validateDealerTableDefinition(tableDefinition), assetUrl: tableImage.src,
};
export { getDealerTableGeometry } from './dealer-table-geometry.mjs';
export type { DealerTableDefinition, TableLayout, TablePlacement } from './dealer-table-geometry.mjs';

export type DealerTableArtworkProps = {
  template?: DealerTableTemplateSource;
  layout?: TableLayout;
  placement?: TablePlacement;
  showAnchors?: boolean;
};

/** Insert after the dealer and before cards/UI in an existing scene SVG. */
export function DealerTableArtwork({ template = oliveBlackjackTemplate, layout = 'desktop', placement, showAnchors = false }: DealerTableArtworkProps) {
  const geometry = getDealerTableGeometry(template.definition, layout, placement);
  const [x, y, width, height] = geometry.rect;
  return <g data-table-template={template.definition.id} pointerEvents="none" aria-hidden="true">
    <image href={template.assetUrl} x={x} y={y} width={width} height={height} preserveAspectRatio="none" />
    {showAnchors && <g fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke">
      <circle cx={geometry.dealer.x} cy={geometry.dealer.y} r="9" stroke="#f2cf87" />
      {geometry.seats.map((seat, index) => <g key={index}>
        <path d={`M${seat.card.x - 7},${seat.card.y}h14 M${seat.card.x},${seat.card.y - 7}v14`} stroke="#f9f4e8" />
        <circle cx={seat.bet.x} cy={seat.bet.y} r="7" stroke="#93dac2" />
      </g>)}
    </g>}
  </g>;
}

/** The parent must preserve the selected scene aspect ratio or use contain fitting. */
export function DealerTableTemplate({ className, style, ...props }: DealerTableArtworkProps & { className?: string; style?: CSSProperties }) {
  const layout = props.layout ?? 'desktop';
  const { scene } = (props.template ?? oliveBlackjackTemplate).definition.layouts[layout];
  return <svg className={className} viewBox={`0 0 ${scene.width} ${scene.height}`} preserveAspectRatio="xMidYMid meet"
    aria-hidden="true" focusable="false" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }}>
    <DealerTableArtwork {...props} />
  </svg>;
}
