// One owner across an opening. The resource factory registers cleanup on lifecycle.
export function createPlaybackSession(lifecycle,prepare){
 let prepared,playing=false,disposed=false;
 return {
  async play(input){
   if(disposed||!lifecycle.active)throw Error('Sequence disposed');
   if(playing)throw Error('Sequence already playing');
   playing=true;
   try{
    prepared??=lifecycle.prepare(()=>prepare(lifecycle));
    const actor=await prepared;
    if(!lifecycle.active)throw Error('Sequence cancelled');
    return await lifecycle.playback(()=>actor.play(input),10000);
   }catch(error){lifecycle.cancel(error);throw error;}
   finally{playing=false;}
  },
  dispose(){if(disposed)return;disposed=true;lifecycle.dispose();}
 };
}
