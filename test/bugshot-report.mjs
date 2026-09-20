import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

function testBash(){
  if(process.platform!=='win32')return 'bash';
  // PATH's bash.exe can be the WSL launcher. Use the existing Git for Windows
  // installation instead; this also supports user-local and portable Git.
  const gitExecPath=execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim();
  const bash=path.resolve(gitExecPath,'../../../bin/bash.exe');
  assert.ok(fs.existsSync(bash),'Git for Windows with Bash is required for the bugshot payload test');
  return bash;
}

// Exercise only payload/local-save preparation: no screenshot, credentials,
// dialog, network request or ticket creation runs in this test.
test('CAC and SV2 retain exact Expected Results locally and through the field fallback',t=>{
  const source=fs.readFileSync(new URL('../tools/bugshot.sh',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const start=source.indexOf('          # Keep the user');
  const end=source.indexOf('          RESP=$(J -X POST',start);
  assert.ok(start>=0&&end>start);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bugshot-payload-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const steps='1. Välj Astrid\n2. Bet $5; keep `literal` and $(literal)';
  const expected='Every hand total stays visible.\nExpected: "left, centre, right".';
  const bash=testBash(),dir=process.platform==='win32'?root.replaceAll('\\','/'):root;
  for(const project of ['CAC','SV2']){
    const raw=execFileSync(bash,['-c',source.slice(start,end)+'\nprintf "%s" "$PAYLOAD"\n'],{
      encoding:'utf8',env:{...process.env,DIR:dir,NAME:project,PKEY:project,TID:'1',SUMMARY:'Astrid "UI"',COMMENT:'Cards cover the count.',STEPS:steps,EXPECTED:expected,EXPECTED_IMG:''}
    });
    const payload=JSON.parse(raw),local=JSON.parse(fs.readFileSync(path.join(root,project+'.report.json')));
    assert.equal(local.steps,steps);assert.equal(local.expected,expected);
    const description=payload.fields.description.content[0].content[0].text;
    assert.ok(description.includes(steps)&&description.includes(expected));
    assert.ok(fs.readFileSync(path.join(root,project+'.md'),'utf8').includes(expected));
    if(project==='SV2'){
      assert.equal(payload.fields.customfield_10058,steps);assert.equal(payload.fields.customfield_10060,expected);
      delete payload.fields.customfield_10058;delete payload.fields.customfield_10059;delete payload.fields.customfield_10060;
      assert.ok(payload.fields.description.content[0].content[0].text.includes(expected));
    }
  }
});
