const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
// Merge changes against the editor's original revision. A conflicting field
// remains explicit; unrelated remote changes are never overwritten by reload.
export function rebaseProjectDraft(base,draft,remote,prefer='local'){
  const conflicts=[];
  function merge(a,b,c,path){
    if(same(a,b))return structuredClone(c);
    if(same(a,c)||same(b,c))return structuredClone(b);
    if(object(a)&&object(b)&&object(c)){
      return Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b),...Object.keys(c)])].map(key=>[key,merge(a[key],b[key],c[key],path?`${path}.${key}`:key)]).filter(([,value])=>value!==undefined));
    }
    conflicts.push(path);return structuredClone(prefer==='local'?b:c);
  }
  const project=merge(base,draft,remote,'');project.revision=remote.revision;
  return {project,conflicts:conflicts.filter(path=>path!=='revision')};
}
