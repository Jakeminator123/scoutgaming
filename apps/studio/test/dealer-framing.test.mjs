import test from 'node:test';
import assert from 'node:assert/strict';
import {dealerFrameRect,validateDealerFraming,drawDealerFrame,keyGreenPixels,DEFAULT_GREEN_SCREEN} from '../../../packages/presentation/contracts/dealer-framing.mjs';
import {validateVideoMetadata} from '../../../packages/presentation/contracts/video-intake.mjs';
import {Compositor} from '../../../packages/presentation/compositor/compositor.js';
import {stageGeometry} from '../../../packages/presentation/compositor/geometry.js';
import {sceneForComposition,defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';

test('mobile padding and desktop crop keep the source pixel scale, including an undersized dealer',()=>{
  for(const [w,h] of [[1080,1920],[1920,1080]])for(const scale of [1,3,6]){
    const framing={scale,x:.1,y:-.2};
    const desktop=dealerFrameRect(w,h,1920,1080,framing),mobile=dealerFrameRect(w,h,607.5,1080,framing);
    assert.deepEqual(desktop.slice(1),mobile.slice(1));
    assert.equal(desktop[0]-mobile[0],(1920-607.5)/2);
    assert.equal(desktop[3]/h,1080/h*scale);
  }
  assert.deepEqual(dealerFrameRect(1080,1920,1920,1080),[656.25,0,607.5,1080]);
});
test('framing is bounded metadata and preserves all exact clip bindings',()=>{
  const metadata={dealerId:'nora',eventId:'idle.ready',kind:'idle',role:'standard',label:'Grundloop',notes:'',situation:''};
  assert.deepEqual(validateVideoMetadata({...metadata,framing:{scale:3,x:0,y:.4}}).framing,{scale:3,x:0,y:.4});
  for(const framing of [null,[],{scale:Infinity,x:0,y:0},{scale:7,x:0,y:0},{scale:1,x:0},{scale:1,x:3,y:0},{scale:1,x:0,y:0,url:'unsafe'}])assert.throws(()=>validateDealerFraming(framing));
  assert.equal(validateVideoMetadata(metadata).framing,undefined);
});

test('images and videos with the same source dimensions share the exact placement',()=>{
  for(const [width,height] of [[1080,1920],[1672,941]]){
    const calls=[],context={clearRect(){},drawImage(source,...rect){calls.push({source,rect});}};
    const video={videoWidth:width,videoHeight:height},image={naturalWidth:width,naturalHeight:height};
    const framing={scale:1.7,x:.1,y:.25};
    drawDealerFrame(context,video,1920,1080,framing);
    drawDealerFrame(context,image,1920,1080,framing);
    assert.equal(calls[1].source,image);assert.deepEqual(calls[1].rect,calls[0].rect);
    assert.ok(calls[1].rect.every(Number.isFinite));
  }
});
test('green padding is optional and green removal preserves existing alpha and neutral subject pixels',()=>{
  const calls=[],context={clearRect(){},fillRect(...args){calls.push(['fill',this.fillStyle,...args]);},drawImage(...args){calls.push(['draw',...args]);}};
  const video={videoWidth:1080,videoHeight:1920};drawDealerFrame(context,video,1920,1080,undefined,true);
  assert.deepEqual(calls[0],['fill','#00ff00',0,0,1920,1080]);assert.deepEqual(calls[1].slice(2),[656.25,0,607.5,1080]);
  const pixels=new Uint8ClampedArray([0,255,0,255,180,140,100,255,20,20,20,100,0,255,0,0]);
  keyGreenPixels(pixels,DEFAULT_GREEN_SCREEN);
  assert.equal(pixels[3],0);assert.deepEqual([...pixels.slice(4,12)],[180,140,100,255,20,20,20,100]);assert.equal(pixels[15],0);
});
test('wide actor plane fills desktop height and crops on mobile without moving cards or table',()=>{
  for(const layout of ['mobile','desktop']){
    const scene={...sceneForComposition(defaultCompositionSettings(),layout,{background:false,table:false,cards:true}),dealerAspect:16/9};
    const actor={},cards={},calls=[];
    const compositor={ready:true,gl:{viewport(){},clearColor(){},clear(){},COLOR_BUFFER_BIT:1},canvas:{},cardCanvas:cards,geometry:stageGeometry,draw:(source,rect)=>calls.push({source,rect}),paintCards(){}};
    Compositor.prototype.render.call(compositor,scene,actor,new Map(),[],null);
    const dealer=calls.find(row=>row.source===actor).rect,card=calls.find(row=>row.source===cards).rect;
    assert.equal(dealer[2]/dealer[3],16/9);assert.equal(dealer[3],layout==='mobile'?1920:1080);
    assert.equal(card[2]/card[3],9/16);assert.equal(card[1],dealer[1]);
  }
});
test('native alpha bypasses chroma removal and preserves green clothing and partial alpha',()=>{
  const rgba=new Uint8ClampedArray([0,255,0,192,22,44,33,0]);
  assert.deepEqual(keyGreenPixels(rgba,{mode:'alpha'}),new Uint8ClampedArray([0,255,0,192,22,44,33,0]));
});
