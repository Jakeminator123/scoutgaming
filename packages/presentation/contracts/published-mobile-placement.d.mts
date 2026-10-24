import type {CompositionSettings} from './composition-settings.mjs';
/** Pure preview calculation. Zero is accepted here; publication requires a nonzero offset. */
export function adjustPublishedMobilePlacement(settings:CompositionSettings,tableId:string,offsetY:number):CompositionSettings;
