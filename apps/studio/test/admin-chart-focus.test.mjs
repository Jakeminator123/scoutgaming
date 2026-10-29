import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// Admins diagram har accessibilityLayer, så diagramytan (svg.recharts-surface) tas emot av
// tangentbordet. Ytan ska då visa samma fokusring som Admins övriga kontroller (focusRing i kit.tsx).
const admin=fileURLToPath(new URL('../client/admin/',import.meta.url));
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const alias={react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url))};
const fixture=`import {ChartContainer} from './components/ui/chart';import {BarChart,Bar,XAxis} from 'recharts';
const data=[{day:'mån',value:3},{day:'tis',value:5}];
export const Chart=()=><ChartContainer config={{value:{label:'Värde',color:'var(--sg-lime)'}}} style={{width:320,height:180}}>
  <BarChart accessibilityLayer data={data} width={320} height={180}><XAxis dataKey="day"/><Bar dataKey="value" fill="var(--color-value)"/></BarChart>
</ChartContainer>;`;
const bundle=(entry,options)=>build({stdin:{contents:entry,resolveDir:admin,loader:'tsx'},bundle:true,write:false,jsx:'automatic',alias,
  define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent',...options}).then(result=>result.outputFiles[0].text);
// Samma fokusring som kit.tsx: varje focus-visible-klass utom outline-none, riktad mot diagramytan.
async function expectedRing(){
  const source=await readFile(new URL('../client/admin/components/ui/kit.tsx',import.meta.url),'utf8');
  const ring=source.match(/export const focusRing='([^']+)'/)?.[1];
  assert.ok(ring,'kit.tsx exporterar focusRing');
  return ring.split(' ').filter(name=>name!=='focus-visible:outline-none').map(name=>name.replace(/^focus-visible:/,'[&_.recharts-surface:focus-visible]:'));
}

test('diagramytan får Admins fokusring vid focus-visible', async () => {
  const code=await bundle(fixture+`\nimport {renderToStaticMarkup} from 'react-dom/server';export const html=()=>renderToStaticMarkup(<Chart/>);`,{platform:'node',format:'cjs'});
  const module={exports:{}};new Function('module','exports','require',code)(module,module.exports,createRequire(admin));
  const html=module.exports.html();
  const classes=html.match(/data-slot="chart"[^>]*class="([^"]+)"|class="([^"]+)"[^>]*data-slot="chart"/);
  assert.ok(classes,'diagrammet renderas med data-slot="chart"');
  const names=new Set((classes[1]??classes[2]).replaceAll('&amp;','&').split(/\s+/));
  for(const name of await expectedRing())assert.ok(names.has(name),'saknar '+name);
  assert.ok(names.has('[&_.recharts-surface]:outline-hidden'),'webbläsarens egen kontur ersätts av ringen');
});

test('fokusringen syns i en riktig webbläsare när diagrammet nås med Tab',{skip:!browserModule},async () => {
  const [{default:postcss},{default:tailwind}]=await Promise.all([import(pathToFileURL(createRequire(admin).resolve('postcss')).href),import(pathToFileURL(createRequire(admin).resolve('@tailwindcss/postcss')).href)]);
  const globals=new URL('../client/admin/app/globals.css',import.meta.url);
  const css=(await postcss([tailwind({base:admin})]).process(await readFile(globals,'utf8'),{from:fileURLToPath(globals)})).css;
  const script=await bundle(fixture+`\nimport {createRoot} from 'react-dom/client';createRoot(document.getElementById('root')).render(<><button id="before">Före</button><Chart/></>);`,{platform:'browser',format:'iife'});
  const {chromium}=await import(pathToFileURL(browserModule).href);
  const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});
  try{
    const page=await browser.newPage(),failures=[];page.on('pageerror',error=>failures.push(error));
    await page.route('**/*',route=>{const path=new URL(route.request().url()).pathname;
      if(path==='/theme.css')return route.fulfill({contentType:'text/css',body:css});
      if(path==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:script});
      return route.fulfill({contentType:'text/html',body:'<!doctype html><html class="dark"><head><link rel="stylesheet" href="/theme.css"></head><body class="preview-admin"><div id="root"></div><script src="/fixture.js"></script></body></html>'});});
    await page.goto('https://admin-chart.fixture.invalid/');
    const surface=page.locator('svg.recharts-surface[tabindex="0"]');await surface.waitFor();
    const shadow=()=>surface.evaluate(node=>getComputedStyle(node).boxShadow);
    assert.equal(await shadow(),'none','ingen ring utan fokus');
    await page.locator('#before').focus();await page.keyboard.press('Tab');
    assert.equal(await surface.evaluate(node=>document.activeElement===node),true,'diagramytan tar emot fokus från tangentbordet');
    const ring=await shadow();
    assert.notEqual(ring,'none','fokusringen syns');
    assert.match(ring,/rgb\(214, 255, 58\)/,'ringen har Admins limefärg (--sg-lime)');
    assert.deepEqual(failures,[]);
  }finally{await browser.close();}
});
