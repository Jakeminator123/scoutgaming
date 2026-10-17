import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { join,dirname,resolve,basename } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../apps/studio/package.json',import.meta.url));
const sharp=require('sharp');
// Two 32x24 blue frames, generated locally with FFmpeg; no source/person media.
const mp4='AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMqbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAlV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAACAAAAAYAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAHNbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABeG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAThzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAACAAGABIAAAASAAAAAAAAAABFExhdmM2My4xLjEwMSBsaWJ4MjY0AAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAF2dCwAraJflwEQAAAwABAAADAAQPEiagAQAEaM4PyAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAABPQAAAAAAAAABhzdHRzAAAAAAAAAAEAAAACAAAgAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAACAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAACcAAAAAoAAAAUc3RjbwAAAAAAAAABAAADWgAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjMuMS4xMDEAAAAIZnJlZQAAAoJtZGF0AAACUwYF//9P3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMyAwNDgwY2IwIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTEgZGVibG9jaz0wOjA6MCBhbmFseXNlPTA6MCBtZT1kaWEgc3VibWU9MCBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0wIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MCA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0wIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj0yIHNjZW5lY3V0PTAgaW50cmFfcmVmcmVzaD0wIHJjPWNyZiBtYnRyZWU9MCBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0wAIAAAAAVZYiEOhGKAAIxccAAQ8o4AAgFyddeAAAABkGaIBKiwA==';
const webm='GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAIVEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEyTbuMU6uEHFO7a1OsggH/7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjMuMS4xMDFXQYxMYXZmNjMuMS4xMDFEiYhAj0AAAAAAABZUrmvXrgEAAAAAAABO14EBc8WIj6iRIpAtYZmcgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QdzWUA4JCwgSC6gRiagQJVsIRVuYEBVe6BAOwBAAAAAAAAAgAAElTDZ/5zc59jwIBnyJlFo4dFTkNPREVSRIeMTGF2ZjYzLjEuMTAxc3PZY8CLY8WIj6iRIpAtYZlnyKRFo4dFTkNPREVSRIeXTGF2YzYzLjEuMTAxIGxpYnZweC12cDlnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAxLjAwMDAwMDAwMAAfQ7Z1xeeBAKOrgQAAgIJJg0IAAfABdgA4JBwYSgAAMGAAABDf//v9O/////9R2H////V8AKOTgQH0AIYAQJKcAFAAAAMgAABDQBxTu2uRu4+zgQC3iveBAfGCAbXwgQM=';
export const layerVideo=(type='mp4')=>Buffer.from(type==='mp4'?mp4:webm,'base64');
export async function layerImage(format='png',width=32,height=24,orientation) {
  let image=sharp({create:{width,height,channels:4,background:{r:20,g:80,b:140,alpha:1}}});
  if(orientation)image=image.withMetadata({orientation});
  return image.toFormat(format).toBuffer();
}
export async function layerAnimation() {
  return sharp(Buffer.alloc(32*48*4,160),{raw:{width:32,height:48,channels:4,pageHeight:24}})
    .webp({loop:0,delay:[100,100]}).toBuffer();
}
export async function layerBlobFixture(cleanup,bytes,contentType='image/png') {
  const cacheDir=await mkdtemp(join(tmpdir(),'croupier-layer-inspection-'));
  cleanup(async()=>{assert.equal(dirname(resolve(cacheDir)),resolve(tmpdir()));assert.match(basename(cacheDir),/^croupier-layer-inspection-/);await rm(cacheDir,{recursive:true,force:true});});
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-private-only'};
  const options={env,cacheDir,blobClient:{async get(path){return{statusCode:200,stream:new Response(bytes).body,
    blob:{pathname:path,url:`https://fixture.private.blob.vercel-storage.com/${path}`,contentType,size:bytes.length}};}}};
  return {options,sha256,size:bytes.length,contentType};
}
