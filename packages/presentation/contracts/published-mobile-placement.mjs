import {validateCompositionSettings} from './composition-settings.mjs';

const fail=()=>{throw Object.assign(Error('studio_invalid_mobile_placement'),{statusCode:422});};

// A shared preview/publication calculation, never a new coordinate system.
// Zero is useful for read-only preview; the publication endpoint rejects it.
export function adjustPublishedMobilePlacement(settings,tableId,offsetY){
  if(typeof tableId!=='string'||!Number.isFinite(offsetY)||Math.abs(offsetY)>.2)fail();
  const next=validateCompositionSettings(settings),board=next.blackjackTables?.find(row=>row.tableId===tableId),mobile=board?.mobile;
  if(!mobile||mobile.betMode!=='under-cards'||mobile.anchors||mobile.autoScale||mobile.seats.length!==3)fail();
  for(const seat of mobile.seats){
    const y=seat.card.y+offsetY;
    if(!Number.isFinite(y)||y<0||y>1)fail();
    seat.card.y=y;
  }
  return validateCompositionSettings(next);
}
