// Browser audio can start suspended or be interrupted by another app. Unlock
// inside the real user gesture; never queue old game effects behind resume().
export function createTableAudio({createContext,canPlay,onState=()=>{}}) {
  let context=null;
  const report=()=>onState(context?.state??'closed');
  return {
    get context(){return canPlay()&&context?.state==='running'?context:null;},
    unlock(){
      if(!canPlay())return;
      try {
        if(!context||context.state==='closed'){
          context=createContext();
          context.addEventListener('statechange',report);
          report();
        }
        if(context.state!=='running')context.resume().then(report).catch(report);
      }catch{report();}
    },
    reset(){
      const previous=context;context=null;report();
      if(previous){
        previous.removeEventListener('statechange',report);
        // Closing cancels scheduled chimes as well as audible sources. A
        // suspend/resume pair would replay those stale sounds after unmute.
        previous.close().catch(()=>{});
      }
    },
  };
}
