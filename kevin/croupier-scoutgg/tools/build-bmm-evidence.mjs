import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Round} from '../vendor/croupier/public/blackjack.mjs';
const dest=process.argv[2]??'review/2026-09-26-safety';mkdirSync(dest,{recursive:true});
const files=['vendor/croupier/public/blackjack.mjs','vendor/croupier/shoe-game.mjs','server/shared-table.mjs','server/table-service.mjs','server/dealer-policy.mjs','server/llm.mjs','server/astrid.mjs','server/server.mjs','server/request-safety.mjs','server/safety-audit.mjs','public/shared-table.js','public/game-events.js','public/app.js','public/media/manifest.json','public/index.html','public/demo-information.html','public/demo-information.css','server/serverless.mjs','package.json','package-lock.json'];
const hashes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],suits=['♠','♥','♦','♣'];
const cards=suits.flatMap(s=>ranks.map(r=>({r,s})));
const choose=(n,k)=>{let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return v;};
function weight(ids){const count=new Map();for(const id of ids)count.set(id,(count.get(id)??0)+1);return [...count.values()].reduce((n,k)=>n*choose(8,k),1);}
const tp={},pp={};
for(let a=0;a<52;a++)for(let b=a;b<52;b++){
 const r=new Round([{main:5,pp:1}],[]);r.hands[0].cards=[cards[a],cards[b]];r.dealer=[cards[0]];r.settleSideBets();
 const label=r.hands[0].sideLabels[0]??'Loss';const entry=pp[label]??={combinations:0,returnPerUnit:r.hands[0].sideReturn};entry.combinations+=weight([a,b]);
 for(let c=b;c<52;c++){
  const r=new Round([{main:5,tp:1}],[]);r.hands[0].cards=[cards[a],cards[b]];r.dealer=[cards[c]];r.settleSideBets();
  const label=r.hands[0].sideLabels[0]??'Loss';const entry=tp[label]??={combinations:0,returnPerUnit:r.hands[0].sideReturn};entry.combinations+=weight([a,b,c]);
 }
}
function summary(out,total){const actual=Object.values(out).reduce((n,x)=>n+x.combinations,0);if(actual!==total)throw new Error('Enumeration incomplete');return{totalCombinations:total,rtp:Object.values(out).reduce((n,x)=>n+x.combinations*x.returnPerUnit,0)/total,categories:out};}
const evidence={generatedAt:new Date().toISOString(),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,openssl:process.versions.openssl,platform:process.platform,arch:process.arch,hashes,maths:{method:'Exact unordered physical-card combination enumeration for an unconditioned eight-deck opening. Uses actual engine settlement. Does not prove RNG quality or establish main-game RTP.',perfectPairs:summary(pp,choose(416,2)),twentyOnePlusThree:summary(tp,choose(416,3)),mainGameRtp:'Not yet independently calculated; depends on complete rules and specified player strategy.'}};
writeFileSync(dest+'/build-and-maths.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({perfectPairs:evidence.maths.perfectPairs.rtp,twentyOnePlusThree:evidence.maths.twentyOnePlusThree.rtp,files:files.length}));
