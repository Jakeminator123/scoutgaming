import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';

const babel=createRequire(new URL('../apps/studio/package.json',import.meta.url))('next/dist/compiled/babel/core');
// Analyze the real modules, independently of runtime fixtures: a fixture stub
// must never hide a production reference left behind by a removed function.
const globals=new Set([...runInNewContext('Object.getOwnPropertyNames(globalThis)'),
  ...`window document location navigator sessionStorage localStorage console crypto
  fetch Request Response Headers AbortController AbortSignal URL URLSearchParams
  Blob File FormData TextEncoder TextDecoder DOMException structuredClone
  setTimeout clearTimeout setInterval clearInterval queueMicrotask performance
  addEventListener removeEventListener requestAnimationFrame cancelAnimationFrame
  getComputedStyle matchMedia innerWidth innerHeight devicePixelRatio self
  Audio AudioContext Image HTMLImageElement HTMLVideoElement HTMLMediaElement HTMLCanvasElement
  ImageData OffscreenCanvas DOMMatrix DOMPoint ResizeObserver MutationObserver
  Option CustomEvent Event EventTarget Element Path2D WebSocket VideoDecoder EncodedVideoChunk VideoFrame
  history confirm XMLHttpRequest BroadcastChannel MediaSource atob btoa
  AudioWorkletProcessor registerProcessor sampleRate currentTime createImageBitmap
  arguments`.split(/\s+/)]);

for(const directory of ['web/public/','packages/presentation/runtime/','packages/presentation/compositor/']){
  test(`${directory} has no unresolved JavaScript bindings`,async()=>{
    const folder=new URL('../'+directory,import.meta.url);
    const files=(await readdir(folder,{withFileTypes:true}))
      .filter(file=>file.isFile()&&/\.(mjs|js)$/.test(file.name)).map(file=>file.name).sort();
    assert.ok(files.length>0);
    const unresolved=[];
    for(const file of files){
      const source=await readFile(new URL(file,folder),'utf8');
      const ast=babel.parseSync(source,{sourceType:'module',configFile:false,babelrc:false});
      babel.traverse(ast,{Program(path){
        for(const [name,node]of Object.entries(path.scope.globals)){
          if(!globals.has(name))unresolved.push(`${directory}${file}:${node.loc.start.line}: ${name}`);
        }
      }});
    }
    assert.deepEqual(unresolved,[],unresolved.join('\n'));
  });
}
