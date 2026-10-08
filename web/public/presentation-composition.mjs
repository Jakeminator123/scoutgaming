const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail = () => {throw Error('Invalid layer composition');};
export function validateComposition(value) {
  if (!value || value.schemaVersion!==1 || Object.keys(value).sort().join(',')!=='assets,background,dealer,schemaVersion,table'
    || !Array.isArray(value.assets) || value.assets.length>64) fail();
  if (Object.keys(value.dealer??{}).sort().join(',')!=='compatibility,enabled' || value.dealer.compatibility!=='full-frame' || typeof value.dealer.enabled!=='boolean') fail();
  const ids=new Set();
  for(const asset of value.assets) {
    if(Object.keys(asset).sort().join(',')!=='contentType,id,label,role,src' || !idPattern.test(asset.id)||ids.has(asset.id)
      || !['background','table'].includes(asset.role)||typeof asset.label!=='string'||asset.label.length>80
      || !['image/png','image/jpeg','image/webp','video/mp4','video/webm'].includes(asset.contentType)
      || !new RegExp(`^/api/presentation/layers/[a-z][a-z0-9-]{0,62}/${asset.id}$`).test(asset.src))fail();
    ids.add(asset.id);
  }
  for(const role of ['background','table']) {
    const layer=value[role];
    if(!layer||Object.keys(layer).sort().join(',')!== (role==='background'?'allowed,default,enabled,mode':'allowed,default,enabled')
      ||typeof layer.enabled!=='boolean'||!Array.isArray(layer.allowed)||layer.allowed.length>32||new Set(layer.allowed).size!==layer.allowed.length
      ||layer.allowed.some(id=>!value.assets.some(asset=>asset.id===id&&asset.role===role))
      ||layer.default!==null&&!layer.allowed.includes(layer.default))fail();
    if(role==='background'&&!['baked','image','video'].includes(layer.mode))fail();
  }
  return structuredClone(value);
}

// Independent presentation planes surrounding the existing exact clip player.
// An opaque full-frame film keeps its original pixels. It is never keyed here.
export function createLayerComposition(document, initial) {
  const host=document.querySelector('#scene');if(!host)return null;
  document.documentElement.dataset.presentationStandard='three-layer';
  let current=initial?validateComposition(initial):null;
  const mounts=new Map();
  function render(role,id) {
    mounts.get(role)?.remove();mounts.delete(role);
    if(!current||!current[role].enabled||current.dealer.enabled&&current.dealer.compatibility==='full-frame'||role==='background'&&current.background.mode==='baked')return;
    const asset=current.assets.find(row=>row.id===id&&row.role===role);if(!asset)return;
    const node=document.createElement(asset.contentType.startsWith('video/')?'video':'img');
    node.className=`presentation-plane presentation-${role}`;node.dataset.layerAsset=asset.id;node.setAttribute('aria-hidden','true');
    if(node.tagName==='VIDEO'){node.muted=true;node.loop=true;node.playsInline=true;node.preload='metadata';node.autoplay=true;}
    else node.alt='';
    node.src=asset.src;host.append(node);mounts.set(role,node);
  }
  function set(role,id) {if(current&&current[role].allowed.includes(id))render(role,id);}
  function replace(value) {current=validateComposition(value);for(const role of ['background','table'])render(role,current[role].default);host.dataset.dealerLayerEnabled=String(current.dealer.enabled);}
  if(current)replace(current);
  return {setBackground:id=>set('background',id),setTable:id=>set('table',id),replace};
}
