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
    exact(value[layout], ['dealer', 'background', 'table']);
    placement(value[layout].dealer, 'scale'); placement(value[layout].background, 'scale'); placement(value[layout].table, 'width');
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
        const geometry=table[layout];exact(geometry,['cardWidth','dealer','seats',...(Object.hasOwn(geometry??{},'betMode')?['betMode']:[])]);
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
