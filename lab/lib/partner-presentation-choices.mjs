import {gameLaneConfiguration,gameChoicesForLane} from '../../web/public/game-lanes.mjs';
import {listPackageRooms} from '../../web/presentation-room-contract.mjs';
import {isPresentationRoomLaneCompatible} from '../../web/storage/frozen-presentation-capture.mjs';

// A company-wide dealer choice must render in every live room for this
// presentation. A frozen grant alone cannot add a dealer to a portrait adapter.
export function partnerPresentationDealerChoices({administration,package:pack,presentation,operatorId}) {
  const {gameLanes}=gameLaneConfiguration(administration);
  const rooms=listPackageRooms({administration,package:pack,operatorId});
  const portraitDealerIds=presentation.schemaVersion===3?presentation.registeredDealers.map(row=>row.id):[];
  return Object.fromEntries(presentation.lanes.map(presentationLane=>{
    const matched=rooms.filter(room=>room.state==='live'&&room.presentationLaneId===presentationLane.id)
      .map(room=>({room,lane:gameLanes.find(lane=>lane.id===room.gameLaneId)}))
      .filter(({room,lane})=>isPresentationRoomLaneCompatible(lane,presentationLane,presentation,room.game??'blackjack'));
    const choices=matched.map(({room,lane})=>gameChoicesForLane(presentation.lanes,presentationLane.id,lane,
      {portraitDealerIds:room.game==='roulette'&&presentation.registeredDealers?.find(row=>row.id===presentationLane.layers.dealer.default)?.rouletteIdle
        ?portraitDealerIds.filter(id=>presentation.registeredDealers.some(row=>row.id===id&&row.rouletteIdle?.base)):portraitDealerIds}).dealers);
    return [presentationLane.id,choices.length?presentationLane.layers.dealer.allowed.filter(id=>choices.every(list=>list.includes(id))):[]];
  }));
}
