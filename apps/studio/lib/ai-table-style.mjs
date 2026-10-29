// Styles for "Skapa bordsgrafik med AI": the 3D mock-up's colours
// (filmed-table-template.mjs), the box stroke the server draws (and the landing
// check measures) and the words the brief uses. Pure data and text, shared by
// the route and its tests; nothing here calls a provider.
import {AI_IMAGE_PRESETS} from './ai-image-contract.mjs';

// look: felt (centre), light (the pool under the dealer's light), rail and its
// highlight, inlay gradient, trim line, apron gradient, metal (pedestal ring,
// neon's second line) and an optional glow along the felt edge.
export const AI_TABLE_STYLES = Object.freeze({
  'dark-luxury':Object.freeze({stroke:'rgba(232,200,120,0.9)',
    look:{felt:'#16181c',light:'#343840',rail:'#111113',railLight:'#55555e',inlay:['#6b2a22','#2e0f0b'],trim:'#d4af5a',apron:['#3a1e14','#120905'],metal:'#c9a24a',glow:null},
    text:'Dark luxury, like a private high-roller room: near-black woven felt, a polished rosewood inlay band, a thick black padded leather rail with fine stitching and deep specular highlights, a thin brushed-gold trim line along the felt edge, a dark rosewood apron and a pedestal with a brass foot ring. Warm light falls from behind the dealer; rich blacks, no grey.'}),
  neon:Object.freeze({stroke:'rgba(90,240,255,0.95)',
    look:{felt:'#0e0b18',light:'#2a1f46',rail:'#09090d',railLight:'#45455a',inlay:['#1c1730','#07060c'],trim:'#ff3df2',apron:['#14111d','#040306'],metal:'#25e8ff',glow:'#ff3df2'},
    text:'Aggressive neon: near-black felt with a faint violet sheen, a glossy black rail, a hot magenta neon tube glowing along the felt edge and a thin cyan light line along the rail\'s outer edge, the glow reflected softly on the felt and the rail. Hard contrast, a cyber-club mood, bold and striking.'}),
  casino:Object.freeze({stroke:'rgba(232,200,120,0.85)',
    look:{felt:'#0f5a3a',light:'#186640',rail:'#121212',railLight:'#5a5a5a',inlay:['#5e2a16','#2a1008'],trim:'#d1aa55',apron:['#3b1b0e','#130804'],metal:'#c9a24a',glow:null},
    text:'Classic casino: deep casino-green woven felt, a polished mahogany inlay, a black padded leather rail, a thin gold pinstripe along the felt edge, a mahogany apron and a pedestal with a brass foot ring. Warm overhead light; timeless and expensive.'}),
  'dark-studio':Object.freeze({stroke:'rgba(255,255,255,0.72)',
    look:{felt:'#26292e',light:'#40454d',rail:'#0f0f11',railLight:'#4c4c54',inlay:['#5c6066','#2a2c30'],trim:'#c8ccd2',apron:['#1d1f23','#09090b'],metal:'#a5aab2',glow:null},
    text:'Deep charcoal felt with a fine woven texture, a matte black padded rail, a thin cool-silver inlay line and a black apron; calm studio light.'}),
  'warm-lounge':Object.freeze({stroke:'rgba(255,236,200,0.78)',
    look:{felt:'#4a1820',light:'#6e2a33',rail:'#2a170d',railLight:'#6b4630',inlay:['#7a4a26','#3a200e'],trim:'#d9a861',apron:['#3a2010','#140a04'],metal:'#c99a52',glow:null},
    text:'Deep burgundy felt with a polished walnut rail and inlay, warm amber light falloff and a walnut apron.'}),
  'light-studio':Object.freeze({stroke:'rgba(40,40,48,0.6)',
    look:{felt:'#aebac7',light:'#cdd5de',rail:'#b08a5f',railLight:'#e2c9a4',inlay:['#d8bf98','#a7865d'],trim:'#f2efe8',apron:['#c9a87d','#7d6142'],metal:'#d9d9d9',glow:null},
    text:'Light blue-grey felt with a pale oak rail, inlay and apron, clean and bright under diffuse daylight.'}),
  free:Object.freeze({stroke:'rgba(255,255,255,0.72)',look:null,text:null}),
});

// The pre-made tables in Bordsgrafik, described in words only (never embedded).
export const AI_TABLE_REFERENCES = 'STYLE REFERENCES (described in words only; match their finish and depth, never copy them): '
  +'"Grön filt": classic deep-green woven felt, black padded leather rail, thin gold pinstripe, warm light. '
  +'"Lila neon": near-black felt with a violet neon glow along the rail edge and a dark glossy rail. '
  +'"Ljus ek": a light oak rail and apron with a warm, pale felt. '
  +'Production\'s Privé table: black felt, rosewood inlay, a thick black leather rail, gold trim and warm light from behind the dealer.';

export function aiTableStyle(preset) {
  if (!AI_IMAGE_PRESETS.some(row=>row.id===preset)||!Object.hasOwn(AI_TABLE_STYLES,preset)) throw Error('invalid_table_style');
  return AI_TABLE_STYLES[preset];
}

// "Fri" with an inspiration image: the mock-up's felt takes the image's dominant
// colour, kept dark enough for the box stroke (white) to stand out.
export function aiTableLookFromColour({r,g,b}) {
  if (![r,g,b].every(channel=>Number.isInteger(channel)&&channel>=0&&channel<=255)) return null;
  const luminance=.2126*r+.7152*g+.0722*b,scale=luminance>70?70/luminance:1;
  const channel=value=>Math.round(value*scale).toString(16).padStart(2,'0');
  const felt='#'+[r,g,b].map(channel).join('');
  const light='#'+[r,g,b].map(value=>Math.min(255,Math.round(value*scale*1.6+12)).toString(16).padStart(2,'0')).join('');
  return {felt,light};
}

/** The brief for one table proposal; the template and request decide every fixed number. */
export function aiTableBrief({preset,staff,inspiration,template,size,sceneTemplate,variation,forbidden}) {
  const style=aiTableStyle(preset);
  return ['MODE: a premium blackjack table graphic for a filmed live dealer, seen from the dealer camera. The dealer is composited behind it; the table must look solid, expensive and three-dimensional, never flat or grey.',
    `FRAME: the FIRST attached image is a rendered 3D mock-up at ${size.width}x${size.height}: black is outside the table and is cut away by the server along the table's silhouette. Inside it: the felt lit from the dealer's side, the rail's shadow on the felt, a wood inlay band, a thick padded rail, the apron under the rail and the pedestal. White outlines are the betting boxes and the dealer card spot, which the server draws afterwards at exact positions.`,
    'EDIT the mock-up into a photorealistic table: keep its silhouette, the rail, apron and pedestal positions, the perspective and the scale exactly; replace the flat colours with real materials (woven felt with a soft light pool from the dealer side, stitched padded leather with specular highlights, polished wood, metal), contact shadows and ambient occlusion. Inside each white outline keep plain, even felt; the boxes are drawn later.',
    `LOOK: ${style.text??'follow the staff description and the reference photo; choose bold, rich materials.'}`,
    AI_TABLE_REFERENCES,
    `FORBIDDEN: ${forbidden}; painted box outlines, circles, arcs, payout lines, chip trays, cup holders or any object on the table.`,
    staff,inspiration,
    `LANDINGS: dealer ${template.dealerId}, ${template.seats.length} boxes from the filmed profile, placed for ${sceneTemplate?`scene template ${sceneTemplate.id}`:'the default composition'}.`,variation].filter(Boolean).join('\n');
}
