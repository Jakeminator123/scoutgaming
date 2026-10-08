import { writeFile, readdir, unlink, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { approvedSpeech, RESPONSES } from "./dealer-policy.mjs";
import {dealerLanguage} from '../public/dealer-language.js';
import {localizeResponse,personalizedGreeting} from './dealer-responses-localized.mjs';
import {isApprovedGameFact} from './dealer-game-tools.mjs';
import { randomUUID } from "node:crypto";

export class Astrid {
  /**
   * @param {object} o
   * @param {import('./llm.mjs').Gemini} o.llm
   * @param {import('./cartesia.mjs').CartesiaTTS} o.tts
   * @param {(pcm: Buffer, rate: number) => Promise<{mp4: Buffer, meta: object}>} o.lipsync
   * @param {string} o.answersDir
   */
  constructor({ llm, tts, lipsync, answersDir, queueMax = 6, keep = 60, log = console.log }) {
    Object.assign(this, { llm, tts, lipsync, answersDir, queueMax, keep, log });
    this.queue = [];
    this.working = false;
    this.onBusy = () => {};   // (working, queued) — för "tänker"-indikatorn
  }

  get queued() { return this.queue.length; }

  /** Queue reviewed chat, a server-derived game fact, a personal greeting, or fixed speech. */
  enqueue(job) {
    if (this.queue.length >= this.queueMax) return Promise.reject(new Error("Kön är full, vänta en stund."));
    return new Promise((resolve, reject) => {
      this.queue.push({ ...job, resolve, reject });
      this.onBusy(this.working, this.queue.length);
      this.#pump();
    });
  }

  async #pump() {
    if (this.working || !this.queue.length) return;
    this.working = true;
    const job = this.queue.shift();
    this.onBusy(true, this.queue.length);
    try {
      job.resolve(await this.#run(job));
    } catch (e) {
      this.log("Dealer response unavailable");
      job.reject(e);
    } finally {
      this.working = false;
      this.onBusy(false, this.queue.length);
      this.#pump();
    }
  }

  async #run(job) {
    const t0 = Date.now();
    const ms = {};
    let reply;
    let pcm;
    let speechLang = dealerLanguage(job.lang);
    if (job.kind === "speak") {
      if(!approvedSpeech(job.text))throw new Error('Speech must use a reviewed response');
      reply=job.text;
    } else if(job.kind==='greeting') {
      reply=personalizedGreeting(job.name,speechLang);
    } else if(job.kind==='game-fact') {
      if(!isApprovedGameFact(job.gameFact))throw new Error('Game facts must come from the read-only dealer tool');
      reply=job.gameFact.text;
      speechLang=dealerLanguage(job.gameFact.lang);
    } else {
      reply=await this.llm.reply({text:job.text,getContext:job.getContext});
      if(reply===null)return {silent:true,text:null,ms:{llm:Date.now()-t0}};
      // Defense in depth: even a replaced model adapter cannot send arbitrary text to TTS.
      if(!approvedSpeech(reply))reply=RESPONSES.fallback;
    }
    if(job.kind!=='greeting'&&job.kind!=='game-fact')reply=localizeResponse(reply,speechLang);
    if(job.kind==='chat'||job.kind==='game-fact')job.onText?.(reply);
    ms.llm=Date.now()-t0;
    pcm=await this.tts.say(reply,speechLang);
    ms.tts=Date.now()-t0-ms.llm;
    if (!pcm?.length) throw new Error("rösten gav inget ljud");
    const t1 = Date.now();
    const { mp4, meta } = await this.lipsync(pcm, 24000);
    ms.lipsync = Date.now() - t1;
    ms.total = Date.now() - t0;

    await mkdir(this.answersDir, { recursive: true });
    const name = `${randomUUID()}.mp4`;
    await writeFile(path.join(this.answersDir, name), mp4);
    await this.#prune();
    return { text: reply, lang:speechLang, url: `/answers/${name}`, dur: meta?.dur ?? null, ms, worker: meta?.ms ?? null };
  }

  async #prune() {
    try {
      const files=await Promise.all((await readdir(this.answersDir)).filter(f=>f.endsWith('.mp4')).map(async f=>({f,at:(await stat(path.join(this.answersDir,f))).mtimeMs})));
      files.sort((a,b)=>b.at-a.at);
      for(const [i,{f,at}] of files.entries())if(i>=this.keep||at<Date.now()-86400000)await unlink(path.join(this.answersDir,f)).catch(()=>{});
    } catch {}
  }
}
