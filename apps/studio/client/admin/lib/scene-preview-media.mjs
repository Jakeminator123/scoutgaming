import {defaultCompositionSettings} from '../../../../../packages/presentation/contracts/composition-settings.mjs';
import {effectiveDealerCompositing} from '../../../../../packages/presentation/contracts/dealer-compositing.mjs';
import {layerAssetFitsGame} from '../../../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {selectableLayerBases} from '../../../../../packages/presentation/contracts/background-playback-policy.mjs';
import {rouletteReferencePreview} from './roulette-clip-map.mjs';

const previewTypes=new Set(['image/png','video/mp4','video/webm']);

// What a scene template shows without the game engine: the dealer's saved idle (the `idle.ready` baseline;
// for roulette the registered reference or idle), the template's background and its table graphics through
// /studio/api/layer-assets/<id>. `choices` are the editor's own preview picks; a pick outside the template is
// ignored. Nothing is invented: a missing clip or layer stays null so the page can say so.
// Derived per render from the saved project and the video register; it holds no state of its own.
export function useScenePreviewMedia({project,inventory,lane,game='blackjack',dealerId='',choices={}}) {
  const assets=project?.layerAssets??[];
  const allowedDealers=lane?.layers.dealer.allowed??[];
  const previewDealer=allowedDealers.includes(choices.dealer)?choices.dealer:allowedDealers.includes(dealerId)?dealerId:lane?.layers.dealer.default??dealerId;
  const backgroundBases=selectableLayerBases(lane?.layers.background.allowed,lane?.backgroundPlayback,lane?.layers.background.default??null);
  const backgroundId=backgroundBases.includes(choices.background)?choices.background:lane?.layers.background.default;
  const baseline=project?.lines.find(row=>row.dealerId===previewDealer&&row.eventId==='idle.ready');
  const videos=inventory?.videos??[];
  const selected=game==='roulette'?rouletteReferencePreview({videos},previewDealer)
    :videos.find(row=>row.id===baseline?.variants.find(item=>item.id===baseline.baselineVariantId)?.videoGenerationId&&row.available&&!row.classification?.archived&&row.classification?.game!=='roulette'&&row.integrity!=='unavailable');
  const video=selected&&previewTypes.has(selected.contentType??'')?selected:null;
  const media=id=>{const asset=assets.find(row=>row.id===id&&layerAssetFitsGame(row,game));return asset?{url:'/studio/api/layer-assets/'+asset.id,label:asset.label,contentType:asset.contentType}:null;};
  const tableBases=selectableLayerBases(lane?.layers.table.allowed,lane?.tablePlayback,lane?.layers.table.default??null);
  const tables=assets.filter(row=>row.role==='table'&&layerAssetFitsGame(row,game)&&tableBases.includes(row.id));
  const tableAsset=tables.find(row=>row.id===choices.table)??tables.find(row=>row.id===lane?.layers.table.default);
  const background=media(backgroundId),table=media(tableAsset?.id);
  return {
    dealerId:previewDealer,backgroundId,backgroundBases,tableBases,tables,tableAsset,video,media,
    dealer:video?{url:video.previewUrl,label:video.label,contentType:video.contentType}:null,
    background,table,
    compositing:video?effectiveDealerCompositing(video.classification?.compositing):undefined,
    framing:video?.classification?.framing,
    settings:lane?.composition??defaultCompositionSettings(),
  };
}
