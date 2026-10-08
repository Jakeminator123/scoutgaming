// Prepare the inactive video decoder before the server's next clip boundary.
export function createVideoPreloader(buffer) {
  const pending=new WeakMap();
  function prepare(video,source) {
    const existing=pending.get(video);if(existing?.source===source)return existing.promise;
    const entry={source};pending.set(video,entry);
    entry.promise=(async()=>{
      const url=await buffer.load(source,0);
      if(pending.get(video)!==entry)return false;
      if(video.dataset.source)buffer.unpin(video.dataset.source);
      buffer.pin(source);video.dataset.source=source;video.src=url;video.load();return true;
    })().catch(e=>{if(pending.get(video)===entry)pending.delete(video);throw e;});
    return entry.promise;
  }
  return {prepare,async consume(video,source){const promise=prepare(video,source),entry=pending.get(video);const ready=await promise;if(pending.get(video)!==entry)return false;pending.delete(video);return ready;}};
}
// A tiny clock offset is cheaper to tolerate than to restart the decoder seeking
// past the opening frames. Larger offsets still catch up after joining/resuming.
export const initialVideoOffset=(offset,duration)=>offset>.15?Math.min(offset,Math.max(0,duration-.04)):0;
