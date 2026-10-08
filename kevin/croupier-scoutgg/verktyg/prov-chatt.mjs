// Röktest av demot i en riktig webbläsare (Playwright, headless Chromium):
//   sidan laddar → idle-loopen går → "Sätt dig vid bordet" → hälsningen spelas → en chattfråga →
//   svaret kommer som text och sedan som klipp → en spelhändelse spelas.
//
//   npm run prov:chatt                         (mot http://127.0.0.1:8600)
//   BASE=https://<länk> npm run prov:chatt     (mot en delad länk)
//
// Skriver prov-*.png i paketets rot och tider till konsolen. Kostar ett chattsvar på GPU:n.

import { chromium } from "playwright";

const BASE = process.env.BASE ?? `http://127.0.0.1:${process.env.PORT ?? 8600}`;
const t0 = Date.now();
const s = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const fel = [];
page.on("pageerror", (e) => fel.push(e.message));
page.on("console", (m) => { if (m.type() === "error") fel.push(m.text()); });

const playing = () => page.evaluate(() => {
  const v = [...document.querySelectorAll("video.on")][0];
  return v ? { src: new URL(v.src).pathname, t: v.currentTime, muted: v.muted } : null;
});

await page.goto(BASE);
await page.waitForFunction(() => document.querySelector("video.on"), null, { timeout: 20000 });
console.log(`${s()}  idle spelar: ${JSON.stringify(await playing())}`);
await page.screenshot({ path: "prov-1-grind.png" });

await page.click("#enter");
await page.waitForFunction(() => document.querySelector("video.on")?.src.includes("greeting"), null, { timeout: 15000 });
console.log(`${s()}  hälsningen spelar: ${JSON.stringify(await playing())}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: "prov-2-halsning.png" });

const fraga = process.env.FRAGA ?? "Good evening Astrid, what are the rules at this table?";
await page.fill("#who", "Provaren");
await page.fill("#input", fraga);
const tFraga = Date.now();
await page.click("#send");
await page.waitForFunction(() => [...document.querySelectorAll(".msg.her")].some((b) => b.textContent.includes("pratar strax")), null, { timeout: 60000 })
  .then(() => console.log(`${s()}  svarstexten syns efter ${((Date.now() - tFraga) / 1000).toFixed(1)} s`), () => {});
await page.waitForFunction(() => document.querySelector("video.on")?.src.includes("/answers/"), null, { timeout: 300000 });
console.log(`${s()}  svarsklippet spelar efter ${((Date.now() - tFraga) / 1000).toFixed(1)} s: ${JSON.stringify(await playing())}`);
const svar = await page.evaluate(() => [...document.querySelectorAll(".msg.her")].pop()?.textContent);
console.log(`        ${svar}`);
await page.waitForTimeout(1200);
await page.screenshot({ path: "prov-3-svar.png" });

await page.click("#toggleEvents");
await page.click('#lines button[data-id="blackjack"]');
await page.waitForFunction(() => document.querySelector("video.on")?.src.includes("blackjack"), null, { timeout: 20000 });
console.log(`${s()}  spelhändelse blackjack spelar`);
await page.waitForTimeout(800);
await page.screenshot({ path: "prov-4-handelse.png" });

// mobil: samma sida i telefonformat
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mob.goto(BASE);
await mob.waitForFunction(() => document.querySelector("video.on"), null, { timeout: 20000 });
await mob.tap("#enter");
await mob.waitForTimeout(2500);
await mob.screenshot({ path: "prov-5-mobil.png" });

console.log(fel.length ? `FEL I SIDAN:\n  ${fel.join("\n  ")}` : "inga fel i sidan");
await browser.close();
