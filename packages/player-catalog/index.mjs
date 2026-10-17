// Apps supply the existing room and slug validators. This reader owns only
// the public API requests and their strict result handling.
export function createPlayerCatalog({ isOperatorSlug, validatePublicOperatorRooms }) {
  function operatorPublicView(payload, slug) {
    if (!isOperatorSlug(slug) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const keys = Object.keys(payload);
    if (keys.length !== 2 || !Object.hasOwn(payload, 'slug') || !Object.hasOwn(payload, 'name')) return null;
    if (payload.slug !== slug || typeof payload.name !== 'string' || payload.name.length < 1 || payload.name.length > 120) return null;
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(payload.name)) return null;
    return {slug: payload.slug, name: payload.name};
  }

  async function loadOperatorCatalogue({fetchImpl=fetch,signal}={}) {
    try {
      const response=await fetchImpl('/api/operators',{
        headers:{accept:'application/json'},cache:'no-store',redirect:'error',signal,
      });
      if(!response.ok)return {status:'unavailable'};
      const text=await response.text();
      if(text.length>256000)return {status:'unavailable'};
      const data=JSON.parse(text);
      if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).join(',')!=='operators'
        ||!Array.isArray(data.operators)||data.operators.length>1000)return {status:'unavailable'};
      const operators=[],seen=new Set();
      for(const row of data.operators){
        const operator=operatorPublicView(row,row?.slug);
        if(!operator||seen.has(operator.slug))return {status:'unavailable'};
        seen.add(operator.slug);operators.push(operator);
      }
      return {status:'ready',operators};
    } catch {return {status:'unavailable'};}
  }

  async function loadRoomCatalogue(slug,{fetchImpl=fetch,signal}={}) {
    if(!isOperatorSlug(slug))return {status:'not-found'};
    try {
      const response=await fetchImpl('/api/operators/'+encodeURIComponent(slug)+'/rooms',{
        headers:{accept:'application/json'},cache:'no-store',redirect:'error',signal,
      });
      if(response.status===404)return {status:'not-found'};
      if(!response.ok)return {status:'unavailable'};
      const text=await response.text();
      if(text.length>256000)return {status:'unavailable'};
      return {status:'ready',catalog:validatePublicOperatorRooms(JSON.parse(text),{operatorSlug:slug})};
    } catch {return {status:'unavailable'};}
  }

  return { operatorPublicView, loadOperatorCatalogue, loadRoomCatalogue };
}
