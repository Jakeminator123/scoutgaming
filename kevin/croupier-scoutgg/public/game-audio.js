import {createTableAudio} from './table-audio.js';

export function createGameAudio({onChange=()=>{}}={}) {
  const defaults={enabled:true,ambience:.32,effects:.65,voice:1};
  let saved={};try{saved=JSON.parse(localStorage.getItem('astrid.audio')||'{}')}catch{}
  const settings={...defaults};
  if(typeof saved?.enabled==='boolean')settings.enabled=saved.enabled;
  for(const k of ['ambience','effects','voice'])if(Number.isFinite(saved?.[k]))settings[k]=Math.max(0,Math.min(1,saved[k]));
  let unlocked=false,speaking=false,duck=.32;   // duck: the casino under the dealer's voice (voice-room.js: 1 keeps it)
  const ambience=new Audio('/sfx/ambience.mp3');ambience.id='tableAmbience';ambience.hidden=true;ambience.loop=true;ambience.preload='auto';document.body.append(ambience);
  const canPlay=()=>settings.enabled&&unlocked&&!document.hidden;
  const tableAudio=createTableAudio({createContext:()=>new (window.AudioContext||window.webkitAudioContext)(),canPlay});
  const sync=()=>{
    ambience.volume=settings.ambience*(speaking ? duck : 1);
    if(canPlay()&&settings.ambience>0)ambience.play().catch(()=>{});else ambience.pause();
    onChange({...settings});
  };
  // One output bus per audio context for every effect: a high shelf takes the
  // edge off everything above ~3.5 kHz.
  // Testers heard the mix as sharp and noisy (#3).
  const buses=new WeakMap();
  function bus(ctx){
    let b=buses.get(ctx);if(b)return b;
    const shelf=ctx.createBiquadFilter();shelf.type='highshelf';shelf.frequency.value=3500;shelf.gain.value=-6;
    // No compressor: Web Audio's adds make-up gain. Measured on the chip hits: shelf alone -2.7 dB peak and
    // -3.6 dB hiss; shelf + compressor came out 3.8 dB LOUDER and hissier than no bus at all.
    shelf.connect(ctx.destination);buses.set(ctx,shelf);return shelf;
  }
  function noise(ctx,t,{dur,gain,type,freq,q=1.5,decay=2}){
    const len=Math.max(8,Math.floor(ctx.sampleRate*dur)),buf=ctx.createBuffer(1,len,ctx.sampleRate),data=buf.getChannelData(0);
    for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
    const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=buf;
    f.type=type;f.frequency.value=freq;f.Q.value=q;g.gain.value=gain*settings.effects*(speaking ? .4 : 1);
    src.connect(f).connect(g).connect(bus(ctx));src.onended=()=>{src.disconnect();f.disconnect();g.disconnect()};src.start(t);
  }
  function tone(ctx,t,freq,dur,gain){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;
    // A 6 ms fade-in: starting at full level made every beep begin with a click.
    const peak=Math.max(.0001,gain*settings.effects*(speaking ? .4 : 1)),attack=Math.min(.006,dur/3);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(peak,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(bus(ctx));o.onended=()=>{o.disconnect();g.disconnect()};o.start(t);o.stop(t+dur);
  }
  function play(name){
    const ctx=tableAudio.context;if(!ctx||!canPlay()||settings.effects===0)return;
    const t=ctx.currentTime;
    if(name==='chip'){
      // A softer clack: the noise sits around 2-2.7 kHz instead of 3.6-5 kHz (testers heard it as sharp/hissy),
      // with a short tone underneath for body.
      const f=2000+Math.random()*700;
      noise(ctx,t,{dur:.04,gain:.5,type:'bandpass',freq:f,q:1.6,decay:2.8});
      noise(ctx,t+.045,{dur:.03,gain:.22,type:'bandpass',freq:f*.8,q:1.6,decay:2.8});
      tone(ctx,t,1250+Math.random()*150,.03,.06);
    }else if(name==='pickup')noise(ctx,t,{dur:.06,gain:.14,type:'bandpass',freq:1400,q:1.3});
    else if(name==='land'){
      noise(ctx,t,{dur:.024,gain:.25,type:'lowpass',freq:1800,q:.7});
      noise(ctx,t,{dur:.04,gain:.07,type:'bandpass',freq:2400,q:1,decay:3});
    }else if(name==='gather')noise(ctx,t,{dur:.16,gain:.12,type:'bandpass',freq:1100,q:.9,decay:1.4});
    else if(name==='win'||name==='bigwin'){
      const notes=name==='bigwin'?[659.3,830.6,987.8,1318.5]:[880,1174.7];
      // Quieter and shorter: at .20 per note the win chime sat 15-25 dB above
      // every other effect and dominated the mix.
      notes.forEach((f,i)=>tone(ctx,t+i*.1,f,.5,name==='bigwin'?.08:.09));
    }else if(name==='stand'){
      for(const delay of [0,.12]){noise(ctx,t+delay,{dur:.011,gain:.35,type:'lowpass',freq:800,q:.7,decay:1.1});tone(ctx,t+delay,176,.05,.14);}
    }else tone(ctx,t,name==='timer'?1100:name==='error'?220:1400,name==='error'?.12:.045,.045);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){ambience.pause();tableAudio.reset();}else if(unlocked){tableAudio.unlock();sync();}
    onChange({...settings});
  });
  return {
    settings,ambience,
    unlock(){unlocked=true;tableAudio.unlock();sync();},
    speech(value){speaking=value;sync();},
    duckTo(value){duck=value;sync();},
    play,
    set(key,value){
      if(!(key in defaults))return;
      settings[key]=key==='enabled'?Boolean(value):Math.max(0,Math.min(1,Number(value)||0));
      try{localStorage.setItem('astrid.audio',JSON.stringify(settings))}catch{}
      if(!settings.enabled)tableAudio.reset();else if(unlocked)tableAudio.unlock();sync();
    },
  };
}
