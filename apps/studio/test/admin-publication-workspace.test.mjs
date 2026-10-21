import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startPublicationWorkspace} from '../../../test/fixtures/admin-publication-workspace.mjs';
import {company,otherCompany,compositionId} from '../../../test/fixtures/admin-publication-chain.mjs';
import {readPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {createStudioNativeAuth} from '../../../packages/studio-access/studio-native-auth.mjs';

async function newAuthenticatedAdmin(f){
  const cookie=await f.newAdminSession();
  assert.notEqual(cookie,f.chain.auth.admin,'readback must use a newly issued token');
  const authorize=createStudioNativeAuth(f.chain.config);
  const identity=cookie=>authorize(new Request(f.origin,{headers:{cookie}}));
  assert.deepEqual(await identity(cookie),await identity(f.chain.auth.admin),'the real validator must resolve the same N1 account and scope');
  return cookie;
}


test('publication saves use document CAS and publish only the acknowledged company package',async t=>{
  const f=await startPublicationWorkspace();t.after(()=>f.close());
  const before=await (await f.request('/studio/api/project')).json();
  const frozen=readPackagePresentation(await f.chain.store.getCurrentPackage(company.id));
  const changed=structuredClone(before.project);changed.lanes[0].label='J01 sparat bord';
  const savedResponse=await f.request('/studio/api/project',{method:'PUT',body:{project:changed,expectedRevision:before.project.revision}});
  assert.equal(savedResponse.status,200);const saved=await savedResponse.json();
  assert.notEqual(saved.project.revision,before.project.revision);
  assert.equal((await (await f.request('/studio/api/project')).json()).project.lanes[0].label,'J01 sparat bord');
  assert.deepEqual(readPackagePresentation(await f.chain.store.getCurrentPackage(company.id)),frozen,'saving cannot publish');
  const stale=await f.request('/studio/api/project',{method:'PUT',body:{project:before.project,expectedRevision:before.project.revision}});
  assert.equal(stale.status,409);
  const published=await f.request('/studio/api/admin/operator-package',{method:'POST',body:{operatorId:company.id,lanes:[compositionId],expectedPackageRevision:1}});
  assert.equal(published.status,200,JSON.stringify(await published.clone().json()));
  assert.equal((await published.json()).packageRevision,2);
  assert.equal(readPackagePresentation(await f.chain.store.getCurrentPackage(company.id)).lanes[0].label,'J01 sparat bord');
  const newSession=await newAuthenticatedAdmin(f);
  const readback=await f.request('/fixture-workspace',{cookie:newSession});
  assert.equal(readback.status,200);const reopened=await readback.json();
  assert.equal(reopened.initialProject.revision,saved.project.revision);
  assert.equal(reopened.initialProject.lanes[0].label,'J01 sparat bord');
  assert.equal(reopened.operators.find(operator=>operator.id===company.id).publishedPackage.revision,2);

  assert.equal(await f.chain.store.getCurrentPackage(otherCompany.id),null,'another company is unaffected');
  const stalePackage=await f.request('/studio/api/admin/operator-package',{method:'POST',body:{operatorId:company.id,lanes:[compositionId],expectedPackageRevision:1}});
  assert.equal(stalePackage.status,409);
  const acknowledgedPackage=structuredClone(await f.chain.store.getCurrentPackage(company.id));
  const acknowledgedProject=await (await f.request('/studio/api/project')).json();
  const foreign=await f.request('/studio/api/admin/operator-package',{method:'POST',cookie:f.chain.auth.south,body:{operatorId:company.id,lanes:[compositionId],expectedPackageRevision:2}});
  assert.equal(foreign.status,401,'the N1 endpoint does not accept a partner session');
  assert.equal((await f.request('/studio/api/project',{cookie:''})).status,401);
  assert.deepEqual(await f.chain.store.getCurrentPackage(company.id),acknowledgedPackage,'rejected partner access must not write the package');
  assert.deepEqual(await (await f.request('/studio/api/project')).json(),acknowledgedProject,'rejected access must not write the project');
  assert.equal(await f.chain.store.getCurrentPackage(otherCompany.id),null,'rejected access cannot affect another company');
  assert.deepEqual(f.errors,[]);
});

const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
test('Admin publication edit, save, publish, reopen, conflict and mobile layout use the real component',
  {skip:browserModule?false:'Set CROUPIER_BROWSER_FIXTURE_MODULE for the isolated J01 browser flow',timeout:90_000},async t=>{
  const f=await startPublicationWorkspace(),{chromium}=await import(pathToFileURL(browserModule).href);
  let browser;t.after(async()=>{await browser?.close();await f.close();});
  browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});
  const escaped=[],pageErrors=[],shots=process.env.CROUPIER_PUBLICATION_SCREENSHOTS;
  if(shots)await mkdir(shots,{recursive:true});
  async function authenticatedContext(cookie=f.chain.auth.admin){
    const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
    context.setDefaultTimeout(10_000);
    await context.route('**/*',route=>{
      if(new URL(route.request().url()).origin===f.origin)return route.continue();
      escaped.push(route.request().url());return route.abort('blockedbyclient');
    });
    const split=cookie.indexOf('=');
    await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:f.origin}]);
    const page=await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
    return {context,page};
  }
  const capture=async(page,name)=>{if(shots)await page.screenshot({path:join(shots,name+'.png'),fullPage:true});};
  const waitReady=async page=>{
    await page.getByRole('combobox',{name:'Spelbolag',exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('select[aria-label="Spelbolag"]')?.disabled);
  };
  const {page}=await authenticatedContext();await page.goto(f.url);await waitReady(page);
  const name=page.getByRole('textbox',{name:'Namn på sammansättningen',exact:true});
  const save=page.getByRole('button',{name:'Spara sammansättning',exact:true});
  const publish=page.getByRole('button',{name:'Publicera för '+company.name,exact:true});
  await capture(page,'01-selected');
  await name.fill('J01 Nordbord');
  assert.equal(await save.isEnabled(),true);assert.equal(await publish.isDisabled(),true);
  await capture(page,'02-unsaved');
  await save.click();
  await page.getByText('Sammansättningen är sparad. Publicera för att uppdatera spelrummen.',{exact:true}).waitFor();
  assert.equal(await save.isDisabled(),true);assert.equal(await publish.isEnabled(),true);
  await capture(page,'03-saved');
  await publish.click();await page.getByText('Publiceringen är bekräftad',{exact:true}).waitFor();
  await capture(page,'04-published');
  assert.equal((await f.chain.store.getCurrentPackage(company.id)).revision,2);
  const readback=page.waitForResponse(response=>response.url()===f.origin+'/fixture-workspace');
  await page.getByRole('button',{name:'Återöppna sparat läge',exact:true}).click();await readback;await waitReady(page);
  assert.equal(await name.inputValue(),'J01 Nordbord');
  const query=new URL(page.url()).searchParams;
  for(const [key,value] of Object.entries({operator:company.id,composition:compositionId,room:f.room.id,dealer:'astrid',game:'blackjack'}))assert.equal(query.get(key),value);
  assert.equal(new URL(page.url()).hash,'#publication');
  await capture(page,'05-reopened');
  const newSession=await newAuthenticatedAdmin(f);
  const fresh=await authenticatedContext(newSession);await fresh.page.goto(f.url);await waitReady(fresh.page);
  assert.equal((await fresh.context.cookies(f.origin)).find(cookie=>cookie.name==='bo_jwt').value,newSession.slice('bo_jwt='.length));
  await fresh.page.getByText('Senast publicerat · version 2',{exact:true}).waitFor();
  assert.equal(await fresh.page.getByRole('textbox',{name:'Namn på sammansättningen'}).inputValue(),'J01 Nordbord');
  await capture(fresh.page,'06-fresh-authenticated-session');
  await fresh.page.setViewportSize({width:390,height:844});
  assert.equal(await fresh.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await capture(fresh.page,'07-mobile');
  await fresh.context.close();

  const latest=(await (await f.request('/studio/api/project')).json()).project;
  const remote=structuredClone(latest);remote.lanes[0].label='En annan redaktör';
  assert.equal((await f.request('/studio/api/project',{method:'PUT',body:{project:remote,expectedRevision:latest.revision}})).status,200);
  await name.fill('Mitt lokala utkast');await save.click();await page.getByText('Versionskonflikt',{exact:true}).waitFor();
  assert.equal(await name.inputValue(),'Mitt lokala utkast');assert.equal(await publish.isDisabled(),true);
  await capture(page,'08-conflict');
  await page.getByRole('button',{name:'Hämta senaste · behåll mitt utkast',exact:true}).click();
  await page.getByRole('button',{name:'Behåll mina val där det krockar',exact:true}).click();
  assert.equal(await name.inputValue(),'Mitt lokala utkast');
  await save.click();await page.getByText('Sammansättningen är sparad. Publicera för att uppdatera spelrummen.',{exact:true}).waitFor();
  assert.equal((await (await f.request('/studio/api/project')).json()).project.lanes[0].label,'Mitt lokala utkast');
  await capture(page,'09-conflict-resolved-and-saved');
  assert.deepEqual(escaped,[]);assert.deepEqual(pageErrors,[]);assert.deepEqual(f.errors,[]);
});
