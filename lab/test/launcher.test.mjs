import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const launcher = fileURLToPath(new URL('../../Start-Labb.ps1', import.meta.url));
const windowsTest = process.platform === 'win32' ? test : test.skip;

function powershell(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', ...args], {
      cwd: tmpdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Launcher check timed out')); }, 20000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, output }); });
  });
}

async function serverFor(t, value) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(value));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return server.address().port;
}

test('double-click wrapper resolves the adjacent script and does not set persistent policy', async () => {
  const wrapper = await readFile(new URL('../../Start-Labb.cmd', import.meta.url), 'utf8');
  assert.ok(wrapper.includes('"%~dp0Start-Labb.ps1"'));
  assert.ok(!/Set-ExecutionPolicy/i.test(wrapper));
});

windowsTest('launcher parses under built-in Windows PowerShell', async () => {
  const quoted = launcher.replaceAll("'", "''");
  const result = await powershell(['-Command', `$tokens = $null; $parseErrors = $null; [System.Management.Automation.Language.Parser]::ParseFile('${quoted}', [ref]$tokens, [ref]$parseErrors) | Out-Null; if ($parseErrors.Count) { $parseErrors | Out-String | Write-Output; exit 1 }`]);
  assert.equal(result.code, 0, result.output);
});

windowsTest('already running studio is reused from another working directory without a new server', async t => {
  const port = await serverFor(t, { ok: true, service: 'croupier-next-studio', localOnly: true });
  const result = await powershell(['-File', launcher, '-NoBrowser', '-Port', String(port)]);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Labbet kor redan/);
  assert.doesNotMatch(result.output, /installerar|Startar Croupier Studio/);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
});

windowsTest('occupied foreign port fails without terminating its owner', async t => {
  const port = await serverFor(t, { ok: true, service: 'not-this-lab' });
  const result = await powershell(['-File', launcher, '-NoBrowser', '-Port', String(port)]);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /Ingen process har stoppats/);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
});
