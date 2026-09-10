import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTableAudio} from '../web/public/table-audio.mjs';

function fixture(){
  let enabled=true,contexts=[];
  const audio=createTableAudio({canPlay:()=>enabled,createContext:()=>{
    const context={state:'suspended',resumes:0,closed:0,addEventListener(){},removeEventListener(){},
      resume(){this.resumes++;return Promise.resolve();},
      close(){this.closed++;this.state='closed';return Promise.resolve();}};
    contexts.push(context);return context;
  }});
  return {audio,contexts,setEnabled:value=>enabled=value};
}
test('gesture resumes suspended or interrupted audio; pending resume never queues an effect',()=>{
  const {audio,contexts}=fixture();
  assert.equal(audio.context,null);audio.unlock();
  const context=contexts[0];assert.equal(context.resumes,1);assert.equal(audio.context,null);
  context.state='running';assert.equal(audio.context,context);
  context.state='interrupted';assert.equal(audio.context,null);audio.unlock();assert.equal(context.resumes,2);
  context.state='running';assert.equal(audio.context,context);
});
test('mute or hidden reset cancels scheduled output, and unmute uses a new context',()=>{
  const {audio,contexts,setEnabled}=fixture();audio.unlock();contexts[0].state='running';
  setEnabled(false);assert.equal(audio.context,null);audio.reset();audio.unlock();
  assert.equal(contexts[0].closed,1);assert.equal(contexts.length,1);
  setEnabled(true);audio.unlock();assert.equal(contexts.length,2);assert.equal(audio.context,null);
  contexts[1].state='running';assert.equal(audio.context,contexts[1]);
});
test('failed audio startup does not block gameplay and can retry on another gesture',async()=>{
  let attempts=0;
  const audio=createTableAudio({canPlay:()=>true,createContext:()=>{attempts++;throw Error('device unavailable');}});
  assert.doesNotThrow(()=>audio.unlock());assert.equal(audio.context,null);
  audio.unlock();assert.equal(attempts,2);
});
