// Candidate preparation must not hold an authoritative round indefinitely.
export async function loadArtifacts(urls,{signal,timeoutMs=5000,fetchImpl=fetch}={}){
 if(!Array.isArray(urls)||!urls.length||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid candidate preparation');
 const controller=new AbortController();
 const forward=()=>controller.abort(signal?.reason??Error('Candidate preparation cancelled'));
 if(signal?.aborted)forward();else signal?.addEventListener('abort',forward,{once:true});
 let rejectAbort;
 const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(controller.signal.reason??Error('Candidate preparation cancelled'));controller.signal.addEventListener('abort',rejectAbort,{once:true});if(controller.signal.aborted)rejectAbort();});
 const timer=setTimeout(()=>controller.abort(Error('Candidate metadata timeout')),timeoutMs);
 try{
  if(controller.signal.aborted)return await cancelled;
  const loaded=Promise.all(urls.map(async url=>{const response=await fetchImpl(url,{signal:controller.signal});if(!response.ok)throw Error('Candidate artifact unavailable');return response.json();}));
  return await Promise.race([loaded,cancelled]);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',forward);controller.signal.removeEventListener('abort',rejectAbort);controller.abort();}
}
