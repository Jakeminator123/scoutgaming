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

// Kontrast enligt WCAG 2.x utifrån webbläsarens beräknade rgb()-färger.
function contrast(a,b){
  const luminance=color=>{const [r,g,bl]=color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>{const c=value/255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;});return 0.2126*r+0.7152*g+0.0722*bl;};
  const [light,dark]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (light+0.05)/(dark+0.05);
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
  assert.ok(!names.has('[&_.recharts-surface]:rounded-sm'),'svg-hörnen klipps inte utan fokus');
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
      return route.fulfill({contentType:'text/html',body:'<!doctype html><html class="'+new URL(route.request().url()).searchParams.get('mode')+'"><head><link rel="stylesheet" href="/theme.css"></head><body class="preview-admin"><div id="root"></div><script src="/fixture.js"></script></body></html>'});});
    for(const mode of ['dark','light']){
      await page.goto('https://admin-chart.fixture.invalid/?mode='+mode);
      const surface=page.locator('svg.recharts-surface[tabindex="0"]');await surface.waitFor();
      const style=()=>surface.evaluate(node=>{const computed=getComputedStyle(node);return {shadow:computed.boxShadow,radius:computed.borderTopLeftRadius};});
      const idle=await style();
      assert.equal(idle.shadow,'none',mode+': ingen ring utan fokus');
      assert.equal(idle.radius,'0px',mode+': svg-hörnen rundas bara vid fokus');
      await page.locator('#before').focus();await page.keyboard.press('Tab');
      assert.equal(await surface.evaluate(node=>document.activeElement===node),true,mode+': diagramytan tar emot fokus från tangentbordet');
      const focused=await style();
      assert.notEqual(focused.shadow,'none',mode+': fokusringen syns');
      assert.notEqual(focused.radius,'0px',mode+': ytan rundas vid fokus');
      // Tailwind ritar offset och ring som box-shadow-lager med spridning (offset 2px, ring 4px);
      // tomma lager (0px) hoppas över. Den yttre ringen ligger mot offseten i ytans färg.
      const colors=[...focused.shadow.matchAll(/(rgba?\([^)]+\)) 0px 0px 0px ([\d.]+)px/g)].filter(match=>Number(match[2])>0).map(match=>match[1]);
      assert.equal(colors.length,2,mode+': ring och offset: '+focused.shadow);
      const surfaceColor=await page.evaluate(()=>{const probe=document.createElement('div');probe.className='bg-sg-surface';document.body.append(probe);const color=getComputedStyle(probe).backgroundColor;probe.remove();return color;});
      assert.equal(colors[0],surfaceColor,mode+': offseten har ytans färg (--sg-surface)');
      const ratio=contrast(colors[1],surfaceColor);
      assert.ok(ratio>=3,mode+': ringen '+colors[1]+' mot ytan '+surfaceColor+' har kontrast '+ratio.toFixed(2)+':1, WCAG 1.4.11 kräver 3:1');
    }
    assert.deepEqual(failures,[]);
  }finally{await browser.close();}
});
