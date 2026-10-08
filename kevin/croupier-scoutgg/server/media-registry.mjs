import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
export const GAME_SPEECH=['goodluck','sidebet','insurance','double','bust','blackjack','dealerblackjack','dealerbust','win','push','lose'];
export function classifyManifest(source){
  const active=new Set(GAME_SPEECH.map(event=>(event==='sidebet'?source.repliker.find(c=>c.id==='sidebet_2'):null)??source.repliker.find(c=>c.event===event)).filter(Boolean).map(c=>c.id));
  const registry=[...source.deal.map(c=>({...c,category:'gameplay',binding:c.id==='deal_flip'?'engine hole-card reveal → filmed flip':c.id==='deal_hole'?'engine opening hole draw → face-down deal':'engine draw → seat clip'})),...source.idle.map(c=>({...c,category:'gameplay',binding:'idle presentation'})),...source.repliker.map(c=>({...c,category:active.has(c.id)?'gameplay':'legacy_training',binding:active.has(c.id)?`engine ${c.event}`:'training only; excluded from runtime selection'}))];
  const repliker_sprak={};
  for(const language of ['es','fr','zh']) {
    const bank=source.repliker_sprak?.[language];if(!bank)continue;
    repliker_sprak[language]=bank.filter(c=>active.has(c.id));
    registry.push(...bank.map(c=>({...c,id:`${language}:${c.id}`,baseId:c.id,language,category:active.has(c.id)?'gameplay':'legacy_training',binding:active.has(c.id)?`engine ${c.event} (${language})`:'training only; excluded from runtime selection'})));
  }
  const manifest={...source,repliker:source.repliker.filter(c=>active.has(c.id)),repliker_sprak,handelser:Object.fromEntries(Object.entries(source.handelser??{}).map(([k,v])=>[k,{...v,varianter:v.varianter.filter(id=>active.has(id))}]))};
  return {manifest,registry};
}
export function mediaInventory(publicDir,registered){
  const rows=[...registered,{id:'ambience',url:'/sfx/ambience.mp3',category:'gameplay',binding:'table ambience'}];
  const known=new Set(rows.map(r=>r.url));
  function walk(dir){
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,entry.name);
      if(entry.isDirectory())walk(file);
      else if(entry.isFile() && /\.(mp4|mp3|wav|ogg|webm)$/i.test(entry.name)){
        const url='/'+path.relative(publicDir,file).split(path.sep).join('/');
        if(!known.has(url)){known.add(url);rows.push({id:url,url,category:'legacy_training',binding:'unbound file; training only'});}
      }
    }
  }
  walk(publicDir);
  return rows.map(row=>{let bytes=null;try{bytes=statSync(path.join(publicDir,row.url)).size;}catch{}return {...row,bytes,available:bytes!==null};});
}
