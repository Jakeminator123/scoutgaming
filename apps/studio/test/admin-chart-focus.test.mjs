import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// Measure keyboard focus in the rendered Admin controls, including forced colours.
// Class names, colour tokens, outline widths and corner radii are implementation choices.
const admin=fileURLToPath(new URL('../client/admin/',import.meta.url));
const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const alias={react:fileURLToPath(new URL('../client/node_modules/react',import.meta.url)),'react-dom':fileURLToPath(new URL('../client/node_modules/react-dom',import.meta.url))};
const fixture=`import {ChartContainer} from './components/ui/chart';import {Button} from './components/ui/kit';import {BarChart,Bar,XAxis} from 'recharts';
const data=[{day:'mån',value:3},{day:'tis',value:5}];
export const Chart=()=><ChartContainer config={{value:{label:'Värde',color:'var(--sg-lime)'}}} style={{width:320,height:180}}>
  <BarChart accessibilityLayer data={data} width={320} height={180}><XAxis dataKey="day"/><Bar dataKey="value" fill="var(--color-value)"/></BarChart>
</ChartContainer>;`;
const bundle=(entry,options)=>build({stdin:{contents:entry,resolveDir:admin,loader:'tsx'},bundle:true,write:false,jsx:'automatic',alias,
  define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent',...options}).then(result=>result.outputFiles[0].text);
// Kontrast enligt WCAG 2.x utifrån webbläsarens beräknade rgb()-färger.
function contrast(a,b){
  const rgba=color=>color.match(/[\d.]+/g).map(Number);
  const bg=rgba(b),fg=rgba(a),alpha=fg[3]??1;
  const luminance=rgb=>{const [r,g,bl]=rgb.slice(0,3).map(value=>{const c=value/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;});return 0.2126*r+0.7152*g+0.0722*bl;};
  const [light,dark]=[luminance(fg.map((value,index)=>value*alpha+bg[index]*(1-alpha))),luminance(bg)].sort((x,y)=>y-x);
  return (light+0.05)/(dark+0.05);
}

test('Admin button and chart retain visible keyboard focus and contrast in both themes and forced colours',{skip:!browserModule},async () => {
  const [{default:postcss},{default:tailwind}]=await Promise.all([import(pathToFileURL(createRequire(admin).resolve('postcss')).href),import(pathToFileURL(createRequire(admin).resolve('@tailwindcss/postcss')).href)]);
  const globals=new URL('../client/admin/app/globals.css',import.meta.url);
  const css=(await postcss([tailwind({base:admin})]).process(await readFile(globals,'utf8'),{from:fileURLToPath(globals)})).css;
  const script=await bundle(fixture+`\nimport {createRoot} from 'react-dom/client';createRoot(document.getElementById('root')).render(<><button id="before">Före</button><div id="surface" style={{background:'var(--sg-surface)',padding:20}}><Button id="control">Åtgärd</Button><Chart/></div></>);`,{platform:'browser',format:'iife'});
  const {chromium}=await import(pathToFileURL(browserModule).href);
  const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});
  try{
    const page=await browser.newPage(),failures=[];page.on('pageerror',error=>failures.push(error));
    await page.route('**/*',route=>{const path=new URL(route.request().url()).pathname;
      if(path==='/theme.css')return route.fulfill({contentType:'text/css',body:css});
      if(path==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:script});
      return route.fulfill({contentType:'text/html',body:'<!doctype html><html class="'+new URL(route.request().url()).searchParams.get('mode')+'"><head><link rel="stylesheet" href="/theme.css"></head><body class="preview-admin"><div id="root"></div><script src="/fixture.js"></script></body></html>'});});
    for(const forcedColors of ['none','active'])for(const mode of ['dark','light']){
      await page.emulateMedia({forcedColors});
      await page.goto('https://admin-chart.fixture.invalid/?mode='+mode);
      await page.locator('svg[tabindex="0"]').waitFor();
      await page.locator('#before').focus();
      for(const selector of ['#control','svg[tabindex="0"]']){
        const control=page.locator(selector),label=`${mode}/${forcedColors}/${selector}`;
        const style=()=>control.evaluate(node=>{const css=getComputedStyle(node);return {shadow:css.boxShadow,outline:css.outline,outlineStyle:css.outlineStyle,outlineWidth:parseFloat(css.outlineWidth),outlineColor:css.outlineColor};});
        const idle=await style();
        await page.keyboard.press('Tab');
        assert.equal(await control.evaluate(node=>document.activeElement===node),true,label+': Tab reaches the control');
        await control.evaluate(async node=>{await Promise.all(node.getAnimations().map(animation=>animation.finished));});
        const focused=await style(),colors=[];
        if(focused.outline!==idle.outline&&focused.outlineWidth>0&&!['none','hidden'].includes(focused.outlineStyle))colors.push(focused.outlineColor);
        if(focused.shadow!==idle.shadow)for(const match of focused.shadow.matchAll(/(rgba?\([^)]+\)) ([^,]+)/g)){
          if(idle.shadow.includes(match[0]))continue;
          const lengths=match[2].match(/-?[\d.]+px/g)?.map(parseFloat)??[];
          if(!match[2].includes('inset')&&lengths.some(value=>value>0))colors.push(match[1]);
        }
        const surfaceColor=await page.locator('#surface').evaluate(node=>getComputedStyle(node).backgroundColor);
        assert.ok(colors.some(color=>contrast(color,surfaceColor)>=3),label+': focus indicator reaches 3:1 against its surface: '+JSON.stringify({focused,surfaceColor}));
      }
    }
    assert.deepEqual(failures,[]);
  }finally{await browser.close();}
});
