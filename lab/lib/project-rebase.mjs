const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keyed=value=>Array.isArray(value)&&value.every(row=>object(row)&&typeof row.id==='string')&&new Set(value.map(row=>row.id)).size===value.length;
// Merge changes against the editor's original revision. A conflicting field
// remains explicit; unrelated remote changes are never overwritten by reload.
export function rebaseProjectDraft(base,draft,remote,prefer='local'){
  const conflicts=[];
  function merge(a,b,c,path){
    if(same(a,b))return structuredClone(c);
    if(same(a,c)||same(b,c))return structuredClone(b);
    // Compositions have stable IDs and independently editable settings. Keep
    // ordered primitive lists atomic; a deliberate concurrent reorder remains
    // an explicit conflict instead of losing either author's ordering.
    if(path==='lanes'&&[a,b,c].every(keyed)){
      const shared=new Set(a.filter(row=>b.some(item=>item.id===row.id)&&c.some(item=>item.id===row.id)).map(row=>row.id));
      const order=rows=>rows.filter(row=>shared.has(row.id)).map(row=>row.id);
      if(same(order(a),order(b))&&same(order(a),order(c))){
        const indexes=[a,b,c].map(rows=>new Map(rows.map(row=>[row.id,row])));
        const ids=[...new Set([...c.map(row=>row.id),...b.map(row=>row.id),...a.map(row=>row.id)])];
        return ids.map(id=>merge(indexes[0].get(id),indexes[1].get(id),indexes[2].get(id),`${path}.${id}`)).filter(row=>row!==undefined);
      }
    }
    if(object(a)&&object(b)&&object(c)){
      return Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b),...Object.keys(c)])].map(key=>[key,merge(a[key],b[key],c[key],path?`${path}.${key}`:key)]).filter(([,value])=>value!==undefined));
    }
    conflicts.push(path);return structuredClone(prefer==='local'?b:c);
  }
  const project=merge(base,draft,remote,'');project.revision=remote.revision;
  return {project,conflicts:conflicts.filter(path=>path!=='revision')};
}
