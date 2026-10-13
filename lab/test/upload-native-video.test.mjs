import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { uploadNativeVideo } from '../lib/upload-native-video.mjs';
import {alphaPixelEvidence,inspectAlphaSource} from '../lib/media-alpha-browser.mjs';

const bytes=Buffer.from('0000ftypisom00000native-browser-upload-fixture'),file=new Blob([bytes],{type:'video/mp4'});
const id='00000000-0000-4000-8000-000000000001',sha256=createHash('sha256').update(bytes).digest('hex');
const classification={dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Browser upload',notes:''};

test('alpha pixel evidence rejects opaque and empty mattes but preserves green dealer pixels',()=>{
  assert.throws(()=>alphaPixelEvidence(new Uint8Array([0,0,0,255,0,180,0,255])),/Alfaprovet/);
  assert.throws(()=>alphaPixelEvidence(new Uint8Array([0,0,0,0,0,0,0,0])),/Alfaprovet/);
  assert.deepEqual(alphaPixelEvidence(new Uint8Array([0,0,0,0,0,180,0,255])),{transparent:1,visible:1});
});
test('failed decoded alpha preflight never requests an upload capability or sends bytes',async()=>{
  const {calls,options}=fixture({inspectAlpha:async()=>{throw Error('opaque decoded frames');}});
  await assert.rejects(uploadNativeVideo(file,{...classification,compositing:{mode:'alpha'}},'video/webm',options),/opaque decoded frames/);
  assert.equal(calls.length,0);
});
test('decoded alpha preflight releases video and canvas on middle-frame rejection',async()=>{
  class Media extends EventTarget {
    videoWidth=1080;videoHeight=1920;duration=10;time=0;src='';paused=false;cleared=false;
    load(){if(this.src)queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}
    get currentTime(){return this.time;}set currentTime(v){this.time=v;queueMicrotask(()=>this.dispatchEvent(new Event('seeked')));}
    pause(){this.paused=true;}removeAttribute(){this.src='';this.cleared=true;}
  }
  const video=new Media(),draws=[];
  const canvas={width:0,height:0,getContext:()=>({clearRect(){},drawImage(el){draws.push(el.currentTime);},getImageData(){return {data:new Uint8Array(video.time===0?[0,0,0,0,0,180,0,255]:[0,0,0,255,0,180,0,255])};}})};
  await assert.rejects(inspectAlphaSource('fixture','video/webm',{document:{createElement:tag=>tag==='video'?video:canvas}}),/Alfaprovet/);
  assert.deepEqual(draws,[0,5]);assert.equal(video.paused,true);assert.equal(video.cleared,true);assert.equal(canvas.width,1);
  const controller=new AbortController();controller.abort();
  await assert.rejects(inspectAlphaSource('fixture','video/webm',{signal:controller.signal,document:{}}),{name:'AbortError'});
});
function fixture(options={}) {
  const calls=[],pathname=`croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.mp4`;
  const fetchImpl=async (url,init) => {
    assert.equal(typeof init.body,'string');const body=JSON.parse(init.body);calls.push({operation:body.operation,url,init,body});
    return Response.json(body.operation==='prepare'?{id,pathname,clientToken:'bounded-capability',ticket:'signed-ticket'}:{id,duplicate:false});
  };
  const putImpl=async (path,blob,args) => {calls.push({operation:'put',path,blob,args});return {pathname:path,contentType:'video/mp4'};};
  return {calls,pathname,options:{fetchImpl,putImpl,...options}};
}
test('browser sends bounded grant/commit JSON to Vercel and uploads actual bytes directly to private Blob',async () => {
  const {calls,pathname,options}=fixture();assert.deepEqual(await uploadNativeVideo(file,classification,'video/mp4',options),{id,duplicate:false});
  assert.deepEqual(calls.map(row => row.operation),['prepare','put','commit']);
  assert.equal(calls[0].body.sha256,sha256);assert.equal(calls[0].body.size,file.size);assert.deepEqual(calls[0].body.classification,classification);
  assert.equal(calls[1].path,pathname);assert.equal(calls[1].blob,file);assert.equal(calls[1].args.access,'private');assert.equal(calls[1].args.token,'bounded-capability');
  assert.deepEqual(calls[2].body,{operation:'commit',ticket:'signed-ticket'});
  assert.ok(calls.filter(row => row.init).every(row => row.init.body.length<2000 && row.init.credentials==='same-origin'));
});
test('browser does not fall back to raw server upload or automatically retry failed direct uploads',async () => {
  let puts=0;const {calls,options}=fixture({putImpl:async () => {puts++;throw new Error('Upload interrupted');}});
  await assert.rejects(uploadNativeVideo(file,classification,'video/mp4',options),/Upload interrupted/);
  assert.equal(puts,1);assert.deepEqual(calls.map(row => row.operation),['prepare']);
});
test('invalid capability path or unverified returned object never reaches commit',async () => {
  let puts=0;
  const wrong={fetchImpl:async () => Response.json({id,pathname:'croupier/media/dealers/mei/other.mp4',clientToken:'capability',ticket:'ticket'}),putImpl:async () => {puts++;}};
  await assert.rejects(uploadNativeVideo(file,classification,'video/mp4',wrong),/behörighet/);assert.equal(puts,0);
  const {calls,options}=fixture({putImpl:async () => ({pathname:'wrong',contentType:'video/mp4'})});
  await assert.rejects(uploadNativeVideo(file,classification,'video/mp4',options),/privata mål/);
  assert.deepEqual(calls.map(row => row.operation),['prepare']);
});

test('leaving the uploader aborts both transport boundaries and cannot commit after a late Blob response',async () => {
  const controller = new AbortController();let puts=0;
  const {calls,options}=fixture({signal:controller.signal,putImpl:async (_path,_blob,args) => {
    assert.equal(args.abortSignal,controller.signal);puts++;controller.abort();
    return {pathname:_path,contentType:'video/mp4'};
  }});
  await assert.rejects(uploadNativeVideo(file,classification,'video/mp4',options),error => error.name==='AbortError');
  assert.equal(calls[0].init.signal,controller.signal);assert.equal(puts,1);
  assert.deepEqual(calls.map(row => row.operation),['prepare']);
  await assert.rejects(uploadNativeVideo(file,classification,'video/mp4',options),error => error.name==='AbortError');
  assert.equal(calls.length,1);
});
