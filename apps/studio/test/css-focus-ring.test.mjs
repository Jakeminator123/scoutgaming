// Fokusramar i vanlig CSS ska använda --sg-mark, inte --sg-lime.
// Lime (#d6ff3a) är knappfyllning och har samma värde i båda lägena. Mot vit yta i ljust läge
// blir kontrasten bara cirka 1,15:1, medan WCAG 1.4.11 kräver 3:1 för en fokusmarkering.
// --sg-mark är lime i mörkt läge och mörk oliv i ljust läge, och ui-tokens.test.mjs provar den
// mot 3:1 på alla ytor i båda lägena.
// Undantag: sidomenyerna (.studio-sidebar i Admin, .partner-portal .side i partnerportalen) är
// mörka i båda lägena (--sg-side*). Där behåller fokusramen lime, eftersom --sg-mark i ljust
// läge (mörk oliv) bara når cirka 2,8:1 mot den mörka menyn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const darkSidebar = /\.studio-sidebar(?![\w-])|\.partner-portal \.side(?![\w-])/;

function cssFiles() {
  return execFileSync('git', ['ls-files', '-z', '--', 'apps/studio/*.css', 'packages/*.css'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(file => file && !file.includes('node_modules/'));
}

// Innersta reglerna (selektor och kropp) efter att kommentarer tagits bort; @media-block
// ger sina inre regler var för sig.
function focusRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...text.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ selector: selector.trim(), body }))
    .filter(rule => /:focus(-visible|-within)?\b/.test(rule.selector));
}

test('the scan finds the stylesheets and their focus rules', () => {
  const files = cssFiles();
  assert.ok(files.includes('apps/studio/client/admin/app/studio.css'), 'Admin CSS is scanned');
  assert.ok(files.includes('apps/studio/components/partner/partner-portal.css'), 'partner portal CSS is scanned');
  const rules = focusRules(readFileSync(new URL('apps/studio/client/admin/app/studio.css', `file://${root}`), 'utf8'));
  assert.ok(rules.some(rule => rule.body.includes('var(--sg-mark)')), 'Admin focus rules use --sg-mark');
});

test('focus rules use --sg-mark, not --sg-lime, outside the dark sidebars (WCAG 1.4.11)', () => {
  const offenders = [];
  for (const file of cssFiles()) {
    for (const rule of focusRules(readFileSync(new URL(file, `file://${root}`), 'utf8'))) {
      if (!rule.body.includes('--sg-lime')) continue;
      if (rule.selector.split(',').every(part => darkSidebar.test(part))) continue;
      offenders.push(`${file}: ${rule.selector.slice(0, 120)}`);
    }
  }
  assert.deepEqual(offenders, [], 'lime focus rings reach only about 1.15:1 on white in light mode; use var(--sg-mark)');
});

test('a lime focus ring is caught, and only a dark sidebar is exempt', () => {
  const rules = focusRules('.a :focus-visible{outline:2px solid var(--sg-lime)}@media(x){.b:focus-within{box-shadow:0 0 0 2px var(--sg-lime)}}.c:hover{color:var(--sg-lime)}');
  assert.deepEqual(rules.map(rule => rule.selector), ['.a :focus-visible', '.b:focus-within']);
  assert.ok(darkSidebar.test('.studio-sidebar a:focus-visible'));
  assert.ok(!darkSidebar.test('.studio-sidebar-note a:focus-visible'));
});
