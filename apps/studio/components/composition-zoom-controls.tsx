'use client';
import type {CompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {zoomComposition} from '../lib/composition-zoom.mjs';

export function CompositionZoomControls({settings,disabled,onChange}:{settings:CompositionSettings;disabled:boolean;onChange:(settings:CompositionSettings)=>void}) {
  function candidate(factor:number) {
    try { return zoomComposition(settings,'desktop',factor); } catch { return null; }
  }
  const smaller=candidate(1/1.1),larger=candidate(1.1);
  return <fieldset disabled={disabled} style={{border:0,padding:0,margin:'12px 0',minWidth:0}}>
    <legend>Scenstorlek i spelet</legend>
    <p style={{fontSize:12}}>Zoomar bakgrund, dealer och bord tillsammans runt bildens mitt. Sparas i den gemensamma miljöns utkast; spelaren ser ändringen efter publicering.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled||!smaller} onClick={()=>{if(!disabled&&smaller)onChange(smaller);}}>− Zooma ut scenen</button>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={disabled||!larger} onClick={()=>{if(!disabled&&larger)onChange(larger);}}>+ Zooma in scenen</button>
    </div>
    <p style={{fontSize:12}}>Finjustera ett lager med dess storlek och placering. Vid en placeringsgräns stoppas hela zoomsteget.</p>
  </fieldset>;
}
