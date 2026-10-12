// One reference plane for dealer, cards and fitted layers in both renderers.
export function stageGeometry(scene) {
  const dims=scene.layout==='mobile'?[1080,1920]:[1920,1080],t=scene.stage[scene.layout];
  const s=Math.min(dims[0]/1080,dims[1]/1920)*t.scale;
  return {dims,s,x:(dims[0]-1080*s)/2+t.x*dims[0],y:(dims[1]-1920*s)/2+t.y*dims[1]};
}

export function backgroundRect(scene,asset,dims) {
  const t=scene.backgroundTransform?.[scene.layout]||{scale:1,x:0,y:0};
  const fit=scene.backgroundFit==='contain'?Math.min:Math.max;
  const s=fit(dims[0]/asset.width,dims[1]/asset.height)*t.scale;
  const width=asset.width*s,height=asset.height*s;
  return [(dims[0]-width)/2+t.x*dims[0],(dims[1]-height)/2+t.y*dims[1],width,height];
}

// Published compositions place the table independently of dealer framing.
// Old preview scenes retain their existing reference-plane coordinates.
export function tableRect(scene, asset, geometry) {
  const {dims, x, y, s} = geometry, t = scene.tablePlacement;
  if (t) {
    const width = t.width * dims[0];
    return [(dims[0] - width) / 2 + t.x * dims[0], t.y * dims[1], width, width * asset.height / asset.width];
  }
  const transform = scene.tableTransform, width = transform.width * 1080 * s;
  return [x + transform.x * 1080 * s, y + transform.y * 1920 * s, width, width * asset.height / asset.width];
}
