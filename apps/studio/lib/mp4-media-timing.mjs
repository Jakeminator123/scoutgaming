// Strict timing inspection of progressive MP4 sample tables. No duration tags,
// decode-order assumptions or estimates from filenames/catalogues are used.
// The existing worker owns bounded reads, deadline and the verified descriptor.
const invalid=()=>{throw Error('studio_media_timing_unsupported');};
const limited=()=>{throw Error('studio_media_inspection_limit');};
const MAX_SAMPLES=65_536,MAX_US=120_000_000;
export function inspectMp4Timing(read,size) {
  let boxCount=0;
  function boxes(start,end) {
    const found=[];
    while(start<end) {
      if(++boxCount>4096)limited();
      if(end-start<8)invalid();
      const h=read(start,start+8),n=h.readUInt32BE(0),type=h.toString('ascii',4);
      let length=n,header=8;
      if(n===1){if(end-start<16)invalid();const big=read(start+8,start+16).readBigUInt64BE();if(big>BigInt(Number.MAX_SAFE_INTEGER))invalid();length=Number(big);header=16;}
      if(n===0)length=end-start;
      if(length<header || length>end-start)invalid();
      found.push({type,start:start+header,end:start+length});start+=length;
    }
    return found;
  }
  const one=(list,type,optional=false)=>{
    const matches=list.filter(b=>b.type===type);
    if(matches.length>1 || !optional && matches.length!==1)invalid();
    return matches[0];
  };
  const children=b=>boxes(b.start,b.end);
  const body=(b,min=0)=>{if(!b||b.end-b.start<min)invalid();return read(b.start,b.end);};
  const full=(b,min=4)=>{const p=body(b,min);if(p[0]!==0 || p.readUIntBE(1,3)!==0)invalid();return p;};
  const safe64=(p,at,signed=false)=>{const n=Number(signed?p.readBigInt64BE(at):p.readBigUInt64BE(at));if(!Number.isSafeInteger(n))invalid();return n;};
  function clock(b) {
    const p=body(b,20),version=p[0];if(version>1 || version===1&&p.length<32)invalid();
    const scale=p.readUInt32BE(version?20:12),duration=version?safe64(p,24):p.readUInt32BE(16);
    if(!scale || !duration)invalid();
    return {scale,duration};
  }
  function table(b,stride) {
    const p=full(b,8),count=p.readUInt32BE(4);
    if(count>MAX_SAMPLES)limited();if(p.length!==8+count*stride)invalid();
    return Array.from({length:count},(_,i)=>p.subarray(8+i*stride,8+(i+1)*stride));
  }
  const root=boxes(0,size),moov=children(one(root,'moov')),movie=clock(one(moov,'mvhd'));
  if(root.some(b=>b.type==='moof') || moov.some(b=>b.type==='mvex'))invalid();
  const mdats=root.filter(b=>b.type==='mdat'),tracks=moov.filter(b=>b.type==='trak');
  if(!mdats.length || !tracks.length)invalid();if(tracks.length>9)limited();
  const ids=new Set(),ranges=[],measured=[];let totalSamples=0,maxTrackDuration=0;
  for(const trak of tracks) {
    const t=children(trak),tk=body(one(t,'tkhd'),24),version=tk[0];
    if(version>1 || version===1&&tk.length<36 || (tk.readUIntBE(1,3)&2)!==2)invalid();
    const id=tk.readUInt32BE(version?20:12);if(!id||ids.has(id))invalid();ids.add(id);
    const mdia=children(one(t,'mdia')),handler=full(one(mdia,'hdlr'),12).toString('ascii',8,12);
    if(!['vide','soun'].includes(handler) || handler==='vide' && !(tk.readUIntBE(1,3)&1))invalid();
    const media=clock(one(mdia,'mdhd')),minf=children(one(mdia,'minf')),stbl=children(one(minf,'stbl'));
    const dref=one(children(one(minf,'dinf')),'dref'),dr=full(dref,8);
    const references=boxes(dref.start+8,dref.end);
    if(dr.readUInt32BE(4)!==1 || references.length!==1 || references[0].type!=='url ')invalid();
    const reference=body(references[0],4);
    if(reference.length!==4 || reference.readUInt32BE(0)!==1)invalid();
    const sd=one(stbl,'stsd'),sdp=full(sd,8);if(sdp.readUInt32BE(4)!==1)invalid();
    const entries=boxes(sd.start+8,sd.end);
    if(entries.length!==1 || entries[0].type!==(handler==='vide'?'avc1':'mp4a'))invalid();
    if(body(entries[0],8).readUInt16BE(6)!==1)invalid();
    const sz=full(one(stbl,'stsz'),12),fixed=sz.readUInt32BE(4),count=sz.readUInt32BE(8);
    if(!count)invalid();totalSamples+=count;if(totalSamples>MAX_SAMPLES)limited();
    if(sz.length!==12+(fixed?0:count*4))invalid();
    const lengths=Array.from({length:count},(_,i)=>fixed||sz.readUInt32BE(12+i*4));
    if(lengths.some(n=>!n))invalid();
    const durations=[],offsets=[];
    for(const row of table(one(stbl,'stts'),8)) {
      const n=row.readUInt32BE(0),ticks=row.readUInt32BE(4);
      if(!n||!ticks||durations.length+n>count)invalid();
      for(let i=0;i<n;i++)durations.push(ticks);
    }
    if(durations.length!==count)invalid();
    const ctts=one(stbl,'ctts',true);
    if(ctts) {
      const p=body(ctts,8),v=p[0],n=p.readUInt32BE(4);if(v>1||p.readUIntBE(1,3)!==0||n>MAX_SAMPLES||p.length!==8+n*8)invalid();
      for(let at=8;at<p.length;at+=8) {
        const copies=p.readUInt32BE(at),offset=v?p.readInt32BE(at+4):p.readUInt32BE(at+4);
        if(!copies||offsets.length+copies>count)invalid();for(let i=0;i<copies;i++)offsets.push(offset);
      }
      if(offsets.length!==count)invalid();
    }
    const stco=one(stbl,'stco',true),co64=one(stbl,'co64',true);if(!!stco===!!co64)invalid();
    const chunks=table(stco||co64,stco?4:8).map(p=>stco?p.readUInt32BE(0):safe64(p,0));
    const mapping=table(one(stbl,'stsc'),12).map(p=>({first:p.readUInt32BE(0),count:p.readUInt32BE(4),description:p.readUInt32BE(8)}));
    if(!chunks.length || mapping[0]?.first!==1 || mapping.some((m,i)=>!m.count||m.description!==1||m.first>chunks.length||i&&m.first<=mapping[i-1].first))invalid();
    let index=0,group=0;
    chunks.forEach((start,i)=>{
      while(mapping[group+1]?.first<=i+1)group++;
      if(mapping[group].count>count-index)invalid();
      for(let j=0;j<mapping[group].count;j++) {
        const end=start+lengths[index++];
        if(!Number.isSafeInteger(end)||!mdats.some(b=>start>=b.start&&end<=b.end))invalid();
        ranges.push({start,end});start=end;
      }
    });
    if(index!==count)invalid();
    let mediaStart=0,editDuration=null;
    const edts=one(t,'edts',true);
    if(edts) {
      const edits=children(edts);if(edits.length!==1)invalid();
      const p=body(one(edits,'elst'),8),v=p[0];
      if(v>1 || p.readUIntBE(1,3)!==0 || p.readUInt32BE(4)!==1 || p.length!==(v?28:20))invalid();
      editDuration=v?safe64(p,8):p.readUInt32BE(8);mediaStart=v?safe64(p,16,true):p.readInt32BE(12);
      if(!editDuration||mediaStart<0||p.readUInt32BE(v?24:16)!==0x10000)invalid();
    }
    // BigInt cross-products preserve both MP4 clocks before rounding to us.
    const unit=BigInt(media.scale)*BigInt(movie.scale),upper=editDuration===null?null:BigInt(editDuration)*BigInt(media.scale);
    const toUs=(n,ceil=false)=>{const scaled=n*1_000_000n,value=Number(ceil?(scaled+unit-1n)/unit:(scaled+unit/2n)/unit);
      if(!Number.isSafeInteger(value)||value<0||value>MAX_US)limited();return value;};
    let dts=0;
    const presentation=durations.map((duration,i)=>{
      const start=BigInt(dts+(offsets[i]||0)-mediaStart)*BigInt(movie.scale),end=start+BigInt(duration)*BigInt(movie.scale);
      dts+=duration;if(!Number.isSafeInteger(dts))invalid();
      return {start,end,duration};
    }).sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
    if(dts!==media.duration)invalid();
    const visible=presentation.filter(p=>p.end>0n&&(upper===null||p.start<upper));
    if(!visible.length)invalid();
    let previousEnd=null;
    const clipped=visible.map(p=>{
      if(handler==='vide'&&(p.start<0n||upper!==null&&p.end>upper))invalid();
      const start=p.start<0n?0n:p.start,end=upper!==null&&p.end>upper?upper:p.end;
      if(previousEnd!==null&&start!==previousEnd)invalid();previousEnd=end;
      return {...p,start,end};
    });
    if(upper!==null && previousEnd!==upper)invalid();
    const first=clipped[0],last=clipped.at(-1);
    const declaredEnd=version?safe64(tk,28):tk.readUInt32BE(20);
    // Require exact agreement before converting either clock to microseconds.
    // A tick may be a whole second; accepting one as rounding slack can hide
    // a longer declared presentation. Ambiguously rounded muxer headers are
    // unsupported, including no-edit tracks whose end is not representable
    // in the movie clock. This never substitutes a header for measured time.
    if(last.end!==BigInt(declaredEnd)*BigInt(media.scale))invalid();
    maxTrackDuration=Math.max(maxTrackDuration,declaredEnd);
    if(handler==='vide') {
      if(first.start!==0n || clipped.some(p=>p.duration!==first.duration))invalid();
      const fps=media.scale/first.duration;if(fps<=0||fps>240||clipped.length>28_800)invalid();
      measured.push({handler,trackId:id,frameCount:clipped.length,fps,firstPtsUs:0,lastPtsUs:toUs(last.start),endUs:toUs(last.end,true)});
    } else measured.push({handler,trackId:id,firstPtsUs:toUs(first.start),endUs:toUs(last.end,true)});
  }
  ranges.sort((a,b)=>a.start-b.start);
  if(ranges.some((r,i)=>i&&r.start<ranges[i-1].end))invalid();
  const video=measured.filter(t=>t.handler==='vide'),audio=measured.filter(t=>t.handler==='soun');
  if(video.length!==1 || audio.length>8)invalid();
  const clean=({handler,...rest})=>rest,v=clean(video[0]),a=audio.sort((a,b)=>a.trackId-b.trackId).map(clean);
  const endUs=Math.max(v.endUs,...a.map(t=>t.endUs));
  // Summaries never supply the measurement, but incompatible summaries could
  // change a browser's ended boundary and must not create an unsafe budget.
  if(movie.duration!==maxTrackDuration)invalid();
  return {video:v,audio:a,endUs,audioTailUs:endUs-v.endUs};
}
