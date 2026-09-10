// One queued performance at a time. A cancelled request stays cancelled even
// if its bank/media preparation resolves after sound or visibility returns.
// Each run must pass the supplied signal through its asynchronous preparation.
export function createSpeechQueue({canPlay=()=>true,beforePlay=()=>{}}={}) {
  const jobs=new Set();
  let tail=Promise.resolve();
  return {
    get pending(){return jobs.size;},
    get idle(){return tail;},
    enqueue(run) {
      if(!canPlay())return Promise.resolve();
      const controller=new AbortController();
      let resolve;
      const done=new Promise(r=>{resolve=r;});
      const job={controller,finish(){jobs.delete(job);resolve();}};
      jobs.add(job);
      const previous=tail;tail=done;
      previous.then(async()=>{
        if(controller.signal.aborted||!canPlay())return;
        beforePlay();
        if(!controller.signal.aborted)await run(controller.signal);
      }).catch(()=>{}).finally(job.finish);
      return done;
    },
    cancel() {
      for(const job of jobs){job.controller.abort();job.finish();}
      tail=Promise.resolve();
    }
  };
}
