import type {CompositionSettings} from './composition-settings.mjs';
interface SceneLane {
  composition?:CompositionSettings;
  layers:{table:{allowed:readonly string[]}};
}
/** Publishes saved geometry while retaining the frozen package's material grants. */
export function sceneLayoutPublication(publishedLane:SceneLane,savedLane:SceneLane):{composition:CompositionSettings;changed:boolean};
