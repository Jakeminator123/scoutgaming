import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Astrid} from '../server/astrid.mjs';
import {createDealerGameTools} from '../server/dealer-game-tools.mjs';
import {personalizedGreeting} from '../server/dealer-responses-localized.mjs';

test('the original named greeting is localized and spoken without sending the name to the LLM',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'astrid-greeting-')),calls=[];
  try {
    const astrid=new Astrid({
      llm:{reply:async()=>{throw new Error('Greeting must not call the LLM');}},
      tts:{say:async(text,lang)=>{calls.push({text,lang});return Buffer.from('pcm');}},
      lipsync:async()=>({mp4:Buffer.from('mp4'),meta:{dur:1}}),
      answersDir:dir,
    });
    const result=await astrid.enqueue({kind:'greeting',name:'Kevin',lang:'en'});
    assert.equal(result.text,'Hi Kevin, how are you today?');
    assert.equal(calls[0].text,result.text);assert.equal(calls[0].lang,'en');
    assert.equal(personalizedGreeting('Ana María','es'),'Hola, Ana María. ¿Cómo estás hoy?');
    assert.equal(personalizedGreeting('Guest 871','sv'),'Hej Guest 871, hur mår du idag?');
    assert.throws(()=>personalizedGreeting('<script>','en'),/invalid/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('Astrid accepts a spoken game fact only when it carries the game-tool proof',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'astrid-game-fact-'));
  try {
    const calls=[],astrid=new Astrid({
      llm:{reply:async()=>{throw new Error('Game fact must not call the LLM');}},
      tts:{say:async(text,lang)=>{calls.push({text,lang});return Buffer.from('pcm');}},
      lipsync:async()=>({mp4:Buffer.from('mp4'),meta:{dur:1}}),answersDir:dir,
    });
    const tools=createDealerGameTools({readGameState:()=>null});
    const gameFact=tools.makeReply('phase',{phase:'dealing'},'en');
    const result=await astrid.enqueue({kind:'game-fact',gameFact});
    assert.equal(result.text,'The table status: cards are being dealt.');
    assert.equal(calls[0].text,result.text);
    await assert.rejects(astrid.enqueue({kind:'game-fact',gameFact:{text:'made up',lang:'en'}}),/read-only dealer tool/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
