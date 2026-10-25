const fail = () => { throw Object.assign(Error('Invalid composition settings'), { statusCode: 422 }); };
const object = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function exact(value, keys) {
  if (!object(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail();
}
function placement(value, dimension) {
  exact(value, [dimension, 'x', 'y']);
  if (!Number.isFinite(value[dimension]) || value[dimension] < .1 || value[dimension] > 4
    || ['x', 'y'].some(key => !Number.isFinite(value[key]) || value[key] < -2 || value[key] > 2)) fail();
}
export function defaultCompositionSettings() {
  const plane = () => ({ scale: 1, x: 0, y: 0 });
  return { mobile: { dealer: plane(), background: plane(), table: { width: 1, x: 0, y: .04 } },
    desktop: { dealer: plane(), background: plane(), table: { width: .31640625, x: 0, y: .04 } }, tableFront: false };
}
export function validateCompositionSettings(value,{tableIds,assets}={}) {
  exact(value, ['mobile', 'desktop', 'tableFront', ...(Object.hasOwn(value??{}, 'blackjackTables')?['blackjackTables']:[])]);
  if (typeof value.tableFront !== 'boolean') fail();
  for (const layout of ['mobile', 'desktop']) {
    exact(value[layout], ['dealer', 'background', 'table', ...(Object.hasOwn(value[layout]??{},'gameUi')?['gameUi']:[])]);
    placement(value[layout].dealer, 'scale'); placement(value[layout].background, 'scale'); placement(value[layout].table, 'width');
    if(Object.hasOwn(value[layout],'gameUi')){
      const ui=value[layout].gameUi;exact(ui,['actions','chat']);
      if(ui.actions!==null)point(ui.actions);
      exact(ui.chat,['x','y','width','height']);point({x:ui.chat.x,y:ui.chat.y});
      if(['width','height'].some(key=>!Number.isFinite(ui.chat[key])||ui.chat[key]<.15||ui.chat[key]>1))fail();
    }
  }
  if(value.blackjackTables!==undefined){
    if(!Array.isArray(value.blackjackTables)||value.blackjackTables.length>32)fail();
    const ids=new Set();
    for(const table of value.blackjackTables){
      exact(table,['tableId','mobile','desktop']);
      if(typeof table.tableId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(table.tableId)||ids.has(table.tableId))fail();
      ids.add(table.tableId);
      if(tableIds!==undefined&&!tableIds.includes(table.tableId))fail();
      if(assets!==undefined&&!assets.some(asset=>asset.id===table.tableId&&asset.role==='table'&&asset.game!=='roulette'))fail();
      for(const layout of ['mobile','desktop']){
        const geometry=table[layout];exact(geometry,['cardWidth','dealer','seats',...['betMode','anchors','autoScale','cardView','fanSpread'].filter(key=>Object.hasOwn(geometry??{},key))]);
        if(Object.hasOwn(geometry,'fanSpread')&&(!Number.isFinite(geometry.fanSpread)||geometry.fanSpread<.25||geometry.fanSpread>1.5))fail();
        if(Object.hasOwn(geometry,'autoScale'))autoScale(geometry.autoScale);
        if(Object.hasOwn(geometry,'cardView')&&!['table','raised'].includes(geometry.cardView))fail();
        if(Object.hasOwn(geometry,'anchors')){
          const anchors=geometry.anchors;
          if(!object(anchors)||!Object.keys(anchors).length||Object.keys(anchors).some(key=>!['cards','bets'].includes(key)))fail();
          for(const anchor of Object.values(anchors)){
            exact(anchor,['target','rect']);if(!['table','dealer','scene'].includes(anchor.target))fail();
            exact(anchor.rect,['x','y','width','height']);
            if(['x','y'].some(key=>!Number.isFinite(anchor.rect[key])||Math.abs(anchor.rect[key])>40)
              ||['width','height'].some(key=>!Number.isFinite(anchor.rect[key])||anchor.rect[key]<.0001||anchor.rect[key]>80))fail();
          }
        }
        if(Object.hasOwn(geometry,'betMode')&&geometry.betMode!=='under-cards')fail();
        if(!Number.isFinite(geometry.cardWidth)||geometry.cardWidth<.02||geometry.cardWidth>.15)fail();
        point(geometry.dealer);
        if(!Array.isArray(geometry.seats)||geometry.seats.length!==(layout==='mobile'?3:7))fail();
        for(const seat of geometry.seats){exact(seat,['card','bet']);point(seat.card);point(seat.bet);}
      }
    }
  }
  return structuredClone(value);
}
// Kevin's model, opt-in per board layout: the composited dealer plane decides
// the landing point, the resting card size (the dealer's prop card) and the
// chips. Adjustments sit on top of that scale; the filmed landing has no offset.
function autoScale(value){
  exact(value,['landing','cardSize','chips',...(Object.hasOwn(value??{},'adjust')?['adjust']:[])]);
  if(['landing','cardSize','chips'].some(key=>typeof value[key]!=='boolean')||!(value.landing||value.cardSize||value.chips))fail();
  if(!Object.hasOwn(value,'adjust'))return;
  const adjust=value.adjust,ratio=v=>Number.isFinite(v)&&v>=.5&&v<=2;
  if(!object(adjust)||!Object.keys(adjust).length||Object.keys(adjust).some(key=>!['cards','chips'].includes(key)))fail();
  if(Object.hasOwn(adjust,'cards')){exact(adjust.cards,['scale']);if(!ratio(adjust.cards.scale))fail();}
  if(Object.hasOwn(adjust,'chips')){
    exact(adjust.chips,['dx','dy','scale']);
    if(!ratio(adjust.chips.scale)||['dx','dy'].some(key=>!Number.isFinite(adjust.chips[key])||Math.abs(adjust.chips[key])>.5))fail();
  }
}
// New board geometry starts with every automatic part on; absent stays manual.
export function defaultBlackjackAutoScale(){return {landing:true,cardSize:true,chips:true};}
function point(value){
  exact(value,['x','y']);
  if(['x','y'].some(key=>!Number.isFinite(value[key])||value[key]<0||value[key]>1))fail();
}
// Starting handles, not an accepted calibration for any particular design.
export function defaultBlackjackTableGeometry(tableId){
  const layout=count=>({cardWidth:.06,dealer:{x:.5,y:.18},seats:Array.from({length:count},(_,i)=>{
    const x=.18+.64*i/(count-1),arc=Math.sin(Math.PI*i/(count-1))*.08;
    return {card:{x,y:.3+arc},bet:{x,y:.48+arc}};
  })});
  return {tableId,mobile:layout(3),desktop:layout(7)};
}
export function retainBlackjackTableGeometry(settings,tableIds){
  if(!settings?.blackjackTables)return;
  settings.blackjackTables=settings.blackjackTables.filter(row=>tableIds.includes(row.tableId));
  if(!settings.blackjackTables.length)delete settings.blackjackTables;
}
export function sceneForComposition(settings, layout, show = {}, key = {}) {
  const checked = validateCompositionSettings(settings);
  if (!['mobile', 'desktop'].includes(layout)) fail();
  return { layout, stage: { mobile: checked.mobile.dealer, desktop: checked.desktop.dealer },
    background: 'background', table: 'table', backgroundFit: 'cover',
    backgroundTransform: { mobile: checked.mobile.background, desktop: checked.desktop.background },
    tablePlacement: checked[layout].table, tableFront: checked.tableFront,
    tableTransform: { width: 1, x: 0, y: 0 }, layerMode: 'full', splitY: .4, anchors: false,
    key: { mode: 'composite', enabled: false, threshold: .23, softness: .15, despill: 0, ...key },
    show: { background: true, dealer: true, table: true, cards: false, foreground: false, overlay: false, ...show } };
}
